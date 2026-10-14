const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { abrirBanco } = require('../../src/db/database');
const { criarRepositorioImoveis } = require('../../src/repositorios/repositorioImoveis');
const { criarRepositorioFotos } = require('../../src/repositorios/repositorioFotos');
const { criarRepositorioServicos } = require('../../src/repositorios/repositorioServicos');
const { ErroLimiteFotos } = require('../../src/dominio/erros');
const { criarUsuario, criarImovel, criarServico, criarReserva } = require('../ajudantes/dadosBanco');

const dadosImovel = {
  titulo: 'Villa Vista Mar',
  descricao: null,
  tipo_imovel: 'villa',
  endereco: 'Rua das Ondas, 10',
  cidade: 'Búzios',
  estado: 'RJ',
  preco_diaria: 250000,
  num_hospedes: 8,
  num_quartos: 4,
};
const dadosServico = { tipo_servico: 'motorista', descricao: null, preco: 90000, unidade_preco: 'diaria', cidade_atuacao: 'Búzios' };

let db;
beforeEach(() => {
  db = abrirBanco(':memory:');
});
afterEach(() => db.close());

test('imóvel: cria ativo e só o dono consegue ler, editar e mudar status', () => {
  const imoveis = criarRepositorioImoveis(db);
  const ana = criarUsuario(db, 'anfitriao');
  const bruno = criarUsuario(db, 'anfitriao');

  const imovel = imoveis.inserir(ana, dadosImovel);
  assert.equal(imovel.status, 'ativo');
  assert.equal(imovel.preco_diaria, 250000);

  assert.equal(imoveis.buscarDoAnfitriao(imovel.id, bruno), null);
  assert.equal(imoveis.atualizar(imovel.id, bruno, { ...dadosImovel, titulo: 'Invadido' }), null);
  assert.equal(imoveis.alterarStatus(imovel.id, bruno, 'inativo'), null);
  assert.equal(imoveis.buscarDoAnfitriao(imovel.id, ana).titulo, 'Villa Vista Mar');

  assert.equal(imoveis.atualizar(imovel.id, ana, { ...dadosImovel, preco_diaria: 300000 }).preco_diaria, 300000);
  assert.equal(imoveis.alterarStatus(imovel.id, ana, 'inativo').status, 'inativo');
});

test('imóvel: listagem do anfitrião traz capa, total de fotos e só os próprios imóveis', () => {
  const imoveis = criarRepositorioImoveis(db);
  const ana = criarUsuario(db, 'anfitriao');
  const bruno = criarUsuario(db, 'anfitriao');
  criarImovel(db, ana, { titulo: 'Casa sem foto' }, { fotos: 0 });
  const comFotos = criarImovel(db, ana, { titulo: 'Villa com fotos' }, { fotos: 3 });
  criarImovel(db, bruno);

  const lista = imoveis.listarDoAnfitriao(ana);
  assert.deepEqual(lista.map((imovel) => imovel.titulo).sort(), ['Casa sem foto', 'Villa com fotos']);
  const villa = lista.find((imovel) => imovel.id === comFotos);
  assert.equal(villa.total_fotos, 3);
  assert.equal(villa.foto_capa, `/uploads/${comFotos}-1.jpg`);
  assert.equal(villa.nota_media, null);
  assert.equal(villa.total_avaliacoes, 0);
});

test('CB06: reservas futuras ativas bloqueiam; passadas, canceladas e pendentes expiradas não', () => {
  const imoveis = criarRepositorioImoveis(db);
  const ana = criarUsuario(db, 'anfitriao');
  const hugo = criarUsuario(db, 'hospede');
  const hoje = '2026-10-12';
  const reserva = (dados) => criarReserva(db, { hospedeId: hugo, imovelId, ...dados });
  const imovelId = criarImovel(db, ana);

  reserva({ checkin: '2026-09-01', checkout: '2026-09-05' });
  reserva({ checkin: '2026-10-08', checkout: '2026-10-12' });
  reserva({ checkin: '2026-12-01', checkout: '2026-12-05', status: 'cancelada' });
  reserva({ checkin: '2026-12-10', checkout: '2026-12-12', status: 'pendente', minutosAtras: 31 });
  assert.equal(imoveis.possuiReservasFuturas(imovelId, hoje), false);

  reserva({ checkin: '2026-12-20', checkout: '2026-12-23', status: 'pendente', minutosAtras: 5 });
  assert.equal(imoveis.possuiReservasFuturas(imovelId, hoje), true);
});

test('CB06: estadia em andamento (checkout depois de hoje) também conta como futura', () => {
  const imoveis = criarRepositorioImoveis(db);
  const imovelId = criarImovel(db, criarUsuario(db, 'anfitriao'));
  criarReserva(db, { hospedeId: criarUsuario(db, 'hospede'), imovelId, checkin: '2026-10-10', checkout: '2026-10-14' });
  assert.equal(imoveis.possuiReservasFuturas(imovelId, '2026-10-12'), true);
});

