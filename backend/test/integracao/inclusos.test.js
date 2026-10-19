// Cenários de "Serviços inclusos do anfitrião" do SPEC.md §5 (RN17–RN21), via HTTP real.
// Datas em 2099 para nunca ficarem no passado
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidorTeste, criarNavegador } = require('../ajudantes/servidorTeste');
const { criarImovel, criarServico } = require('../ajudantes/dadosBanco');

let servidor;
let villa;
let mordomo;
let contador = 0;
let contas;

async function entrarComo(tipo, nome = `Pessoa ${tipo}`) {
  contador += 1;
  const navegador = criarNavegador(servidor.urlBase);
  const { corpo } = await navegador.post('/api/auth/cadastro', {
    nome,
    email: `incluso${contador}@x.com`,
    senha: 'senhaForte123',
    tipo,
    telefone: '21999990000',
  });
  navegador.id = corpo.usuario.id;
  servidor.db.prepare('UPDATE usuarios SET recebimento_ativo = 1 WHERE id = ?').run(navegador.id);
  return navegador;
}

const caminhoInclusos = (imovelId = villa) => `/api/meus-imoveis/${imovelId}/inclusos`;

async function cadastrarIncluso(dados, imovelId = villa) {
  const resposta = await contas.anfitriao.post(caminhoInclusos(imovelId), dados);
  assert.equal(resposta.status, 201, JSON.stringify(resposta.corpo));
  return resposta.corpo.incluso;
}

// 3 noites, 6 hóspedes: caseiro 150 × 3, café 80 × 6, lenha 120 fixo
async function cadastrarTresInclusos() {
  return {
    caseiro: await cadastrarIncluso({ nome: 'Caseiro', descricao: 'Fica na casa do caseiro, ao lado', preco: '150,00', unidade_preco: 'noite' }),
    cafe: await cadastrarIncluso({ nome: 'Café da manhã', preco: 80, unidade_preco: 'hospede' }),
    lenha: await cadastrarIncluso({ nome: 'Lenha', preco: '120', unidade_preco: 'estadia' }),
  };
}

function pedido(dados = {}) {
  return { imovel_id: villa, checkin: '2099-12-20', checkout: '2099-12-23', num_hospedes: 6, servicos: [], ...dados };
}

const contarLinhas = (tabela) => servidor.db.prepare(`SELECT COUNT(*) AS total FROM ${tabela}`).get().total;

beforeEach(async () => {
  servidor = await iniciarServidorTeste();
  const anfitriao = await entrarComo('anfitriao', 'Ana Souza');
  const prestador = await entrarComo('prestador', 'Paulo Andrade');
  villa = criarImovel(servidor.db, anfitriao.id, { titulo: 'Villa Vista Mar' });
  mordomo = criarServico(servidor.db, prestador.id, { tipo_servico: 'mordomo', preco: 80000 });
  contas = { anfitriao, prestador, hospede: await entrarComo('hospede', 'Hugo Lima') };
});

afterEach(async () => {
  await servidor.fechar();
  assert.deepEqual(servidor.errosRegistrados, [], 'nenhum erro 500 deveria ter acontecido');
});

test('anfitrião cadastra, edita, desativa, reordena e remove inclusos do próprio imóvel', async () => {
  const { caseiro, cafe, lenha } = await cadastrarTresInclusos();
  assert.deepEqual(
    { nome: caseiro.nome, preco: caseiro.preco, unidade_preco: caseiro.unidade_preco, status: caseiro.status, ordem: caseiro.ordem },
    { nome: 'Caseiro', preco: 15000, unidade_preco: 'noite', status: 'ativo', ordem: 1 },
  );
  assert.equal(lenha.ordem, 3, 'cada novo incluso entra no fim da lista');

  const editado = await contas.anfitriao.put(`${caminhoInclusos()}/${cafe.id}`, { nome: 'Café colonial', preco: '95,00', unidade_preco: 'hospede' });
  assert.equal(editado.status, 200);
  assert.equal(editado.corpo.incluso.preco, 9500);

  const desativado = await contas.anfitriao.patch(`${caminhoInclusos()}/${lenha.id}/status`, { status: 'inativo' });
  assert.equal(desativado.corpo.incluso.status, 'inativo');

  const reordenado = await contas.anfitriao.put(`${caminhoInclusos()}/ordem`, { inclusos: [lenha.id, caseiro.id, cafe.id] });
  assert.deepEqual(reordenado.corpo.inclusos.map((incluso) => incluso.nome), ['Lenha', 'Caseiro', 'Café colonial']);
  const incompleto = await contas.anfitriao.put(`${caminhoInclusos()}/ordem`, { inclusos: [lenha.id, caseiro.id] });
  assert.equal(incompleto.status, 400);

  const removido = await contas.anfitriao.delete(`${caminhoInclusos()}/${caseiro.id}`);
  assert.deepEqual(removido.corpo.inclusos.map((incluso) => incluso.nome), ['Lenha', 'Café colonial']);

  const { corpo } = await contas.anfitriao.get(caminhoInclusos());
  assert.equal(corpo.inclusos.length, 2, 'a lista do painel mostra também os inativos');
});

