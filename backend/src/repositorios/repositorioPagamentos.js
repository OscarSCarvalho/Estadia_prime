// Cobranças das reservas e eventos recebidos do gateway (migração 003). Só SQL parametrizado:
// as decisões (RN07, RN08, CB03) ficam no domínio e nos casos de uso.
// As mudanças de status são condicionais (WHERE status = ...): se outra requisição mudou antes, nada acontece
function criarRepositorioPagamentos(db) {
  const consultaPorId = db.prepare('SELECT * FROM pagamentos WHERE id = ?');
  const consultaPorIdExterno = db.prepare('SELECT * FROM pagamentos WHERE id_externo = ?');
  const consultaAberto = db.prepare("SELECT * FROM pagamentos WHERE reserva_id = ? AND status = 'pendente'");
  const consultaUltimo = db.prepare('SELECT * FROM pagamentos WHERE reserva_id = ? ORDER BY id DESC LIMIT 1');
  const consultaPagoDaReserva = db.prepare(`
    SELECT * FROM pagamentos
     WHERE reserva_id = @reservaId AND id <> @excetoId AND status IN ('aprovado', 'reembolso_pendente', 'reembolsado')
     ORDER BY id LIMIT 1
  `);
  const consultaReembolsosPendentes = db.prepare("SELECT * FROM pagamentos WHERE status = 'reembolso_pendente' ORDER BY id");

  const insercao = db.prepare(`
    INSERT INTO pagamentos (reserva_id, valor_total, valor_comissao, status, metodo, id_externo, url_fatura,
                            pix_copia_cola, pix_qr_base64, expira_em)
    VALUES (@reservaId, @valorTotal, @valorComissao, 'pendente', @metodo, @idExterno, @urlFatura,
            @pixCopiaCola, @pixQrBase64, @expiraEm)
  `);
  const atualizacaoStatus = db.prepare('UPDATE pagamentos SET status = @para WHERE id = @id AND status = @de');
  // Aprovado também a partir de 'cancelado' ou 'recusado': o dinheiro chegou mesmo assim (CB03)
  const aprovacao = db.prepare(`
    UPDATE pagamentos SET status = 'aprovado', taxa_gateway = @taxaGateway, data_pagamento = datetime('now')
     WHERE id = @id AND status IN ('pendente', 'cancelado', 'recusado')
  `);
  const atualizacaoTaxa = db.prepare('UPDATE pagamentos SET taxa_gateway = @taxaGateway WHERE id = @id AND taxa_gateway IS NULL');
  const registroReembolso = db.prepare(`
    UPDATE pagamentos SET status = 'reembolsado', valor_reembolsado = valor_reembolsado + @valor
     WHERE id = @id AND status IN ('aprovado', 'reembolso_pendente', 'reembolsado') AND valor_reembolsado + @valor <= valor_total
  `);
  // Reembolso feito fora do site (painel do Asaas, disputa): vale o valor total
  const reembolsoExterno = db.prepare(`
    UPDATE pagamentos SET status = 'reembolsado', valor_reembolsado = valor_total
     WHERE id = @id AND status IN ('aprovado', 'reembolso_pendente')
  `);

  const consultaEvento = db.prepare('SELECT 1 FROM eventos_gateway WHERE id_evento = ?');
  const insercaoEvento = db.prepare('INSERT OR IGNORE INTO eventos_gateway (id_evento, tipo) VALUES (?, ?)');

  function emTransacao(funcao) {
    return db.transaction(funcao).immediate();
  }

  // A cobrança em aberto (no máximo uma por reserva, garantido por índice único)
  function abertoDaReserva(reservaId) {
    return consultaAberto.get(reservaId) ?? null;
  }

  function ultimoDaReserva(reservaId) {
    return consultaUltimo.get(reservaId) ?? null;
  }

  // Outro pagamento da mesma reserva que já entrou (cobrança paga duas vezes)
  function outroPagoDaReserva(reservaId, excetoId = 0) {
    return consultaPagoDaReserva.get({ reservaId, excetoId }) ?? null;
  }

  function buscarPorId(id) {
    return consultaPorId.get(id) ?? null;
  }

  function buscarPorIdExterno(idExterno) {
    return consultaPorIdExterno.get(idExterno) ?? null;
  }

  // Devolve null se já existe uma cobrança em aberto para a reserva (dois cliques ao mesmo tempo)
  function inserir(dados) {
    try {
      const { lastInsertRowid } = insercao.run(dados);
      return buscarPorId(lastInsertRowid);
    } catch (erro) {
      if (erro.code === 'SQLITE_CONSTRAINT_UNIQUE') return null;
      throw erro;
    }
  }

  function alterarStatus(id, de, para) {
    return atualizacaoStatus.run({ id, de, para }).changes === 1;
  }

  function aprovar(id, { taxaGateway }) {
    return aprovacao.run({ id, taxaGateway }).changes === 1;
  }

  // PAYMENT_RECEIVED depois do PAYMENT_CONFIRMED pode trazer o valor líquido que faltava
  function completarTaxa(id, taxaGateway) {
    if (taxaGateway === null) return false;
    return atualizacaoTaxa.run({ id, taxaGateway }).changes === 1;
  }

  function registrarReembolso(id, valor) {
    return registroReembolso.run({ id, valor }).changes === 1;
  }

  function registrarReembolsoExterno(id) {
    return reembolsoExterno.run({ id }).changes === 1;
  }

  function reembolsosPendentes() {
    return consultaReembolsosPendentes.all();
  }

  function eventoJaProcessado(idEvento) {
    return consultaEvento.get(idEvento) !== undefined;
  }

  function registrarEvento(idEvento, tipo) {
    return insercaoEvento.run(idEvento, tipo).changes === 1;
  }

  return {
    emTransacao,
    abertoDaReserva,
    ultimoDaReserva,
    outroPagoDaReserva,
    buscarPorId,
    buscarPorIdExterno,
    inserir,
    alterarStatus,
    aprovar,
    completarTaxa,
    registrarReembolso,
    registrarReembolsoExterno,
    reembolsosPendentes,
    eventoJaProcessado,
    registrarEvento,
  };
}

module.exports = { criarRepositorioPagamentos };
