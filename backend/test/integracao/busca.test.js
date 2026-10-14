// Cenários de "Busca de Imóveis" do SPEC.md §5 e página do imóvel (H5.1), via HTTP real.
// Sem login: o visitante navega livre (RN16). Datas em 2099 para nunca ficarem no passado
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidorTeste, criarNavegador } = require('../ajudantes/servidorTeste');
const { criarUsuario, criarImovel, criarServico, criarReserva } = require('../ajudantes/dadosBanco');

let servidor;
let visitante;
let anfitriao;
let hospede;

beforeEach(async () => {
  servidor = await iniciarServidorTeste();
  visitante = criarNavegador(servidor.urlBase);
  anfitriao = criarUsuario(servidor.db, 'anfitriao', { nome: 'Ana Souza' });
  hospede = criarUsuario(servidor.db, 'hospede');
});

afterEach(async () => {
  await servidor.fechar();
  assert.deepEqual(servidor.errosRegistrados, [], 'nenhum erro 500 deveria ter acontecido');
});

async function buscar(consulta) {
  const resposta = await visitante.get(`/api/imoveis?${new URLSearchParams(consulta)}`);
  assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));
  return resposta.corpo;
}

async function titulos(consulta) {
  return (await buscar(consulta)).imoveis.map((imovel) => imovel.titulo).sort();
}

test('reserva confirmada de 20/12 a 23/12 tira a villa da busca de Búzios de 21/12 a 24/12', async () => {
  const villa = criarImovel(servidor.db, anfitriao, { titulo: 'Villa Vista Mar' });
  criarReserva(servidor.db, { hospedeId: hospede, imovelId: villa, checkin: '2099-12-20', checkout: '2099-12-23' });

  assert.deepEqual(await titulos({ cidade: 'búzios', checkin: '2099-12-21', checkout: '2099-12-24' }), []);
});

test('checkout no mesmo dia do checkin de outra reserva: a villa aparece', async () => {
  const villa = criarImovel(servidor.db, anfitriao, { titulo: 'Villa Vista Mar' });
  criarReserva(servidor.db, { hospedeId: hospede, imovelId: villa, checkin: '2099-12-20', checkout: '2099-12-23' });

  assert.deepEqual(await titulos({ checkin: '2099-12-23', checkout: '2099-12-26' }), ['Villa Vista Mar']);
});

test('reserva pendente criada há 31 minutos sem pagamento não bloqueia', async () => {
  const villa = criarImovel(servidor.db, anfitriao, { titulo: 'Villa Vista Mar' });
  const datas = { checkin: '2099-12-20', checkout: '2099-12-23' };
  criarReserva(servidor.db, { hospedeId: hospede, imovelId: villa, ...datas, status: 'pendente', minutosAtras: 31 });

  assert.deepEqual(await titulos(datas), ['Villa Vista Mar']);
});

test('filtro "mordomo": só imóveis em cidades com mordomo ativo; o cartão lista os serviços da cidade', async () => {
  criarImovel(servidor.db, anfitriao, { titulo: 'Villa em Búzios' });
  criarImovel(servidor.db, anfitriao, { titulo: 'Casa em Paraty', cidade: 'Paraty' });
  const prestador = criarUsuario(servidor.db, 'prestador');
  criarServico(servidor.db, prestador, { tipo_servico: 'mordomo' });
  criarServico(servidor.db, prestador, { tipo_servico: 'motorista' });

  const { imoveis } = await buscar({ servicos: 'mordomo' });
  assert.deepEqual(imoveis.map((imovel) => imovel.titulo), ['Villa em Búzios']);
  assert.deepEqual(imoveis[0].servicos_disponiveis, ['mordomo', 'motorista']);
});

