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

// Banco como estava antes da 002: versão 0 + 001, com imóvel, fotos, reserva, serviço contratado e avaliação
function criarBancoVersao1(caminho) {
  const antigo = new Database(caminho);
  antigo.exec(schemaVersao0);
  antigo.exec(fs.readFileSync(path.join(__dirname, '../../src/db/migracoes/001_recebimento_ativo.sql'), 'utf8'));
  antigo.pragma('user_version = 1');
  antigo.exec(`
    INSERT INTO usuarios (id, nome, email, senha_hash, tipo) VALUES
      (1, 'Ana', 'ana@x.com', 'h', 'anfitriao'), (2, 'Hugo', 'hugo@x.com', 'h', 'hospede'), (3, 'Paulo', 'paulo@x.com', 'h', 'prestador');
    INSERT INTO imoveis (id, anfitriao_id, titulo, tipo_imovel, endereco, cidade, estado, preco_diaria, num_hospedes, num_quartos, status, data_cadastro) VALUES
      (5, 1, 'Villa Vista Mar', 'villa', 'Rua das Ondas, 10', 'Búzios', 'RJ', 250000, 8, 4, 'ativo', '2026-10-01 10:00:00'),
      (9, 1, 'Fazenda Vale Verde', 'fazenda', 'Estrada do Vale, km 3', 'Itaipava', 'RJ', 180000, 12, 6, 'inativo', '2026-10-02 10:00:00');
    INSERT INTO imovel_fotos (imovel_id, url_foto, ordem) VALUES (5, '/uploads/a.jpg', 1), (5, '/uploads/b.jpg', 2), (9, '/uploads/c.jpg', 1);
    INSERT INTO servicos (id, prestador_id, tipo_servico, preco, cidade_atuacao) VALUES (4, 3, 'mordomo', 80000, 'Búzios');
    INSERT INTO reservas (id, hospede_id, imovel_id, data_checkin, data_checkout, num_hospedes, valor_hospedagem, valor_servicos, valor_total, status)
      VALUES (7, 2, 5, '2026-09-01', '2026-09-03', 2, 500000, 80000, 580000, 'concluida');
    INSERT INTO reserva_servicos (reserva_id, servico_id, data_servico, preco_contratado) VALUES (7, 4, '2026-09-02', 80000);
    INSERT INTO avaliacoes (reserva_id, autor_id, tipo_alvo, alvo_id, nota) VALUES (7, 2, 'imovel', 5, 5);
  `);
  antigo.close();
}

test('migração 002 recria imoveis aceitando "sitio" sem perder imóveis, fotos, reservas nem índices', (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'estadia-migracao-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const caminho = path.join(pasta, 'versao1.db');
  criarBancoVersao1(caminho);

  const db = abrirBanco(caminho);

  assert.equal(db.pragma('user_version', { simple: true }), listarMigracoes().at(-1).versao);
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1, 'as foreign keys voltam a ficar ligadas');

  const imoveis = db.prepare('SELECT id, titulo, tipo_imovel, status, data_cadastro FROM imoveis ORDER BY id').all();
  assert.deepEqual(imoveis.map((imovel) => ({ ...imovel })), [
    { id: 5, titulo: 'Villa Vista Mar', tipo_imovel: 'villa', status: 'ativo', data_cadastro: '2026-10-01 10:00:00' },
    { id: 9, titulo: 'Fazenda Vale Verde', tipo_imovel: 'fazenda', status: 'inativo', data_cadastro: '2026-10-02 10:00:00' },
  ]);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM imovel_fotos').get().total, 3, 'o DROP TABLE não apagou as fotos em cascata');
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM reserva_servicos').get().total, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM avaliacoes').get().total, 1);

  const indices = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'imoveis'").all().map((linha) => linha.name);
  assert.ok(indices.includes('idx_imoveis_busca') && indices.includes('idx_imoveis_anfitriao'));

  // As outras tabelas continuam apontando para a nova imoveis
  const referencia = db.prepare('PRAGMA foreign_key_list(imovel_fotos)').all()[0];
  assert.equal(referencia.table, 'imoveis');
  assert.throws(
    () => db.prepare("INSERT INTO imovel_fotos (imovel_id, url_foto) VALUES (999, '/uploads/x.jpg')").run(),
    /FOREIGN KEY/,
  );
  assert.throws(() => db.prepare('DELETE FROM imoveis WHERE id = 5').run(), /FOREIGN KEY/, 'reserva continua protegendo o imóvel');

  const inserir = db.prepare(`
    INSERT INTO imoveis (anfitriao_id, titulo, tipo_imovel, endereco, cidade, estado, preco_diaria, num_hospedes, num_quartos)
    VALUES (1, 'Sítio Recanto', ?, 'Estrada Velha, 2', 'Itaipava', 'RJ', 90000, 6, 3)
  `);
  assert.equal(inserir.run('sitio').lastInsertRowid, 10, 'o AUTOINCREMENT continua depois do maior id');
  assert.throws(() => inserir.run('castelo'), /CHECK/);
  db.close();
});

test('tabelas dos inclusos: preço > 0, unidade da lista, subtotal = preço × quantidade e incluso contratado não é apagado', () => {
  const db = abrirBanco(':memory:');
  db.exec(`
    INSERT INTO usuarios (id, nome, email, senha_hash, tipo) VALUES (1, 'Ana', 'ana@x.com', 'h', 'anfitriao'), (2, 'Hugo', 'hugo@x.com', 'h', 'hospede');
    INSERT INTO imoveis (id, anfitriao_id, titulo, tipo_imovel, endereco, cidade, estado, preco_diaria, num_hospedes, num_quartos)
      VALUES (1, 1, 'Sítio Recanto', 'sitio', 'Estrada Velha, 2', 'Itaipava', 'RJ', 90000, 6, 3);
    INSERT INTO imovel_servicos_inclusos (id, imovel_id, nome, preco, unidade_preco) VALUES (1, 1, 'Caseiro', 15000, 'noite');
    INSERT INTO reservas (id, hospede_id, imovel_id, data_checkin, data_checkout, num_hospedes, valor_hospedagem, valor_servicos, valor_total)
      VALUES (1, 2, 1, '2099-01-01', '2099-01-03', 2, 180000, 30000, 210000);
  `);
  const novoIncluso = db.prepare("INSERT INTO imovel_servicos_inclusos (imovel_id, nome, preco, unidade_preco) VALUES (1, 'Lenha', ?, ?)");
  assert.throws(() => novoIncluso.run(0, 'estadia'), /CHECK/);
  assert.throws(() => novoIncluso.run(5000, 'diaria'), /CHECK/);

  const contratar = db.prepare(`
    INSERT INTO reserva_inclusos (reserva_id, imovel_servico_id, nome_contratado, unidade_preco, quantidade, preco_contratado, subtotal, valor_comissao)
    VALUES (1, 1, 'Caseiro', 'noite', 2, 15000, ?, 3600)
  `);
  assert.throws(() => contratar.run(29999), /CHECK/);
  contratar.run(30000);
  assert.throws(() => db.prepare('DELETE FROM imovel_servicos_inclusos WHERE id = 1').run(), /FOREIGN KEY/);
  db.close();
});
