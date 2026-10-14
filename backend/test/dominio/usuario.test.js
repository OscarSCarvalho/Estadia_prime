const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarCadastro, paraUsuarioPublico } = require('../../src/dominio/usuario');
const { ErroDadosInvalidos } = require('../../src/dominio/erros');

const cadastroValido = {
  nome: '  Ana   Souza ',
  email: ' ANA@Exemplo.com ',
  senha: 'senhaForte123',
  telefone: '(22) 99999-1234',
  tipo: 'anfitriao',
};

function camposInvalidosDe(dados) {
  try {
    validarCadastro(dados);
  } catch (erro) {
    assert.ok(erro instanceof ErroDadosInvalidos);
    return erro.detalhes;
  }
  assert.fail('deveria ter recusado o cadastro');
}

test('normaliza nome, e-mail e telefone', () => {
  const resultado = validarCadastro(cadastroValido);
  assert.equal(resultado.nome, 'Ana Souza');
  assert.equal(resultado.email, 'ana@exemplo.com');
  assert.equal(resultado.telefone, '22999991234');
  assert.equal(resultado.tipo, 'anfitriao');
});

test('telefone é opcional', () => {
  assert.equal(validarCadastro({ ...cadastroValido, telefone: '' }).telefone, null);
  assert.equal(validarCadastro({ ...cadastroValido, telefone: undefined }).telefone, null);
});

test('aceita os três perfis', () => {
  for (const tipo of ['hospede', 'anfitriao', 'prestador']) {
    assert.equal(validarCadastro({ ...cadastroValido, tipo }).tipo, tipo);
  }
});

test('recusa perfil inexistente', () => {
  assert.ok(camposInvalidosDe({ ...cadastroValido, tipo: 'admin' }).tipo);
});

test('recusa senha curta, ausente ou acima de 72 bytes', () => {
  assert.ok(camposInvalidosDe({ ...cadastroValido, senha: '1234567' }).senha);
  assert.ok(camposInvalidosDe({ ...cadastroValido, senha: undefined }).senha);
  assert.ok(camposInvalidosDe({ ...cadastroValido, senha: 'ç'.repeat(37) }).senha);
});

test('recusa e-mail inválido e telefone sem DDD', () => {
  const campos = camposInvalidosDe({ ...cadastroValido, email: 'ana@', telefone: '9999-1234' });
  assert.ok(campos.email);
  assert.ok(campos.telefone);
});

test('lista todos os campos inválidos de uma vez', () => {
  const campos = camposInvalidosDe({});
  assert.deepEqual(Object.keys(campos).sort(), ['email', 'nome', 'senha', 'tipo']);
});

test('usuário público nunca expõe o hash da senha', () => {
  const publico = paraUsuarioPublico({ id: 1, nome: 'A', email: 'a@a.com', senha_hash: 'x', tipo: 'hospede' });
  assert.equal('senha_hash' in publico, false);
});