test('dados inválidos → 400 campo por campo; limite de 15 inclusos por imóvel', async () => {
  const invalido = await contas.anfitriao.post(caminhoInclusos(), { nome: 'ab', preco: 0, unidade_preco: 'diaria' });
  assert.equal(invalido.status, 400);
  assert.deepEqual(Object.keys(invalido.corpo.erro.detalhes).sort(), ['nome', 'preco', 'unidade_preco']);

  for (let numero = 1; numero <= 15; numero += 1) {
    await cadastrarIncluso({ nome: `Serviço ${numero}`, preco: 10, unidade_preco: 'estadia' });
  }
  const decimoSexto = await contas.anfitriao.post(caminhoInclusos(), { nome: 'Serviço 16', preco: 10, unidade_preco: 'estadia' });
  assert.equal(decimoSexto.status, 400);
  assert.equal(decimoSexto.corpo.erro.codigo, 'LIMITE_INCLUSOS');
});

test('imóvel de outro anfitrião → 404 em tudo; incluso de outro imóvel → 404; hóspede → 403', async () => {
  const { caseiro } = await cadastrarTresInclusos();
  const outroAnfitriao = await entrarComo('anfitriao');

  for (const resposta of [
    await outroAnfitriao.get(caminhoInclusos()),
    await outroAnfitriao.post(caminhoInclusos(), { nome: 'Invasor', preco: 1, unidade_preco: 'estadia' }),
    await outroAnfitriao.put(`${caminhoInclusos()}/${caseiro.id}`, { nome: 'Invasor', preco: 1, unidade_preco: 'estadia' }),
    await outroAnfitriao.patch(`${caminhoInclusos()}/${caseiro.id}/status`, { status: 'inativo' }),
    await outroAnfitriao.delete(`${caminhoInclusos()}/${caseiro.id}`),
  ]) {
    assert.equal(resposta.status, 404);
    assert.equal(resposta.corpo.erro.codigo, 'IMOVEL_NAO_ENCONTRADO');
  }

  // Mesmo dono, mas o incluso é de outro imóvel dele
  const outraCasa = criarImovel(servidor.db, contas.anfitriao.id, { titulo: 'Casa da Serra' });
  const trocado = await contas.anfitriao.put(`${caminhoInclusos(outraCasa)}/${caseiro.id}`, { nome: 'Caseiro', preco: 1, unidade_preco: 'noite' });
  assert.equal(trocado.status, 404);
  assert.equal(trocado.corpo.erro.codigo, 'SERVICO_INCLUSO_NAO_ENCONTRADO');

  assert.equal((await contas.hospede.get(caminhoInclusos())).status, 403);
  assert.equal(servidor.db.prepare('SELECT nome FROM imovel_servicos_inclusos WHERE id = ?').get(caseiro.id).nome, 'Caseiro');
});

test('página pública do imóvel mostra só os inclusos ativos, na ordem do anfitrião, sem login', async () => {
  const { caseiro, cafe, lenha } = await cadastrarTresInclusos();
  await contas.anfitriao.patch(`${caminhoInclusos()}/${cafe.id}/status`, { status: 'inativo' });
  await contas.anfitriao.put(`${caminhoInclusos()}/ordem`, { inclusos: [lenha.id, cafe.id, caseiro.id] });

  const { status, corpo } = await criarNavegador(servidor.urlBase).get(`/api/imoveis/${villa}`);
  assert.equal(status, 200);
  assert.deepEqual(corpo.inclusos, [
    { id: lenha.id, nome: 'Lenha', descricao: null, preco: 12000, unidade_preco: 'estadia' },
    { id: caseiro.id, nome: 'Caseiro', descricao: 'Fica na casa do caseiro, ao lado', preco: 15000, unidade_preco: 'noite' },
  ]);
});