test('filtros combinados (Búzios, 6 hóspedes, villa, R$ 1.000 a R$ 3.000) e paginação de 20', async () => {
  for (let numero = 1; numero <= 21; numero += 1) {
    criarImovel(servidor.db, anfitriao, { titulo: `Villa certa ${numero}`, num_hospedes: 6, preco_diaria: 200000 });
  }
  criarImovel(servidor.db, anfitriao, { titulo: 'Pequena', num_hospedes: 4 });
  criarImovel(servidor.db, anfitriao, { titulo: 'Cara', preco_diaria: 300001 });
  criarImovel(servidor.db, anfitriao, { titulo: 'Casa', tipo_imovel: 'casa' });
  criarImovel(servidor.db, anfitriao, { titulo: 'Em Trancoso', cidade: 'Trancoso', estado: 'BA' });

  const filtros = { cidade: 'Búzios', hospedes: '6', tipo: 'villa', preco_min: '1000', preco_max: '3000' };
  const primeira = await buscar(filtros);
  const segunda = await buscar({ ...filtros, pagina: '2' });

  assert.equal(primeira.total, 21);
  assert.equal(primeira.total_paginas, 2);
  assert.equal(primeira.por_pagina, 20);
  assert.equal(primeira.imoveis.length, 20);
  assert.equal(segunda.pagina, 2);
  assert.equal(segunda.imoveis.length, 1);
  const todos = [...primeira.imoveis, ...segunda.imoveis];
  assert.ok(todos.every((imovel) => imovel.titulo.startsWith('Villa certa')));
});

test('RN12 e RN13: busca e página do imóvel sem endereço; inativo, sem foto ou sem recebimento não aparecem', async () => {
  const visivel = criarImovel(servidor.db, anfitriao, { titulo: 'Visível' }, { fotos: 2 });
  const inativo = criarImovel(servidor.db, anfitriao, { titulo: 'Inativo', status: 'inativo' });
  const semFoto = criarImovel(servidor.db, anfitriao, { titulo: 'Sem foto' }, { fotos: 0 });
  const donoSemStripe = criarUsuario(servidor.db, 'anfitriao', { recebimentoAtivo: false });
  const semRecebimento = criarImovel(servidor.db, donoSemStripe, { titulo: 'Sem recebimento' });

  const { imoveis } = await buscar({});
  assert.deepEqual(imoveis.map((imovel) => imovel.titulo), ['Visível']);
  assert.equal('endereco' in imoveis[0], false);
  assert.deepEqual(imoveis[0].fotos, [`/uploads/${visivel}-1.jpg`, `/uploads/${visivel}-2.jpg`]);

  const pagina = await visitante.get(`/api/imoveis/${visivel}`);
  assert.equal(pagina.status, 200);
  assert.equal(pagina.corpo.imovel.titulo, 'Visível');
  assert.equal(pagina.corpo.imovel.anfitriao, 'Ana Souza');
  assert.equal('endereco' in pagina.corpo.imovel, false, 'endereço só depois da reserva confirmada');

  for (const id of [inativo, semFoto, semRecebimento, 9999]) {
    const resposta = await visitante.get(`/api/imoveis/${id}`);
    assert.equal(resposta.status, 404);
    assert.equal(resposta.corpo.erro.codigo, 'IMOVEL_NAO_ENCONTRADO');
  }
});

test('H5.1: a página do imóvel traz os serviços premium da cidade, com o nome do prestador', async () => {
  const villa = criarImovel(servidor.db, anfitriao);
  const paulo = criarUsuario(servidor.db, 'prestador', { nome: 'Paulo Andrade' });
  criarServico(servidor.db, paulo, { tipo_servico: 'mordomo' });
  criarServico(servidor.db, paulo, { tipo_servico: 'barman', cidade_atuacao: 'Paraty' });

  const { corpo } = await visitante.get(`/api/imoveis/${villa}`);
  assert.deepEqual(corpo.servicos.map((servico) => [servico.tipo_servico, servico.prestador]), [['mordomo', 'Paulo Andrade']]);
  assert.deepEqual(corpo.imovel.servicos_disponiveis, ['mordomo']);
  assert.equal(corpo.imovel.nota_media, null);
  assert.equal(corpo.imovel.total_avaliacoes, 0);
});

