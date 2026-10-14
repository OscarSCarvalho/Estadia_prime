// Monta cenários direto no banco para testar repositórios sem passar pela API
let contador = 0;

function criarUsuario(db, tipo, { nome = `Usuário ${tipo}`, recebimentoAtivo = true } = {}) {
  contador += 1;
  return db
    .prepare('INSERT INTO usuarios (nome, email, senha_hash, tipo, recebimento_ativo) VALUES (?, ?, ?, ?, ?)')
    .run(nome, `usuario${contador}@teste.com`, 'hash', tipo, recebimentoAtivo ? 1 : 0).lastInsertRowid;
}

function criarImovel(db, anfitriaoId, dados = {}, { fotos = 1 } = {}) {
  const imovel = {
    titulo: 'Villa Vista Mar',
    tipo_imovel: 'villa',
    endereco: 'Rua das Ondas, 10',
    cidade: 'Búzios',
    estado: 'RJ',
    preco_diaria: 250000,
    num_hospedes: 8,
    num_quartos: 4,
    status: 'ativo',
    ...dados,
  };
  const id = db
    .prepare(`
      INSERT INTO imoveis (anfitriao_id, titulo, tipo_imovel, endereco, cidade, estado, preco_diaria, num_hospedes, num_quartos, status)
      VALUES (@anfitriaoId, @titulo, @tipo_imovel, @endereco, @cidade, @estado, @preco_diaria, @num_hospedes, @num_quartos, @status)
    `)
    .run({ ...imovel, anfitriaoId }).lastInsertRowid;
  for (let ordem = 1; ordem <= fotos; ordem += 1) {
    db.prepare('INSERT INTO imovel_fotos (imovel_id, url_foto, ordem) VALUES (?, ?, ?)').run(id, `/uploads/${id}-${ordem}.jpg`, ordem);
  }
  return id;
}

function criarServico(db, prestadorId, dados = {}) {
  const servico = { tipo_servico: 'mordomo', preco: 80000, unidade_preco: 'diaria', cidade_atuacao: 'Búzios', status: 'ativo', ...dados };
  return db
    .prepare(`
      INSERT INTO servicos (prestador_id, tipo_servico, preco, unidade_preco, cidade_atuacao, status)
      VALUES (@prestadorId, @tipo_servico, @preco, @unidade_preco, @cidade_atuacao, @status)
    `)
    .run({ ...servico, prestadorId }).lastInsertRowid;
}

// `minutosAtras` simula reservas pendentes antigas (RN07)
function criarReserva(db, { hospedeId, imovelId, checkin, checkout, status = 'confirmada', minutosAtras = 0 }) {
  return db
    .prepare(`
      INSERT INTO reservas (hospede_id, imovel_id, data_checkin, data_checkout, num_hospedes,
                            valor_hospedagem, valor_total, status, data_reserva)
      VALUES (?, ?, ?, ?, 2, 100, 100, ?, datetime('now', ?))
    `)
    .run(hospedeId, imovelId, checkin, checkout, status, `-${minutosAtras} minutes`).lastInsertRowid;
}

function avaliar(db, { reservaId, autorId, tipoAlvo, alvoId, nota }) {
  db.prepare('INSERT INTO avaliacoes (reserva_id, autor_id, tipo_alvo, alvo_id, nota) VALUES (?, ?, ?, ?, ?)').run(
    reservaId, autorId, tipoAlvo, alvoId, nota,
  );
}

module.exports = { criarUsuario, criarImovel, criarServico, criarReserva, avaliar };
