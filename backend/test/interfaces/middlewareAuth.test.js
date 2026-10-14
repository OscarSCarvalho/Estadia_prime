const { test } = require('node:test');
const assert = require('node:assert/strict');
const { exigirLogin, exigirPerfil } = require('../../src/middleware/auth');
const { ErroNaoAutenticado, ErroAcessoNegado } = require('../../src/dominio/erros');

function executar(middleware, usuario) {
  let recebido = 'nada';
  middleware({ session: usuario ? { usuario } : {} }, {}, (erro) => {
    recebido = erro;
  });
  return recebido;
}

test('exigirLogin bloqueia visitante e libera usuário logado', () => {
  assert.ok(executar(exigirLogin, null) instanceof ErroNaoAutenticado);
  assert.equal(executar(exigirLogin, { id: 1, tipo: 'hospede' }), undefined);
});

test('exigirPerfil libera só os perfis permitidos', () => {
  const somenteAnfitriao = exigirPerfil('anfitriao');
  assert.equal(executar(somenteAnfitriao, { id: 1, tipo: 'anfitriao' }), undefined);
  assert.ok(executar(somenteAnfitriao, { id: 2, tipo: 'hospede' }) instanceof ErroAcessoNegado);
  assert.ok(executar(somenteAnfitriao, null) instanceof ErroNaoAutenticado);
});

test('exigirPerfil aceita mais de um perfil', () => {
  const anfitriaoOuPrestador = exigirPerfil('anfitriao', 'prestador');
  assert.equal(executar(anfitriaoOuPrestador, { id: 3, tipo: 'prestador' }), undefined);
});