test('disponibilidade do imóvel nas datas escolhidas (livre/ocupado, sem expor a agenda)', async () => {
  const villa = criarImovel(servidor.db, anfitriao);
  criarReserva(servidor.db, { hospedeId: hospede, imovelId: villa, checkin: '2099-12-20', checkout: '2099-12-23' });
  const disponibilidade = (consulta) => visitante.get(`/api/imoveis/${villa}/disponibilidade?${new URLSearchParams(consulta)}`);

  const ocupado = await disponibilidade({ checkin: '2099-12-21', checkout: '2099-12-24' });
  assert.deepEqual(ocupado.corpo, { checkin: '2099-12-21', checkout: '2099-12-24', noites: 3, livre: false });

  const livre = await disponibilidade({ checkin: '2099-12-23', checkout: '2099-12-26' });
  assert.equal(livre.corpo.livre, true);

  const semDatas = await disponibilidade({});
  assert.equal(semDatas.status, 422);
  assert.equal(semDatas.corpo.erro.codigo, 'PERIODO_INVALIDO');

  assert.equal((await visitante.get('/api/imoveis/9999/disponibilidade?checkin=2099-12-01&checkout=2099-12-03')).status, 404);
});

test('parâmetros inválidos: 400 por campo; datas no passado ou só uma delas → 422', async () => {
  const invalido = await visitante.get('/api/imoveis?tipo=castelo&hospedes=0');
  assert.equal(invalido.status, 400);
  assert.deepEqual(Object.keys(invalido.corpo.erro.detalhes).sort(), ['hospedes', 'tipo']);

  assert.equal((await visitante.get('/api/imoveis?checkin=2020-01-01&checkout=2020-01-05')).status, 422);
  assert.equal((await visitante.get('/api/imoveis?checkin=2099-01-01')).status, 422);
  assert.equal((await visitante.get('/api/imoveis?checkin=2099-01-01&checkout=2099-03-01')).status, 422, 'mais de 30 noites');
});

test('texto malicioso nos filtros é só texto: nenhum resultado e nenhum erro', async () => {
  criarImovel(servidor.db, anfitriao);
  assert.deepEqual(await titulos({ cidade: "Búzios' OR '1'='1" }), []);
});

test('GET /api/cidades: cidades com imóvel ou serviço visível, em ordem alfabética', async () => {
  criarImovel(servidor.db, anfitriao, { cidade: 'Trancoso', estado: 'BA' });
  criarImovel(servidor.db, anfitriao);
  criarImovel(servidor.db, anfitriao, { cidade: 'Paraty', status: 'inativo' });
  criarServico(servidor.db, criarUsuario(servidor.db, 'prestador'), { cidade_atuacao: 'Angra dos Reis' });

  const { corpo } = await visitante.get('/api/cidades');
  assert.deepEqual(corpo.cidades, [
    { cidade: 'Angra dos Reis', estado: null },
    { cidade: 'Búzios', estado: 'RJ' },
    { cidade: 'Trancoso', estado: 'BA' },
  ]);
});

test('PERMITIR_SEM_RECEBIMENTO (só desenvolvimento) mostra donos ainda sem Stripe', async () => {
  const desenvolvimento = await iniciarServidorTeste({ permitirSemRecebimento: true });
  try {
    const dono = criarUsuario(desenvolvimento.db, 'anfitriao', { recebimentoAtivo: false });
    criarImovel(desenvolvimento.db, dono, { titulo: 'Sem Stripe ainda' });
    const { corpo } = await criarNavegador(desenvolvimento.urlBase).get('/api/imoveis');
    assert.deepEqual(corpo.imoveis.map((imovel) => imovel.titulo), ['Sem Stripe ainda']);
  } finally {
    await desenvolvimento.fechar();
  }
});
