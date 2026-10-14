// Cenários de "Avaliações" do SPEC.md §5 (H7, RN11), via HTTP real.
// As datas são relativas a hoje em Brasília: a avaliação depende de o checkout já ter passado
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidorTeste, criarNavegador } = require('../ajudantes/servidorTeste');
const { criarUsuario, criarImovel, criarServico, criarReserva, avaliar } = require('../ajudantes/dadosBanco');
const { hojeEmBrasilia } = require('../../src/dominio/periodo');

let servidor;
let villa;
let mordomo;
let barman;
let contador = 0;
let contas;

function diasAPartirDeHoje(dias) {
  return new Date(Date.parse(`${hojeEmBrasilia()}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

async function entrarComo(tipo, nome = `Pessoa ${tipo}`) {
  contador += 1;
  const navegador = criarNavegador(servidor.urlBase);
  const { corpo } = await navegador.post('/api/auth/cadastro', {
    nome,
    email: `avaliacao${contador}@x.com`,
    senha: 'senhaForte123',
    tipo,
  });
  navegador.id = corpo.usuario.id;
  servidor.db.prepare('UPDATE usuarios SET recebimento_ativo = 1 WHERE id = ?').run(navegador.id);
  return navegador;
}

// Estadia já paga (confirmada) com checkout `checkoutHaDias` dias atrás e o mordomo contratado
function estadia({ checkoutHaDias = 1, noites = 3, status = 'confirmada', hospedeId = contas.hospede.id, imovelId = villa } = {}) {
  const checkout = diasAPartirDeHoje(-checkoutHaDias);
  const checkin = diasAPartirDeHoje(-checkoutHaDias - noites);
  const reservaId = criarReserva(servidor.db, { hospedeId, imovelId, checkin, checkout, status });
  servidor.db
    .prepare('INSERT INTO reserva_servicos (reserva_id, servico_id, data_servico, preco_contratado) VALUES (?, ?, ?, 80000)')
    .run(reservaId, mordomo, checkin);
  return reservaId;
}

const notaDoImovel = (dados = {}) => ({ tipo_alvo: 'imovel', alvo_id: villa, nota: 5, comentario: 'Impecável', ...dados });

beforeEach(async () => {
  servidor = await iniciarServidorTeste();
  const anfitriao = await entrarComo('anfitriao', 'Ana Souza');
  const prestador = await entrarComo('prestador', 'Paulo Andrade');
  villa = criarImovel(servidor.db, anfitriao.id, { titulo: 'Villa Vista Mar' });
  mordomo = criarServico(servidor.db, prestador.id, { tipo_servico: 'mordomo' });
  barman = criarServico(servidor.db, prestador.id, { tipo_servico: 'barman' });
  contas = { anfitriao, prestador, hospede: await entrarComo('hospede', 'Hugo Lima') };
});

afterEach(async () => {
  await servidor.fechar();
  assert.deepEqual(servidor.errosRegistrados, [], 'nenhum erro 500 deveria ter acontecido');
});

test('SPEC: avaliar após a estadia salva a avaliação e atualiza a nota média do imóvel', async () => {
  const reservaId = estadia({ checkoutHaDias: 1 });

  const { corpo: lista } = await contas.hospede.get('/api/reservas');
  assert.equal(lista.reservas[0].status, 'concluida', 'RN11: concluída automaticamente depois do checkout');
  assert.equal(lista.reservas[0].avaliacao.situacao, 'liberada');
  assert.equal(lista.reservas[0].avaliacao.ultimo_dia, diasAPartirDeHoje(13));
  assert.deepEqual(lista.reservas[0].avaliacao.feitas, []);

  const resposta = await contas.hospede.post(`/api/reservas/${reservaId}/avaliacoes`, notaDoImovel());
  assert.equal(resposta.status, 201, JSON.stringify(resposta.corpo));
  assert.equal(resposta.corpo.avaliacao.nota, 5);
  assert.equal(resposta.corpo.avaliacao.comentario, 'Impecável');

  const visitante = criarNavegador(servidor.urlBase);
  const { corpo: pagina } = await visitante.get(`/api/imoveis/${villa}`);
  assert.equal(pagina.imovel.nota_media, 5);
  assert.equal(pagina.imovel.total_avaliacoes, 1);

  const { status, corpo } = await visitante.get(`/api/imoveis/${villa}/avaliacoes`);
  assert.equal(status, 200, 'H7.2: visitante lê os comentários sem login');
  assert.equal(corpo.nota_media, 5);
  assert.equal(corpo.avaliacoes.length, 1);
  assert.equal(corpo.avaliacoes[0].autor, 'Hugo', 'só o primeiro nome de quem avaliou');
  assert.equal(corpo.avaliacoes[0].comentario, 'Impecável');

  const { corpo: depois } = await contas.hospede.get('/api/reservas');
  assert.equal(depois.reservas[0].avaliacao.feitas.length, 1, '"Minhas reservas" mostra o que já foi avaliado');
  assert.equal(depois.reservas[0].avaliacao.feitas[0].tipo_alvo, 'imovel');
});

test('SPEC: avaliar antes do checkout responde 422 "Avaliação liberada após o checkout"', async () => {
  const noDiaDoCheckout = estadia({ checkoutHaDias: 0 });

  const resposta = await contas.hospede.post(`/api/reservas/${noDiaDoCheckout}/avaliacoes`, notaDoImovel());

  assert.equal(resposta.status, 422);
  assert.equal(resposta.corpo.erro.mensagem, 'Avaliação liberada após o checkout');
  const { corpo } = await contas.hospede.get('/api/reservas');
  assert.equal(corpo.reservas[0].status, 'confirmada', 'no dia do checkout a estadia ainda não terminou');
  assert.equal(corpo.reservas[0].avaliacao.situacao, 'aguardando_checkout');
});

test('SPEC: avaliar serviço não contratado (ou outro imóvel) responde 422', async () => {
  const reservaId = estadia();
  const outroImovel = criarImovel(servidor.db, contas.anfitriao.id, { titulo: 'Chalé da Serra' });

  const servico = await contas.hospede.post(`/api/reservas/${reservaId}/avaliacoes`, { tipo_alvo: 'servico', alvo_id: barman, nota: 4 });
  const imovel = await contas.hospede.post(`/api/reservas/${reservaId}/avaliacoes`, notaDoImovel({ alvo_id: outroImovel }));

  assert.equal(servico.status, 422);
  assert.equal(servico.corpo.erro.codigo, 'ALVO_FORA_DA_RESERVA');
  assert.equal(imovel.status, 422);
  assert.equal(servidor.db.prepare('SELECT COUNT(*) AS total FROM avaliacoes').get().total, 0);
});

test('SPEC: avaliação repetida responde 409; imóvel e serviço da mesma reserva são avaliados à parte', async () => {
  const reservaId = estadia();

  const imovel = await contas.hospede.post(`/api/reservas/${reservaId}/avaliacoes`, notaDoImovel());
  const servico = await contas.hospede.post(`/api/reservas/${reservaId}/avaliacoes`, {
    tipo_alvo: 'servico',
    alvo_id: mordomo,
    nota: 4,
    comentario: 'Muito atencioso',
  });
  const repetida = await contas.hospede.post(`/api/reservas/${reservaId}/avaliacoes`, notaDoImovel({ nota: 1 }));

  assert.equal(imovel.status, 201);
  assert.equal(servico.status, 201);
  assert.equal(repetida.status, 409);
  assert.equal(repetida.corpo.erro.codigo, 'AVALIACAO_REPETIDA');

  const { corpo } = await criarNavegador(servidor.urlBase).get(`/api/servicos/${mordomo}/avaliacoes`);
  assert.equal(corpo.nota_media, 4, 'H7.2: nota do prestador naquele serviço');
  assert.equal(corpo.avaliacoes[0].comentario, 'Muito atencioso');
  const { corpo: notaImovel } = await criarNavegador(servidor.urlBase).get(`/api/imoveis/${villa}/avaliacoes`);
  assert.equal(notaImovel.nota_media, 5, 'a tentativa repetida não mudou a nota');
});

test('SPEC: checkout há 15 dias responde 422 "Prazo de avaliação encerrado"; há 14 dias ainda dá', async () => {
  const encerrada = estadia({ checkoutHaDias: 15 });
  const ultimoDia = estadia({ checkoutHaDias: 14 });

  const tarde = await contas.hospede.post(`/api/reservas/${encerrada}/avaliacoes`, notaDoImovel());
  const noLimite = await contas.hospede.post(`/api/reservas/${ultimoDia}/avaliacoes`, notaDoImovel());

  assert.equal(tarde.status, 422);
  assert.equal(tarde.corpo.erro.mensagem, 'Prazo de avaliação encerrado');
  assert.equal(noLimite.status, 201);
});

test('só o próprio hóspede avalia, e só estadias que aconteceram', async () => {
  const outroHospede = await entrarComo('hospede', 'Olga Reis');
  const reservaDoHugo = estadia();
  const cancelada = estadia({ status: 'cancelada' });
  const visitante = criarNavegador(servidor.urlBase);

  assert.equal((await outroHospede.post(`/api/reservas/${reservaDoHugo}/avaliacoes`, notaDoImovel())).status, 404);
  assert.equal((await contas.anfitriao.post(`/api/reservas/${reservaDoHugo}/avaliacoes`, notaDoImovel())).status, 403);
  assert.equal((await visitante.post(`/api/reservas/${reservaDoHugo}/avaliacoes`, notaDoImovel())).status, 401);
  assert.equal((await contas.hospede.post('/api/reservas/999999/avaliacoes', notaDoImovel())).status, 404);
  assert.equal((await contas.hospede.post('/api/reservas/abc/avaliacoes', notaDoImovel())).status, 404);

  const naCancelada = await contas.hospede.post(`/api/reservas/${cancelada}/avaliacoes`, notaDoImovel());
  assert.equal(naCancelada.status, 422);
  assert.equal(naCancelada.corpo.erro.codigo, 'RESERVA_NAO_AVALIAVEL');
});

test('dados inválidos respondem 400 com os campos', async () => {
  const reservaId = estadia();

  const resposta = await contas.hospede.post(`/api/reservas/${reservaId}/avaliacoes`, {
    tipo_alvo: 'imovel',
    alvo_id: villa,
    nota: 0,
    comentario: 'x'.repeat(1001),
  });

  assert.equal(resposta.status, 400);
  assert.deepEqual(Object.keys(resposta.corpo.erro.detalhes).sort(), ['comentario', 'nota']);
});

test('anfitrião e prestador também veem a estadia como concluída', async () => {
  estadia();

  const { corpo: recebidas } = await contas.anfitriao.get('/api/reservas-recebidas');
  const { corpo: agenda } = await contas.prestador.get('/api/agenda');

  assert.equal(recebidas.reservas[0].status, 'concluida');
  assert.equal(agenda.agenda[0].reserva.status, 'concluida');
});

test('lista de avaliações: mais recentes primeiro, 10 por página; imóvel fora do site responde 404', async () => {
  for (let indice = 1; indice <= 12; indice += 1) {
    const hospedeId = criarUsuario(servidor.db, 'hospede', { nome: `Hóspede ${indice}` });
    const reservaId = estadia({ hospedeId, checkoutHaDias: 1 + indice });
    avaliar(servidor.db, { reservaId, autorId: hospedeId, tipoAlvo: 'imovel', alvoId: villa, nota: indice % 2 === 0 ? 5 : 4 });
  }
  const visitante = criarNavegador(servidor.urlBase);

  const { corpo: primeira } = await visitante.get(`/api/imoveis/${villa}/avaliacoes`);
  const { corpo: segunda } = await visitante.get(`/api/imoveis/${villa}/avaliacoes?pagina=2`);

  assert.equal(primeira.total_avaliacoes, 12);
  assert.equal(primeira.nota_media, 4.5);
  assert.equal(primeira.avaliacoes.length, 10);
  assert.equal(primeira.total_paginas, 2);
  assert.equal(primeira.avaliacoes[0].id > primeira.avaliacoes[1].id, true, 'a mais nova primeiro');
  assert.equal(segunda.avaliacoes.length, 2);
  assert.equal((await visitante.get(`/api/imoveis/${villa}/avaliacoes?pagina=x`)).status, 400);

  servidor.db.prepare("UPDATE imoveis SET status = 'inativo' WHERE id = ?").run(villa);
  assert.equal((await visitante.get(`/api/imoveis/${villa}/avaliacoes`)).status, 404);
  assert.equal((await visitante.get('/api/servicos/999999/avaliacoes')).status, 404);
});
