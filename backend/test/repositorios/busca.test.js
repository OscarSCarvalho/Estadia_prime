// Cenários de "Busca de Imóveis" do SPEC §5 direto no SQL do repositório
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { abrirBanco } = require('../../src/db/database');
const { criarRepositorioBusca } = require('../../src/repositorios/repositorioBusca');
const { criarUsuario, criarImovel, criarServico, criarReserva, avaliar } = require('../ajudantes/dadosBanco');

const PAGINA = { limite: 20, deslocamento: 0 };

let db;
let busca;
let anfitriao;
let hospede;

beforeEach(() => {
  db = abrirBanco(':memory:');
  busca = criarRepositorioBusca(db);
  anfitriao = criarUsuario(db, 'anfitriao', { nome: 'Ana Souza' });
  hospede = criarUsuario(db, 'hospede');
});
afterEach(() => db.close());

function titulosEncontrados(filtros) {
  return busca.buscarImoveis(filtros, PAGINA).imoveis.map((imovel) => imovel.titulo).sort();
}

test('reserva confirmada de 20/12 a 23/12 tira a villa da busca de 21/12 a 24/12', () => {
  const villa = criarImovel(db, anfitriao, { titulo: 'Villa Vista Mar' });
  criarReserva(db, { hospedeId: hospede, imovelId: villa, checkin: '2026-12-20', checkout: '2026-12-23' });

  assert.deepEqual(titulosEncontrados({ cidade: 'Búzios', checkin: '2026-12-21', checkout: '2026-12-24' }), []);
});

test('checkout no mesmo dia do checkin de outra reserva não bloqueia', () => {
  const villa = criarImovel(db, anfitriao, { titulo: 'Villa Vista Mar' });
  criarReserva(db, { hospedeId: hospede, imovelId: villa, checkin: '2026-12-20', checkout: '2026-12-23' });

  assert.deepEqual(titulosEncontrados({ checkin: '2026-12-23', checkout: '2026-12-26' }), ['Villa Vista Mar']);
  assert.deepEqual(titulosEncontrados({ checkin: '2026-12-17', checkout: '2026-12-20' }), ['Villa Vista Mar']);
});

test('RN07: pendente com mais de 30 min não bloqueia; recente e confirmada bloqueiam; cancelada não', () => {
  const datas = { checkin: '2026-12-20', checkout: '2026-12-23' };
  const expirada = criarImovel(db, anfitriao, { titulo: 'Pendente expirada' });
  const recente = criarImovel(db, anfitriao, { titulo: 'Pendente recente' });
  const cancelada = criarImovel(db, anfitriao, { titulo: 'Cancelada' });
  criarReserva(db, { hospedeId: hospede, imovelId: expirada, ...datas, status: 'pendente', minutosAtras: 31 });
  criarReserva(db, { hospedeId: hospede, imovelId: recente, ...datas, status: 'pendente', minutosAtras: 29 });
  criarReserva(db, { hospedeId: hospede, imovelId: cancelada, ...datas, status: 'cancelada' });

  assert.deepEqual(titulosEncontrados(datas), ['Cancelada', 'Pendente expirada']);
  assert.equal(busca.imovelEstaLivre(recente, datas), false);
  assert.equal(busca.imovelEstaLivre(expirada, datas), true);
});

test('filtro por serviço: só cidades com prestador ativo de TODOS os tipos pedidos', () => {
  criarImovel(db, anfitriao, { titulo: 'Villa em Búzios', cidade: 'Búzios' });
  criarImovel(db, anfitriao, { titulo: 'Casa em Paraty', cidade: 'Paraty' });
  const prestador = criarUsuario(db, 'prestador');
  criarServico(db, prestador, { tipo_servico: 'mordomo', cidade_atuacao: 'Búzios' });
  criarServico(db, prestador, { tipo_servico: 'barman', cidade_atuacao: 'Búzios', status: 'inativo' });
  criarServico(db, prestador, { tipo_servico: 'barman', cidade_atuacao: 'Paraty' });

  assert.deepEqual(titulosEncontrados({ servicos: ['mordomo'] }), ['Villa em Búzios']);
  assert.deepEqual(titulosEncontrados({ servicos: ['barman'] }), ['Casa em Paraty']);
  assert.deepEqual(titulosEncontrados({ servicos: ['mordomo', 'barman'] }), []);
  assert.deepEqual(titulosEncontrados({ servicos: [] }), ['Casa em Paraty', 'Villa em Búzios']);
});

test('filtros combinados: cidade, hóspedes, tipo e faixa de diária', () => {
  criarImovel(db, anfitriao, { titulo: 'Certa', num_hospedes: 8, preco_diaria: 250000 });
  criarImovel(db, anfitriao, { titulo: 'Pequena', num_hospedes: 4, preco_diaria: 200000 });
  criarImovel(db, anfitriao, { titulo: 'Cara', preco_diaria: 400000 });
  criarImovel(db, anfitriao, { titulo: 'Barata', preco_diaria: 90000 });
  criarImovel(db, anfitriao, { titulo: 'Casa', tipo_imovel: 'casa' });
  criarImovel(db, anfitriao, { titulo: 'Outra cidade', cidade: 'Trancoso', estado: 'BA' });

  const filtros = { cidade: 'Búzios', hospedes: 6, tipo: 'villa', precoMin: 100000, precoMax: 300000 };
  assert.deepEqual(titulosEncontrados(filtros), ['Certa']);
});

