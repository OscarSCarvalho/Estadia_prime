const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { promisify } = require('node:util');
const { abrirBanco } = require('../../src/db/database');
const { ArmazemSessoesSqlite } = require('../../src/adaptadores/armazemSessoesSqlite');

const db = abrirBanco(':memory:');
const armazem = new ArmazemSessoesSqlite(db);
const obter = promisify(armazem.get.bind(armazem));
const gravar = promisify(armazem.set.bind(armazem));
const destruir = promisify(armazem.destroy.bind(armazem));

after(() => {
  armazem.encerrar();
  db.close();
});

const daquiA = (ms) => new Date(Date.now() + ms).toISOString();

test('grava, lê e remove uma sessão', async () => {
  await gravar('abc', { cookie: { expires: daquiA(60_000) }, usuario: { id: 1, tipo: 'hospede' } });
  assert.deepEqual((await obter('abc')).usuario, { id: 1, tipo: 'hospede' });
  await destruir('abc');
  assert.equal(await obter('abc'), null);
});

test('sessão expirada não é devolvida e é removida na limpeza', async () => {
  await gravar('velha', { cookie: { expires: daquiA(-1000) }, usuario: { id: 2 } });
  assert.equal(await obter('velha'), null);
  assert.equal(armazem.limparExpiradas(), 1);
});

test('gravar de novo atualiza a mesma sessão', async () => {
  await gravar('xyz', { cookie: { expires: daquiA(60_000) }, contador: 1 });
  await gravar('xyz', { cookie: { expires: daquiA(60_000) }, contador: 2 });
  assert.equal((await obter('xyz')).contador, 2);
  assert.equal(db.prepare("SELECT count(*) AS total FROM sessoes WHERE sid = 'xyz'").get().total, 1);
});
