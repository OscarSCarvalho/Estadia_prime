// Cenários de "Carrinho e Criação da Reserva" do SPEC.md §5 + painéis de reservas (H2.4, H3.3), via HTTP real.
// Datas em 2099 para nunca ficarem no passado
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidorTeste, criarNavegador } = require('../ajudantes/servidorTeste');
const { criarImovel, criarServico, criarReserva } = require('../ajudantes/dadosBanco');

let servidor;
let villa;
let mordomo;
let contador = 0;
let contas;

// Conta com login de verdade (cookie). Anfitrião e prestador já com recebimento ativo (RN13)
async function entrarComo(tipo, nome = `Pessoa ${tipo}`) {
  contador += 1;
  const navegador = criarNavegador(servidor.urlBase);
  const { corpo } = await navegador.post('/api/auth/cadastro', {
    nome,
    email: `reserva${contador}@x.com`,
    senha: 'senhaForte123',
    tipo,
    telefone: '21999990000',
  });
  navegador.id = corpo.usuario.id;
  servidor.db.prepare('UPDATE usuarios SET recebimento_ativo = 1 WHERE id = ?').run(navegador.id);
  return navegador;
}

function pedido(dados = {}) {
  return {
    imovel_id: villa,
    checkin: '2099-12-20',
    checkout: '2099-12-23',
    num_hospedes: 6,
    servicos: [{ servico_id: mordomo, data_servico: '2099-12-21', quantidade: 2 }],
    ...dados,
  };
}

beforeEach(async () => {
  servidor = await iniciarServidorTeste();
  const anfitriao = await entrarComo('anfitriao', 'Ana Souza');
  const prestador = await entrarComo('prestador', 'Paulo Andrade');
  villa = criarImovel(servidor.db, anfitriao.id, { titulo: 'Villa Vista Mar', endereco: 'Rua das Ondas, 10' });
  mordomo = criarServico(servidor.db, prestador.id, { tipo_servico: 'mordomo', preco: 80000 });
  contas = { anfitriao, prestador, hospede: await entrarComo('hospede', 'Hugo Lima') };
});

afterEach(async () => {
  await servidor.fechar();
  assert.deepEqual(servidor.errosRegistrados, [], 'nenhum erro 500 deveria ter acontecido');
});

test('reserva com serviços: pendente, valores do SPEC e preço congelado, tudo numa transação', async () => {
  const resposta = await contas.hospede.post('/api/reservas', pedido());

  assert.equal(resposta.status, 201, JSON.stringify(resposta.corpo));
  const { reserva } = resposta.corpo;
  assert.equal(reserva.status, 'pendente');
  assert.equal(reserva.valor_hospedagem, 750000);
  assert.equal(reserva.valor_servicos, 160000);
  assert.equal(reserva.valor_total, 910000);
  assert.ok(reserva.prazo_pagamento, 'mostra até quando dá para pagar');
  assert.equal(reserva.imovel.endereco, null, 'RN12: endereço só depois da confirmação');
  assert.equal('valor_comissao' in reserva, false, 'a comissão não é mostrada ao hóspede');

  const gravada = servidor.db.prepare('SELECT valor_comissao FROM reservas WHERE id = ?').get(reserva.id);
  assert.equal(gravada.valor_comissao, 114000);
  const item = servidor.db.prepare('SELECT * FROM reserva_servicos WHERE reserva_id = ?').get(reserva.id);
  assert.equal(item.preco_contratado, 80000);
  assert.equal(item.quantidade, 2);
  assert.equal(item.valor_comissao, 24000);

  // CB07: o prestador aumenta o preço depois; a reserva não muda
  await contas.prestador.put(`/api/meus-servicos/${mordomo}`, {
    tipo_servico: 'mordomo',
    preco: 1500,
    unidade_preco: 'diaria',
    cidade_atuacao: 'Búzios',
  });
  const { corpo } = await contas.hospede.get('/api/reservas');
  assert.equal(corpo.reservas[0].itens[0].preco_contratado, 80000);
  assert.equal(corpo.reservas[0].valor_total, 910000);
});

test('valores enviados pelo navegador são ignorados: tudo é recalculado pelo banco', async () => {
  const { corpo } = await contas.hospede.post('/api/reservas', {
    ...pedido({ servicos: [{ servico_id: mordomo, data_servico: '2099-12-21', quantidade: 2, preco: 1, preco_contratado: 1 }] }),
    valor_total: 100,
    valor_hospedagem: 100,
  });
  assert.equal(corpo.reserva.valor_total, 910000);
});

