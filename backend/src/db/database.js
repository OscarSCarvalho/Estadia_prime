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
//
// As foreign keys ficam desligadas durante as migrações porque recriar uma tabela (único jeito de mudar
// um CHECK no SQLite) faz DROP TABLE, e com elas ligadas o DROP apagaria os filhos em cascata.
// O PRAGMA só funciona fora de transação; a integridade é conferida antes de cada commit.
function aplicarMigracoes(db) {
  const versaoAtual = db.pragma('user_version', { simple: true });
  const pendentes = listarMigracoes().filter(({ versao }) => versao > versaoAtual);
  if (pendentes.length === 0) return;

  const foreignKeysLigadas = db.pragma('foreign_keys', { simple: true }) === 1;
  db.pragma('foreign_keys = OFF');
  try {
    for (const { versao, arquivo } of pendentes) {
      const sql = fs.readFileSync(path.join(pastaMigracoes, arquivo), 'utf8');
      db.transaction(() => {
        db.exec(sql);
        const violacoes = db.pragma('foreign_key_check');
        if (violacoes.length > 0) {
          throw new Error(`Migração ${arquivo} quebrou ${violacoes.length} referência(s) entre tabelas: ${JSON.stringify(violacoes)}`);
        }
        db.pragma(`user_version = ${versao}`);
      })();
    }
  } finally {
    db.pragma(`foreign_keys = ${foreignKeysLigadas ? 'ON' : 'OFF'}`);
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