test('RN13: inativo, sem foto ou com anfitrião sem recebimento não aparecem', () => {
  criarImovel(db, anfitriao, { titulo: 'Visível' });
  criarImovel(db, anfitriao, { titulo: 'Inativo', status: 'inativo' });
  criarImovel(db, anfitriao, { titulo: 'Sem foto' }, { fotos: 0 });
  criarImovel(db, criarUsuario(db, 'anfitriao', { recebimentoAtivo: false }), { titulo: 'Sem recebimento' });

  assert.deepEqual(titulosEncontrados({}), ['Visível']);
  const semExigir = criarRepositorioBusca(db, { exigirRecebimento: false });
  const titulos = semExigir.buscarImoveis({}, PAGINA).imoveis.map((imovel) => imovel.titulo).sort();
  assert.deepEqual(titulos, ['Sem recebimento', 'Visível']);
});

test('paginação de 20 em 20 com o total de resultados', () => {
  for (let numero = 1; numero <= 23; numero += 1) criarImovel(db, anfitriao, { titulo: `Imóvel ${numero}` });

  const primeira = busca.buscarImoveis({}, { limite: 20, deslocamento: 0 });
  const segunda = busca.buscarImoveis({}, { limite: 20, deslocamento: 20 });
  assert.equal(primeira.total, 23);
  assert.equal(primeira.imoveis.length, 20);
  assert.equal(segunda.imoveis.length, 3);
  const ids = new Set([...primeira.imoveis, ...segunda.imoveis].map((imovel) => imovel.id));
  assert.equal(ids.size, 23, 'nenhum imóvel repetido entre as páginas');
});

test('ordena por nota (sem avaliação por último) e traz nota média e total', () => {
  const semNota = criarImovel(db, anfitriao, { titulo: 'Sem nota' });
  const nota4 = criarImovel(db, anfitriao, { titulo: 'Nota 4' });
  const nota5 = criarImovel(db, anfitriao, { titulo: 'Nota 4,5' });
  const reserva = criarReserva(db, { hospedeId: hospede, imovelId: semNota, checkin: '2026-01-01', checkout: '2026-01-02' });
  const outroHospede = criarUsuario(db, 'hospede');
  avaliar(db, { reservaId: reserva, autorId: hospede, tipoAlvo: 'imovel', alvoId: nota4, nota: 4 });
  avaliar(db, { reservaId: reserva, autorId: hospede, tipoAlvo: 'imovel', alvoId: nota5, nota: 4 });
  avaliar(db, { reservaId: reserva, autorId: outroHospede, tipoAlvo: 'imovel', alvoId: nota5, nota: 5 });

  const { imoveis } = busca.buscarImoveis({}, PAGINA);
  assert.deepEqual(imoveis.map((imovel) => imovel.titulo), ['Nota 4,5', 'Nota 4', 'Sem nota']);
  assert.equal(imoveis[0].nota_media, 4.5);
  assert.equal(imoveis[0].total_avaliacoes, 2);
  assert.equal(imoveis[0].anfitriao, 'Ana Souza');
  assert.equal('endereco' in imoveis[0], false, 'a busca não carrega o endereço');
});

test('imóvel visível, fotos em ordem, tipos de serviço por cidade e lista de cidades', () => {
  const villa = criarImovel(db, anfitriao, { titulo: 'Villa' }, { fotos: 2 });
  const inativo = criarImovel(db, anfitriao, { status: 'inativo', cidade: 'Paraty' });
  const prestador = criarUsuario(db, 'prestador');
  criarServico(db, prestador, { tipo_servico: 'motorista' });
  criarServico(db, prestador, { tipo_servico: 'mordomo' });
  criarServico(db, prestador, { tipo_servico: 'mordomo' });
  criarServico(db, prestador, { tipo_servico: 'eventos', cidade_atuacao: 'Itaipava' });

  assert.equal(busca.obterImovelVisivel(villa).titulo, 'Villa');
  assert.equal(busca.obterImovelVisivel(inativo), null);
  assert.equal(busca.obterImovelVisivel(9999), null);

  assert.deepEqual(busca.fotosDosImoveis([villa]).get(villa), [`/uploads/${villa}-1.jpg`, `/uploads/${villa}-2.jpg`]);
  assert.deepEqual(busca.tiposDeServicoPorCidade(['Búzios', 'Paraty']).get('Búzios'), ['mordomo', 'motorista']);
  assert.deepEqual(busca.tiposDeServicoPorCidade(['Búzios', 'Paraty']).get('Paraty'), []);

  // Paraty só tem imóvel inativo: não entra
  assert.deepEqual(busca.listarCidades(), [
    { cidade: 'Búzios', estado: 'RJ' },
    { cidade: 'Itaipava', estado: null },
  ]);
});

test('valores maliciosos nos filtros são tratados como texto, nunca como SQL', () => {
  criarImovel(db, anfitriao, { titulo: 'Villa' });
  assert.deepEqual(titulosEncontrados({ cidade: "Búzios' OR '1'='1" }), []);
  assert.deepEqual(titulosEncontrados({ servicos: ["mordomo') OR 1=1 --"] }), []);
});