test('disputa pela mesma data: só um consegue; o outro recebe 409 "Imóvel indisponível nessas datas"', async () => {
  const outroHospede = await entrarComo('hospede');
  const respostas = await Promise.all([
    contas.hospede.post('/api/reservas', pedido({ servicos: [] })),
    outroHospede.post('/api/reservas', pedido({ servicos: [], checkin: '2099-12-22', checkout: '2099-12-25' })),
  ]);
  const status = respostas.map((resposta) => resposta.status).sort();
  assert.deepEqual(status, [201, 409]);
  const recusada = respostas.find((resposta) => resposta.status === 409);
  assert.equal(recusada.corpo.erro.mensagem, 'Imóvel indisponível nessas datas');
  assert.equal(servidor.db.prepare('SELECT COUNT(*) AS total FROM reservas').get().total, 1);
});

test('serviço de outra cidade → 422; data do serviço fora da estadia → 422', async () => {
  const paraty = criarServico(servidor.db, contas.prestador.id, { tipo_servico: 'barman', cidade_atuacao: 'Paraty' });

  const outraCidade = await contas.hospede.post('/api/reservas', pedido({ servicos: [{ servico_id: paraty, data_servico: '2099-12-21', quantidade: 1 }] }));
  assert.equal(outraCidade.status, 422);
  assert.equal(outraCidade.corpo.erro.mensagem, 'Serviço não atende a cidade do imóvel');

  const foraDoPeriodo = await contas.hospede.post('/api/reservas', pedido({ servicos: [{ servico_id: mordomo, data_servico: '2099-12-25', quantidade: 1 }] }));
  assert.equal(foraDoPeriodo.status, 422);
  assert.equal(foraDoPeriodo.corpo.erro.mensagem, 'Data do serviço fora da estadia');

  // Dia do check-out ainda vale (RN05: inclusive)
  const noCheckout = await contas.hospede.post('/api/reservas', pedido({ servicos: [{ servico_id: mordomo, data_servico: '2099-12-23', quantidade: 1 }] }));
  assert.equal(noCheckout.status, 201);
});

test('prestador já contratado no dia em outra reserva confirmada → 409; em outro dia, tudo bem', async () => {
  const outraCasa = criarImovel(servidor.db, contas.anfitriao.id, { titulo: 'Casa ao lado' });
  const outraReserva = criarReserva(servidor.db, { hospedeId: contas.hospede.id, imovelId: outraCasa, checkin: '2099-12-20', checkout: '2099-12-22' });
  servidor.db
    .prepare('INSERT INTO reserva_servicos (reserva_id, servico_id, data_servico, quantidade, preco_contratado) VALUES (?, ?, ?, 1, 80000)')
    .run(outraReserva, mordomo, '2099-12-21');

  const ocupado = await contas.hospede.post('/api/reservas', pedido());
  assert.equal(ocupado.status, 409);
  assert.equal(ocupado.corpo.erro.mensagem, 'Prestador indisponível nessa data');
  assert.deepEqual(ocupado.corpo.erro.detalhes, { servico_id: mordomo, data_servico: '2099-12-21' });

  const outroDia = await contas.hospede.post('/api/reservas', pedido({ servicos: [{ servico_id: mordomo, data_servico: '2099-12-22', quantidade: 1 }] }));
  assert.equal(outroDia.status, 201);

  // O carrinho mostra o dia ocupado antes de a pessoa tentar
  const { corpo } = await criarNavegador(servidor.urlBase).get(`/api/imoveis/${villa}/servicos?checkin=2099-12-20&checkout=2099-12-23`);
  assert.deepEqual(corpo.servicos.find((servico) => servico.id === mordomo).dias_indisponiveis, ['2099-12-21', '2099-12-22']);
});

test('capacidade excedida → 422; serviço desativado → 422; imóvel inexistente → 404', async () => {
  const lotado = await contas.hospede.post('/api/reservas', pedido({ num_hospedes: 10 }));
  assert.equal(lotado.status, 422);
  assert.equal(lotado.corpo.erro.codigo, 'CAPACIDADE_EXCEDIDA');

  await contas.prestador.patch(`/api/meus-servicos/${mordomo}/status`, { status: 'inativo' });
  const desativado = await contas.hospede.post('/api/reservas', pedido());
  assert.equal(desativado.status, 422);
  assert.equal(desativado.corpo.erro.codigo, 'SERVICO_INDISPONIVEL');

  assert.equal((await contas.hospede.post('/api/reservas', pedido({ imovel_id: 9999, servicos: [] }))).status, 404);
  assert.equal(servidor.db.prepare('SELECT COUNT(*) AS total FROM reservas').get().total, 0, 'nada foi gravado');
});