test('reserva com todos os inclusos: quantidade pela unidade, comissão de 12% e nome/preço congelados', async () => {
  const { caseiro, cafe, lenha } = await cadastrarTresInclusos();
  const resposta = await contas.hospede.post(
    '/api/reservas',
    pedido({ inclusos: [caseiro.id, cafe.id, lenha.id], servicos: [{ servico_id: mordomo, data_servico: '2099-12-21', quantidade: 2 }] }),
  );
  assert.equal(resposta.status, 201, JSON.stringify(resposta.corpo));
  const { reserva } = resposta.corpo;

  // Inclusos: 150 × 3 noites + 80 × 6 hóspedes + 120 = 1.050
  assert.equal(reserva.valor_hospedagem, 750000);
  assert.equal(reserva.valor_inclusos, 105000);
  assert.equal(reserva.valor_servicos_premium, 160000);
  assert.equal(reserva.valor_servicos, 265000);
  assert.equal(reserva.valor_total, 1015000);
  assert.deepEqual(
    reserva.inclusos.map(({ nome, unidade_preco, quantidade, preco_contratado, subtotal }) => ({ nome, unidade_preco, quantidade, preco_contratado, subtotal })),
    [
      { nome: 'Caseiro', unidade_preco: 'noite', quantidade: 3, preco_contratado: 15000, subtotal: 45000 },
      { nome: 'Café da manhã', unidade_preco: 'hospede', quantidade: 6, preco_contratado: 8000, subtotal: 48000 },
      { nome: 'Lenha', unidade_preco: 'estadia', quantidade: 1, preco_contratado: 12000, subtotal: 12000 },
    ],
  );

  // RN19: 12% sobre hospedagem e inclusos, 15% sobre o mordomo
  const gravada = servidor.db.prepare('SELECT valor_comissao FROM reservas WHERE id = ?').get(reserva.id);
  assert.equal(gravada.valor_comissao, 90000 + 12600 + 24000);
  const comissoesInclusos = servidor.db.prepare('SELECT valor_comissao FROM reserva_inclusos WHERE reserva_id = ? ORDER BY id').all(reserva.id);
  assert.deepEqual(comissoesInclusos.map((linha) => linha.valor_comissao), [5400, 5760, 1440]);

  // O anfitrião recebe hospedagem + inclusos − 12%
  const { corpo: recebidas } = await contas.anfitriao.get('/api/reservas-recebidas');
  assert.equal(recebidas.reservas[0].repasse_anfitriao, 660000 + 92400);
  assert.equal(recebidas.reservas[0].inclusos.length, 3);

  // O anfitrião muda o preço e o nome depois: a reserva não muda
  await contas.anfitriao.put(`${caminhoInclusos()}/${caseiro.id}`, { nome: 'Caseiro 24h', preco: 999, unidade_preco: 'noite' });
  const { corpo: minhas } = await contas.hospede.get('/api/reservas');
  assert.equal(minhas.reservas[0].inclusos[0].nome, 'Caseiro');
  assert.equal(minhas.reservas[0].inclusos[0].preco_contratado, 15000);
  assert.equal(minhas.reservas[0].valor_total, 1015000);
});

test('reserva com parte dos inclusos e sem nenhum: só o que o hóspede manteve é cobrado', async () => {
  const { caseiro, lenha } = await cadastrarTresInclusos();

  const parte = await contas.hospede.post('/api/reservas', pedido({ inclusos: [lenha.id, caseiro.id] }));
  assert.equal(parte.status, 201, JSON.stringify(parte.corpo));
  assert.equal(parte.corpo.reserva.valor_inclusos, 57000);
  assert.equal(parte.corpo.reserva.valor_total, 807000);
  assert.deepEqual(parte.corpo.reserva.inclusos.map((incluso) => incluso.nome), ['Caseiro', 'Lenha'], 'na ordem do anfitrião');

  await contas.hospede.post(`/api/reservas/${parte.corpo.reserva.id}/desistir`);
  const nenhum = await contas.hospede.post('/api/reservas', pedido({ inclusos: [] }));
  assert.equal(nenhum.status, 201);
  assert.equal(nenhum.corpo.reserva.valor_inclusos, 0);
  assert.equal(nenhum.corpo.reserva.valor_total, 750000);
  assert.deepEqual(nenhum.corpo.reserva.inclusos, []);

  const { corpo: recebidas } = await contas.anfitriao.get('/api/reservas-recebidas');
  const semInclusos = recebidas.reservas.find((reserva) => reserva.id === nenhum.corpo.reserva.id);
  assert.equal(semInclusos.repasse_anfitriao, 660000);
});

