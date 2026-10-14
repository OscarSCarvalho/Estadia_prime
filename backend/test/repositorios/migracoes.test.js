const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { abrirBanco, listarMigracoes } = require('../../src/db/database');

const schemaVersao0 = fs.readFileSync(path.join(__dirname, '../../src/db/schema.sql'), 'utf8');

test('banco novo sai na versão da última migração, com a coluna recebimento_ativo', () => {
  const db = abrirBanco(':memory:');
  const ultimaVersao = listarMigracoes().at(-1).versao;
  assert.equal(db.pragma('user_version', { simple: true }), ultimaVersao);
  const colunas = db.prepare('PRAGMA table_info(usuarios)').all().map((coluna) => coluna.name);
  assert.ok(colunas.includes('recebimento_ativo'));
  db.close();
});

test('banco antigo (versão 0) é migrado sem perder dados e reabrir não reaplica nada', (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'estadia-migracao-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const caminho = path.join(pasta, 'antigo.db');

  const antigo = new Database(caminho);
  antigo.exec(schemaVersao0);
  antigo.prepare("INSERT INTO usuarios (nome, email, senha_hash, tipo) VALUES ('Ana', 'ana@x.com', 'h', 'anfitriao')").run();
  antigo.close();

  const migrado = abrirBanco(caminho);
  const ana = migrado.prepare('SELECT nome, recebimento_ativo FROM usuarios').get();
  assert.deepEqual({ ...ana }, { nome: 'Ana', recebimento_ativo: 0 });
  migrado.close();

  // Se reaplicasse o ALTER TABLE, daria erro de "duplicate column"
  const reaberto = abrirBanco(caminho);
  assert.equal(reaberto.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total, 1);
  reaberto.close();
});

test('o banco recusa recebimento_ativo diferente de 0 ou 1', () => {
  const db = abrirBanco(':memory:');
  assert.throws(() =>
    db.prepare("INSERT INTO usuarios (nome, email, senha_hash, tipo, recebimento_ativo) VALUES ('A', 'a@x.com', 'h', 'hospede', 2)").run(),
  );
  db.close();
});