test('só hóspede reserva (403 para anfitrião e prestador, 401 sem login)', async () => {
  assert.equal((await contas.anfitriao.post('/api/reservas', pedido())).status, 403);
  assert.equal((await contas.prestador.post('/api/reservas', pedido())).status, 403);
  assert.equal((await criarNavegador(servidor.urlBase).post('/api/reservas', pedido())).status, 401);
});

test('RN07: pendente com mais de 30 min some das listas e libera as datas', async () => {
  const { corpo } = await contas.hospede.post('/api/reservas', pedido());
  servidor.db.prepare("UPDATE reservas SET data_reserva = datetime('now', '-31 minutes') WHERE id = ?").run(corpo.reserva.id);

  assert.deepEqual((await contas.hospede.get('/api/reservas')).corpo.reservas, []);
  const outroHospede = await entrarComo('hospede');
  assert.equal((await outroHospede.post('/api/reservas', pedido())).status, 201, 'datas e prestador liberados');
});

test('desistir de reserva pendente libera as datas na hora; reserva de outro hóspede → 404', async () => {
  const { corpo } = await contas.hospede.post('/api/reservas', pedido());
  const outroHospede = await entrarComo('hospede');

  assert.equal((await outroHospede.post(`/api/reservas/${corpo.reserva.id}/desistir`)).status, 404);
  const desistencia = await contas.hospede.post(`/api/reservas/${corpo.reserva.id}/desistir`);
  assert.equal(desistencia.status, 200);
  assert.equal(desistencia.corpo.reserva.status, 'cancelada');
  assert.equal((await contas.hospede.post(`/api/reservas/${corpo.reserva.id}/desistir`)).status, 409, 'já cancelada');

  assert.equal((await outroHospede.post('/api/reservas', pedido())).status, 201);
});

test('reserva confirmada não é cancelada por aqui (reembolso é da Etapa 4b)', async () => {
  const { corpo } = await contas.hospede.post('/api/reservas', pedido());
  servidor.db.prepare("UPDATE reservas SET status = 'confirmada' WHERE id = ?").run(corpo.reserva.id);
  const resposta = await contas.hospede.post(`/api/reservas/${corpo.reserva.id}/desistir`);
  assert.equal(resposta.status, 409);
  assert.equal(resposta.corpo.erro.codigo, 'RESERVA_NAO_PENDENTE');
});

test('H2.4 e H3.3: anfitrião e prestador veem a reserva; contato só depois da confirmação', async () => {
  const { corpo } = await contas.hospede.post('/api/reservas', pedido());

  const recebidas = (await contas.anfitriao.get('/api/reservas-recebidas')).corpo.reservas;
  assert.equal(recebidas.length, 1);
  assert.equal(recebidas[0].hospede.nome, 'Hugo Lima');
  assert.equal(recebidas[0].hospede.telefone, null, 'telefone só com reserva confirmada');
  assert.equal(recebidas[0].repasse_hospedagem, 660000);
  assert.equal(recebidas[0].itens[0].prestador, 'Paulo Andrade');

  const agenda = (await contas.prestador.get('/api/agenda')).corpo.agenda;
  assert.equal(agenda.length, 1);
  assert.equal(agenda[0].data_servico, '2099-12-21');
  assert.equal(agenda[0].repasse, 136000);
  assert.equal(agenda[0].reserva.status, 'pendente');
  assert.equal(agenda[0].imovel.endereco, null);

  servidor.db.prepare("UPDATE reservas SET status = 'confirmada' WHERE id = ?").run(corpo.reserva.id);
  assert.equal((await contas.anfitriao.get('/api/reservas-recebidas')).corpo.reservas[0].hospede.telefone, '21999990000');
  assert.equal((await contas.prestador.get('/api/agenda')).corpo.agenda[0].imovel.endereco, 'Rua das Ondas, 10');
  assert.equal((await contas.hospede.get('/api/reservas')).corpo.reservas[0].imovel.endereco, 'Rua das Ondas, 10');

  // Outro anfitrião e outro prestador não veem nada; perfis trocados → 403
  assert.deepEqual((await (await entrarComo('anfitriao')).get('/api/reservas-recebidas')).corpo.reservas, []);
  assert.deepEqual((await (await entrarComo('prestador')).get('/api/agenda')).corpo.agenda, []);
  assert.equal((await contas.hospede.get('/api/agenda')).status, 403);
  assert.equal((await contas.prestador.get('/api/reservas-recebidas')).status, 403);
});