test('fotos: entram no fim na ordem enviada, respeitando o limite de forma atômica', () => {
  const fotos = criarRepositorioFotos(db);
  const imovelId = criarImovel(db, criarUsuario(db, 'anfitriao'), {}, { fotos: 0 });

  fotos.adicionar(imovelId, ['/u/a.jpg', '/u/b.jpg'], 3);
  const lista = fotos.adicionar(imovelId, ['/u/c.jpg'], 3);
  assert.deepEqual(lista.map((foto) => [foto.url_foto, foto.ordem]), [['/u/a.jpg', 1], ['/u/b.jpg', 2], ['/u/c.jpg', 3]]);

  assert.throws(() => fotos.adicionar(imovelId, ['/u/d.jpg'], 3), ErroLimiteFotos);
  assert.equal(fotos.contar(imovelId), 3, 'nenhuma foto entra quando passa do limite');
});

test('fotos: remover e reordenar só valem para fotos do próprio imóvel', () => {
  const fotos = criarRepositorioFotos(db);
  const ana = criarUsuario(db, 'anfitriao');
  const imovelId = criarImovel(db, ana, {}, { fotos: 0 });
  const outroImovel = criarImovel(db, ana, {}, { fotos: 1 });
  const [a, b, c] = fotos.adicionar(imovelId, ['/u/a.jpg', '/u/b.jpg', '/u/c.jpg'], 10);
  const fotoDoOutro = fotos.listar(outroImovel)[0];

  assert.equal(fotos.remover(fotoDoOutro.id, imovelId), null);
  assert.equal(fotos.contar(outroImovel), 1);

  assert.deepEqual(fotos.reordenar(imovelId, [c.id, a.id, b.id]).map((foto) => foto.url_foto), ['/u/c.jpg', '/u/a.jpg', '/u/b.jpg']);
  assert.equal(fotos.reordenar(imovelId, [c.id, a.id]), null, 'faltando foto');
  assert.equal(fotos.reordenar(imovelId, [c.id, a.id, a.id]), null, 'foto repetida');
  assert.equal(fotos.reordenar(imovelId, [c.id, a.id, fotoDoOutro.id]), null, 'foto de outro imóvel');

  assert.equal(fotos.remover(a.id, imovelId).url_foto, '/u/a.jpg');
  assert.deepEqual(fotos.listar(imovelId).map((foto) => foto.url_foto), ['/u/c.jpg', '/u/b.jpg']);
});

test('serviço: só o prestador dono edita; desativado some da lista pública (CB05)', () => {
  const servicos = criarRepositorioServicos(db);
  const paulo = criarUsuario(db, 'prestador', { nome: 'Paulo Andrade' });
  const outro = criarUsuario(db, 'prestador');

  const servico = servicos.inserir(paulo, dadosServico);
  assert.equal(servico.status, 'ativo');
  assert.equal(servicos.atualizar(servico.id, outro, { ...dadosServico, preco: 1 }), null);
  assert.equal(servicos.alterarStatus(servico.id, outro, 'inativo'), null);
  assert.deepEqual(servicos.listarDoPrestador(paulo).map((item) => item.id), [servico.id]);
  assert.deepEqual(servicos.listarDoPrestador(outro), []);

  const visivel = servicos.listarVisiveis({ cidade: 'Búzios' });
  assert.equal(visivel.length, 1);
  assert.equal(visivel[0].prestador, 'Paulo Andrade');

  servicos.alterarStatus(servico.id, paulo, 'inativo');
  assert.deepEqual(servicos.listarVisiveis({ cidade: 'Búzios' }), []);
});

test('RN13: serviço de prestador sem recebimento só aparece quando a exigência está desligada', () => {
  criarServico(db, criarUsuario(db, 'prestador', { recebimentoAtivo: false }), { tipo_servico: 'barman' });
  criarServico(db, criarUsuario(db, 'prestador'), { tipo_servico: 'mordomo', cidade_atuacao: 'Trancoso' });

  const exigindo = criarRepositorioServicos(db, { exigirRecebimento: true });
  const semExigir = criarRepositorioServicos(db, { exigirRecebimento: false });
  assert.deepEqual(exigindo.listarVisiveis().map((servico) => servico.tipo_servico), ['mordomo']);
  assert.equal(semExigir.listarVisiveis().length, 2);
  assert.deepEqual(semExigir.listarVisiveis({ tipo: 'barman' }).map((servico) => servico.tipo_servico), ['barman']);
  assert.deepEqual(semExigir.listarVisiveis({ cidade: 'Trancoso' }).map((servico) => servico.tipo_servico), ['mordomo']);
});
