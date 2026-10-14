// Teste rápido do schema: cria o banco em memória, insere o fluxo completo
// do hóspede e confere se o banco recusa dados inválidos.
// Uso: npm run db:testar

const { abrirBanco } = require('../src/db/database');

const db = abrirBanco(':memory:');

let falhas = 0;

function verificar(descricao, condicao) {
  console.log(`${condicao ? '✔' : '✘'} ${descricao}`);
  if (!condicao) falhas++;
}

function deveRecusar(descricao, comando) {
  try {
    comando();
    verificar(descricao, false);
  } catch {
    verificar(descricao, true);
  }
}

const inserirUsuario = db.prepare(
  'INSERT INTO usuarios (nome, email, senha_hash, tipo) VALUES (?, ?, ?, ?)'
);
const anfitriaoId = inserirUsuario.run('Ana Anfitriã', 'ana@teste.com', 'hash', 'anfitriao').lastInsertRowid;
const hospedeId = inserirUsuario.run('Hugo Hóspede', 'hugo@teste.com', 'hash', 'hospede').lastInsertRowid;
const prestadorId = inserirUsuario.run('Paulo Mordomo', 'paulo@teste.com', 'hash', 'prestador').lastInsertRowid;

const imovelId = db.prepare(`
  INSERT INTO imoveis (anfitriao_id, titulo, tipo_imovel, endereco, cidade, estado, preco_diaria, num_hospedes, num_quartos)
  VALUES (?, 'Villa Vista Mar', 'villa', 'Rua das Ondas, 10', 'Búzios', 'RJ', 250000, 8, 4)
`).run(anfitriaoId).lastInsertRowid;

db.prepare('INSERT INTO imovel_fotos (imovel_id, url_foto, ordem) VALUES (?, ?, ?)').run(imovelId, '/uploads/villa-1.jpg', 1);

const servicoId = db.prepare(`
  INSERT INTO servicos (prestador_id, tipo_servico, descricao, preco, unidade_preco, cidade_atuacao)
  VALUES (?, 'mordomo', 'Mordomo bilíngue', 80000, 'diaria', 'búzios')
`).run(prestadorId).lastInsertRowid;

const reservaId = db.prepare(`
  INSERT INTO reservas (hospede_id, imovel_id, data_checkin, data_checkout, num_hospedes,
                        valor_hospedagem, valor_servicos, valor_total, valor_comissao)
  VALUES (?, ?, '2026-12-20', '2026-12-23', 6, 750000, 160000, 910000, 114000)
`).run(hospedeId, imovelId).lastInsertRowid;

db.prepare(`
  INSERT INTO reserva_servicos (reserva_id, servico_id, data_servico, quantidade, preco_contratado, valor_comissao)
  VALUES (?, ?, '2026-12-21', 2, 80000, 24000)
`).run(reservaId, servicoId);

db.prepare(`
  INSERT INTO pagamentos (reserva_id, valor_total, valor_comissao, status, metodo, id_externo, data_pagamento)
  VALUES (?, 910000, 114000, 'aprovado', 'pix', 'pi_teste_123', datetime('now'))
`).run(reservaId);

db.prepare(`
  INSERT INTO avaliacoes (reserva_id, autor_id, tipo_alvo, alvo_id, nota, comentario)
  VALUES (?, ?, 'imovel', ?, 5, 'Impecável')
`).run(reservaId, hospedeId, imovelId);

const tabelas = db.prepare("SELECT count(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'sessoes'").get().total;
verificar(`8 tabelas de negócio criadas (encontradas: ${tabelas})`, tabelas === 8);
verificar('foreign_keys ligado', db.pragma('foreign_keys', { simple: true }) === 1);

const servicosNaCidade = db.prepare("SELECT count(*) AS total FROM servicos WHERE cidade_atuacao = 'Búzios'").get().total;
verificar('busca de cidade ignora maiúsculas (búzios = Búzios)', servicosNaCidade === 1);

deveRecusar('recusa e-mail duplicado (mesmo com letras maiúsculas)', () =>
  inserirUsuario.run('Outro', 'ANA@teste.com', 'hash', 'hospede'));
deveRecusar('recusa perfil de usuário inválido', () =>
  inserirUsuario.run('X', 'x@teste.com', 'hash', 'admin'));
deveRecusar('recusa imóvel de anfitrião inexistente', () =>
  db.prepare(`INSERT INTO imoveis (anfitriao_id, titulo, tipo_imovel, endereco, cidade, estado, preco_diaria, num_hospedes, num_quartos)
              VALUES (999, 'X', 'casa', 'X', 'X', 'SP', 100, 1, 1)`).run());
deveRecusar('recusa tipo de serviço inválido', () =>
  db.prepare(`INSERT INTO servicos (prestador_id, tipo_servico, preco, cidade_atuacao) VALUES (?, 'chef', 100, 'X')`).run(prestadorId));
deveRecusar('recusa checkout antes do checkin', () =>
  db.prepare(`INSERT INTO reservas (hospede_id, imovel_id, data_checkin, data_checkout, num_hospedes, valor_hospedagem, valor_total)
              VALUES (?, ?, '2026-12-10', '2026-12-05', 2, 100, 100)`).run(hospedeId, imovelId));
deveRecusar('recusa data em formato errado (20/12/2026)', () =>
  db.prepare(`INSERT INTO reservas (hospede_id, imovel_id, data_checkin, data_checkout, num_hospedes, valor_hospedagem, valor_total)
              VALUES (?, ?, '20/12/2026', '2026-12-25', 2, 100, 100)`).run(hospedeId, imovelId));
deveRecusar('recusa total diferente de hospedagem + serviços', () =>
  db.prepare(`INSERT INTO reservas (hospede_id, imovel_id, data_checkin, data_checkout, num_hospedes, valor_hospedagem, valor_servicos, valor_total)
              VALUES (?, ?, '2027-01-10', '2027-01-12', 2, 100, 50, 999)`).run(hospedeId, imovelId));
deveRecusar('recusa comissão maior que o pagamento', () =>
  db.prepare(`INSERT INTO pagamentos (reserva_id, valor_total, valor_comissao) VALUES (?, 100, 200)`).run(reservaId));
deveRecusar('recusa nota fora de 1 a 5', () =>
  db.prepare(`INSERT INTO avaliacoes (reserva_id, autor_id, tipo_alvo, alvo_id, nota) VALUES (?, ?, 'servico', ?, 6)`).run(reservaId, hospedeId, servicoId));
deveRecusar('recusa avaliar o mesmo imóvel duas vezes na mesma reserva', () =>
  db.prepare(`INSERT INTO avaliacoes (reserva_id, autor_id, tipo_alvo, alvo_id, nota) VALUES (?, ?, 'imovel', ?, 4)`).run(reservaId, hospedeId, imovelId));
deveRecusar('impede apagar usuário com reservas', () =>
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(hospedeId));

console.log(falhas === 0 ? '\nBanco OK ✅' : `\n${falhas} verificação(ões) falharam ❌`);
process.exit(falhas === 0 ? 0 : 1);
