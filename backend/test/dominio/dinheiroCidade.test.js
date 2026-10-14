const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reaisParaCentavos, centavosParaReais } = require('../../src/dominio/dinheiro');
const { normalizarCidade, problemaNaCidade, normalizarEstado } = require('../../src/dominio/cidade');

test('converte reais em número para centavos', () => {
  assert.equal(reaisParaCentavos(2500), 250000);
  assert.equal(reaisParaCentavos(2500.5), 250050);
  assert.equal(reaisParaCentavos(19.99), 1999);
  assert.equal(reaisParaCentavos(0), 0);
});

test('converte reais em texto no formato brasileiro', () => {
  assert.equal(reaisParaCentavos('2.500,00'), 250000);
  assert.equal(reaisParaCentavos('R$ 2.500,5'), 250050);
  assert.equal(reaisParaCentavos('2500'), 250000);
  assert.equal(reaisParaCentavos('1.000.000'), 100000000);
});

test('recusa valores que não são preço', () => {
  for (const invalido of [-1, 10.005, NaN, Infinity, '2.50', 'abc', '', '1,234', null, undefined, {}]) {
    assert.equal(reaisParaCentavos(invalido), null, `deveria recusar ${String(invalido)}`);
  }
});

test('centavos voltam para reais', () => {
  assert.equal(centavosParaReais(250050), 2500.5);
});

test('CB11: grafias diferentes viram a mesma cidade', () => {
  for (const grafia of ['búzios ', 'BÚZIOS', '  Búzios', 'bÚziOS']) {
    assert.equal(normalizarCidade(grafia), 'Búzios');
  }
});

test('mantém partículas minúsculas e capitaliza nomes compostos', () => {
  assert.equal(normalizarCidade('  rio   DE janeiro '), 'Rio de Janeiro');
  assert.equal(normalizarCidade('ANGRA DOS REIS'), 'Angra dos Reis');
  assert.equal(normalizarCidade('fernando de noronha'), 'Fernando de Noronha');
  assert.equal(normalizarCidade('embu-guaçu'), 'Embu-Guaçu');
  assert.equal(normalizarCidade('de cima'), 'De Cima');
});

test('valida o nome da cidade normalizado', () => {
  assert.equal(problemaNaCidade('São Paulo'), null);
  assert.ok(problemaNaCidade(''));
  assert.ok(problemaNaCidade('A'));
  assert.ok(problemaNaCidade('Cidade 123'));
  assert.ok(problemaNaCidade('<script>'));
  assert.ok(problemaNaCidade('x'.repeat(81)));
  assert.equal(normalizarCidade(42), '');
});

test('estado vira sigla maiúscula', () => {
  assert.equal(normalizarEstado(' rj '), 'RJ');
  assert.equal(normalizarEstado(undefined), '');
});