test('preço adulterado no navegador é ignorado: inclusos recalculados pelo banco', async () => {
  const { caseiro } = await cadastrarTresInclusos();
  const resposta = await contas.hospede.post('/api/reservas', {
    ...pedido({ inclusos: [caseiro.id] }),
    valor_inclusos: 1,
    valor_total: 1,
    inclusos_detalhados: [{ id: caseiro.id, preco: 1, quantidade: 1 }],
  });
  assert.equal(resposta.status, 201);
  assert.equal(resposta.corpo.reserva.valor_inclusos, 45000);
  assert.equal(resposta.corpo.reserva.valor_total, 795000);
});

test('RN21: incluso inativo, de outro imóvel ou inexistente → 422 e nada é gravado', async () => {
  const { caseiro, cafe } = await cadastrarTresInclusos();
  await contas.anfitriao.patch(`${caminhoInclusos()}/${cafe.id}/status`, { status: 'inativo' });
  const outraCasa = criarImovel(servidor.db, contas.anfitriao.id, { titulo: 'Casa da Serra' });
  const deOutraCasa = await cadastrarIncluso({ nome: 'Piscineiro', preco: 200, unidade_preco: 'estadia' }, outraCasa);

  for (const inclusoId of [cafe.id, deOutraCasa.id, 99999]) {
    const resposta = await contas.hospede.post('/api/reservas', pedido({ inclusos: [caseiro.id, inclusoId] }));
    assert.equal(resposta.status, 422);
    assert.equal(resposta.corpo.erro.codigo, 'SERVICO_INCLUSO_INDISPONIVEL');
    assert.deepEqual(resposta.corpo.erro.detalhes, { incluso_id: inclusoId });
  }
  assert.equal(contarLinhas('reservas'), 0);
  assert.equal(contarLinhas('reserva_inclusos'), 0);

  const quebrado = await contas.hospede.post('/api/reservas', pedido({ inclusos: 'todos' }));
  assert.equal(quebrado.status, 400);
});

test('incluso já contratado não pode ser removido (409); desativar continua possível', async () => {
  const { caseiro } = await cadastrarTresInclusos();
  await contas.hospede.post('/api/reservas', pedido({ inclusos: [caseiro.id] }));

  const remover = await contas.anfitriao.delete(`${caminhoInclusos()}/${caseiro.id}`);
  assert.equal(remover.status, 409);
  assert.equal(remover.corpo.erro.codigo, 'SERVICO_INCLUSO_CONTRATADO');
  const desativar = await contas.anfitriao.patch(`${caminhoInclusos()}/${caseiro.id}/status`, { status: 'inativo' });
  assert.equal(desativar.status, 200);
});

test('busca: filtro com_inclusos=1 e qtd_inclusos (só ativos) em cada imóvel', async () => {
  const semInclusos = criarImovel(servidor.db, contas.anfitriao.id, { titulo: 'Casa sem extras' });
  const soInativo = criarImovel(servidor.db, contas.anfitriao.id, { titulo: 'Casa com incluso desligado' });
  await cadastrarTresInclusos();
  const desligado = await cadastrarIncluso({ nome: 'Enxoval', preco: 300, unidade_preco: 'estadia' }, soInativo);
  await contas.anfitriao.patch(`${caminhoInclusos(soInativo)}/${desligado.id}/status`, { status: 'inativo' });

  const visitante = criarNavegador(servidor.urlBase);
  const todos = await visitante.get('/api/imoveis');
  const quantidades = Object.fromEntries(todos.corpo.imoveis.map((imovel) => [imovel.id, imovel.qtd_inclusos]));
  assert.deepEqual(quantidades, { [villa]: 3, [semInclusos]: 0, [soInativo]: 0 });

  const filtrados = await visitante.get('/api/imoveis?com_inclusos=1');
  assert.deepEqual(filtrados.corpo.imoveis.map((imovel) => imovel.id), [villa]);
  assert.equal(filtrados.corpo.total, 1);

  assert.equal((await visitante.get('/api/imoveis?com_inclusos=talvez')).status, 400);
});

test('anfitrião cadastra imóvel do tipo "sitio"', async () => {
  const resposta = await contas.anfitriao.post('/api/meus-imoveis', {
    titulo: 'Sítio Recanto das Águas',
    tipo_imovel: 'sitio',
    endereco: 'Estrada do Vale, km 3',
    cidade: 'Itaipava',
    estado: 'RJ',
    diaria: '900,00',
    num_hospedes: 10,
    num_quartos: 5,
  });
  assert.equal(resposta.status, 201, JSON.stringify(resposta.corpo));
  assert.equal(resposta.corpo.imovel.tipo_imovel, 'sitio');
  const busca = await criarNavegador(servidor.urlBase).get('/api/imoveis?tipo=sitio');
  assert.equal(busca.status, 200);
});
