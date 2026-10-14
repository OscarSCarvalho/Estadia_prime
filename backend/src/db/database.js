const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const caminhoSchema = path.join(__dirname, 'schema.sql');
const pastaMigracoes = path.join(__dirname, 'migracoes');
// Nome obrigatório: 001_descricao.sql, 002_descricao.sql...
const FORMATO_MIGRACAO = /^(\d{3})_[a-z0-9_]+\.sql$/;

function resolverCaminhoBanco() {
  const caminhoConfigurado = process.env.CAMINHO_BANCO || './data/estadia.db';
  return caminhoConfigurado === ':memory:'
    ? caminhoConfigurado
    : path.resolve(__dirname, '../..', caminhoConfigurado);
}

function listarMigracoes() {
  return fs
    .readdirSync(pastaMigracoes)
    .filter((arquivo) => FORMATO_MIGRACAO.test(arquivo))
    .map((arquivo) => ({ versao: Number(arquivo.slice(0, 3)), arquivo }))
    .sort((a, b) => a.versao - b.versao);
}

// schema.sql é a versão 0 (Etapa 1) e não muda mais. Toda alteração de tabela existente vira uma
// migração numerada; a versão aplicada fica em PRAGMA user_version, dentro do próprio arquivo do banco.
// Cada migração roda numa transação: se falhar, o banco continua na versão anterior.
function aplicarMigracoes(db) {
  const versaoAtual = db.pragma('user_version', { simple: true });

  for (const { versao, arquivo } of listarMigracoes()) {
    if (versao <= versaoAtual) continue;
    const sql = fs.readFileSync(path.join(pastaMigracoes, arquivo), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${versao}`);
    })();
  }
}

function abrirBanco(caminho = resolverCaminhoBanco()) {
  if (caminho !== ':memory:') {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
  }

  const db = new Database(caminho);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(fs.readFileSync(caminhoSchema, 'utf8'));
  aplicarMigracoes(db);
  return db;
}

module.exports = { abrirBanco, aplicarMigracoes, listarMigracoes };
