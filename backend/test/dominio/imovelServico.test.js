const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarImovel, validarStatusImovel, ocultarEndereco } = require('../../src/dominio/imovel');
const { validarServico, validarStatusServico, TIPOS_SERVICO } = require('../../src/dominio/servico');
const { ErroDadosInvalidos } = require('../../src/dominio/erros');

// SPEC: "Anfitrião cadastra imóvel"
const imovelValido = {
  titulo: '  Villa   Vista Mar ',
  descricao: 'Piscina de borda infinita.\r\n\r\n\r\n\r\nVista para o mar.',
  tipo_imovel: 'villa',
  endereco: 'Rua das Ondas, 10',
  cidade: 'búzios',
  estado: 'rj',
  diaria: '2.500,00',
  num_hospedes: 8,
  num_quartos: 4,
};

const servicoValido = {
  tipo_servico: 'motorista',
  descricao: 'Sedã executivo',
  preco: 900,
  unidade_preco: 'diaria',
  cidade_atuacao: ' BÚZIOS ',
};

function camposInvalidos(validar, dados) {
  try {
    validar(dados);
  } catch (erro) {
    assert.ok(erro instanceof ErroDadosInvalidos);
    return erro.detalhes;
  }
  assert.fail('deveria ter recusado');
}

test('imóvel válido sai normalizado e com a diária em centavos', () => {
  const imovel = validarImovel(imovelValido);
  assert.equal(imovel.titulo, 'Villa Vista Mar');
  assert.equal(imovel.descricao, 'Piscina de borda infinita.\n\nVista para o mar.');
  assert.equal(imovel.cidade, 'Búzios');
  assert.equal(imovel.estado, 'RJ');
  assert.equal(imovel.preco_diaria, 250000);
  assert.equal(imovel.num_hospedes, 8);
  assert.equal(imovel.num_quartos, 4);
  assert.equal('diaria' in imovel, false);
});

test('descrição é opcional e capacidade aceita texto numérico', () => {
  const imovel = validarImovel({ ...imovelValido, descricao: '   ', num_hospedes: '6', num_quartos: '0' });
  assert.equal(imovel.descricao, null);
  assert.equal(imovel.num_hospedes, 6);
  assert.equal(imovel.num_quartos, 0);
});

test('imóvel inválido lista todos os campos de uma vez', () => {
  const campos = camposInvalidos(validarImovel, {});
  assert.deepEqual(Object.keys(campos).sort(), [
    'cidade', 'diaria', 'endereco', 'estado', 'num_hospedes', 'num_quartos', 'tipo_imovel', 'titulo',
  ]);
});

test('recusa tipo, estado, diária e capacidade fora das regras', () => {
  const campos = camposInvalidos(validarImovel, {
    ...imovelValido,
    tipo_imovel: 'castelo',
    estado: 'XX',
    diaria: 0,
    num_hospedes: 0,
    num_quartos: 2.5,
  });
  assert.deepEqual(Object.keys(campos).sort(), ['diaria', 'estado', 'num_hospedes', 'num_quartos', 'tipo_imovel']);
  assert.ok(camposInvalidos(validarImovel, { ...imovelValido, diaria: 1_000_000.01 }).diaria);
});

test('RN12: endereço oculto antes da reserva confirmada', () => {
  const publico = ocultarEndereco({ id: 1, cidade: 'Búzios', endereco: 'Rua das Ondas, 10' });
  assert.equal('endereco' in publico, false);
  assert.equal(publico.cidade, 'Búzios');
});

test('status de imóvel e serviço só aceita ativo/inativo', () => {
  assert.equal(validarStatusImovel('inativo'), 'inativo');
  assert.equal(validarStatusServico('ativo'), 'ativo');
  assert.throws(() => validarStatusImovel('apagado'), ErroDadosInvalidos);
  assert.throws(() => validarStatusServico(undefined), ErroDadosInvalidos);
});

test('serviço válido sai com cidade padronizada e preço em centavos', () => {
  assert.deepEqual(validarServico(servicoValido), {
    tipo_servico: 'motorista',
    descricao: 'Sedã executivo',
    preco: 90000,
    unidade_preco: 'diaria',
    cidade_atuacao: 'Búzios',
  });
});

test('SPEC: tipo "chef" é recusado listando os tipos aceitos', () => {
  const campos = camposInvalidos(validarServico, { ...servicoValido, tipo_servico: 'chef' });
  for (const tipo of TIPOS_SERVICO) assert.match(campos.tipo_servico, new RegExp(tipo));
});

test('recusa unidade, preço e cidade inválidos', () => {
  const campos = camposInvalidos(validarServico, {
    ...servicoValido,
    unidade_preco: 'semana',
    preco: 'grátis',
    cidade_atuacao: '',
  });
  assert.deepEqual(Object.keys(campos).sort(), ['cidade_atuacao', 'preco', 'unidade_preco']);
});
