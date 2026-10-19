const { condicaoReservaAtiva, condicaoServicoVisivel } = require('./sqlComum');

// Reservas e seus serviços. As regras (RN04–RN07, RN12, RN14) ficam no caso de uso e no domínio;
// aqui só SQL parametrizado. Carrinhos abandonados não aparecem em nenhuma listagem: pendente vencida
// (RN07) e cancelada sem nenhum pagamento (expirada pela rotina ou desistência antes de pagar)
function criarRepositorioReservas(db, { exigirRecebimento = true } = {}) {
  const parametroRecebimento = { exigirRecebimento: exigirRecebimento ? 1 : 0 };
  const foiPaga = (alias) => `EXISTS (SELECT 1 FROM pagamentos pg
     WHERE pg.reserva_id = ${alias}.id AND pg.status IN ('aprovado', 'reembolso_pendente', 'reembolsado'))`;
  const naoExpirada = `((r.status <> 'pendente' OR ${condicaoReservaAtiva('r')}) AND (r.status <> 'cancelada' OR ${foiPaga('r')}))`;

  const consultaServicos = db.prepare(`
    SELECT s.id, s.prestador_id, s.tipo_servico, s.preco, s.unidade_preco, s.cidade_atuacao, p.nome AS prestador
      FROM servicos s
      JOIN usuarios p ON p.id = s.prestador_id
     WHERE s.id IN (SELECT value FROM json_each(@ids))
       AND ${condicaoServicoVisivel('s', 'p')}
  `);

  // RN18/RN21: só inclusos ATIVOS e DESTE imóvel. Os demais ids pedidos ficam fora do resultado
  const consultaInclusos = db.prepare(`
    SELECT id, nome, preco, unidade_preco
      FROM imovel_servicos_inclusos
     WHERE imovel_id = @imovelId AND status = 'ativo'
       AND id IN (SELECT value FROM json_each(@ids))
  `);

  // RN06: o mesmo serviço não pode estar em duas reservas ativas no mesmo dia
  const consultaServicoOcupado = db.prepare(`
    SELECT EXISTS (
      SELECT 1 FROM reserva_servicos rs
        JOIN reservas r ON r.id = rs.reserva_id
       WHERE rs.servico_id = @servicoId AND rs.data_servico = @data AND ${condicaoReservaAtiva('r')}
    ) AS ocupado
  `);

  const consultaDiasOcupados = db.prepare(`
    SELECT DISTINCT rs.servico_id, rs.data_servico
      FROM reserva_servicos rs
      JOIN reservas r ON r.id = rs.reserva_id
     WHERE rs.servico_id IN (SELECT value FROM json_each(@ids))
       AND rs.data_servico BETWEEN @checkin AND @checkout
       AND ${condicaoReservaAtiva('r')}
     ORDER BY rs.data_servico
  `);

  const insercaoReserva = db.prepare(`
    INSERT INTO reservas (hospede_id, imovel_id, data_checkin, data_checkout, num_hospedes,
                          valor_hospedagem, valor_servicos, valor_total, valor_comissao, status)
    VALUES (@hospedeId, @imovelId, @checkin, @checkout, @numHospedes,
            @valorHospedagem, @valorServicos, @valorTotal, @valorComissao, 'pendente')
  `);
  const insercaoItem = db.prepare(`
    INSERT INTO reserva_servicos (reserva_id, servico_id, data_servico, quantidade, preco_contratado, valor_comissao)
    VALUES (@reservaId, @servicoId, @data, @quantidade, @precoUnitario, @valorComissao)
  `);
  const insercaoIncluso = db.prepare(`
    INSERT INTO reserva_inclusos (reserva_id, imovel_servico_id, nome_contratado, unidade_preco, quantidade,
                                  preco_contratado, subtotal, valor_comissao)
    VALUES (@reservaId, @inclusoId, @nome, @unidadePreco, @quantidade, @precoUnitario, @subtotal, @valorComissao)
  `);

  const colunasReserva = `
    r.id, r.imovel_id, r.data_checkin, r.data_checkout, r.num_hospedes, r.valor_hospedagem, r.valor_servicos,
    r.valor_total, r.valor_comissao, r.status, r.data_reserva, r.repasse_em, r.hospedagem_reembolsada,
    r.hospede_id, i.anfitriao_id,
    (SELECT COALESCE(SUM(pg.valor_reembolsado), 0) FROM pagamentos pg WHERE pg.reserva_id = r.id) AS valor_reembolsado,
    ${foiPaga('r')} AS foi_paga,
    i.titulo AS imovel_titulo, i.tipo_imovel AS imovel_tipo, i.cidade AS imovel_cidade, i.estado AS imovel_estado,
    i.endereco AS imovel_endereco,
    (SELECT f.url_foto FROM imovel_fotos f WHERE f.imovel_id = i.id ORDER BY f.ordem, f.id LIMIT 1) AS imovel_foto`;

  const consultaDoHospede = db.prepare(`
    SELECT ${colunasReserva}
      FROM reservas r JOIN imoveis i ON i.id = r.imovel_id
     WHERE r.hospede_id = @hospedeId AND ${naoExpirada}
     ORDER BY r.data_checkin DESC, r.id DESC
  `);
  const consultaUmaDoHospede = db.prepare(`
    SELECT ${colunasReserva}
      FROM reservas r JOIN imoveis i ON i.id = r.imovel_id
     WHERE r.id = @id AND r.hospede_id = @hospedeId
  `);
  const consultaPorId = db.prepare(`
    SELECT ${colunasReserva}
      FROM reservas r JOIN imoveis i ON i.id = r.imovel_id
     WHERE r.id = @id
  `);
  const consultaDoAnfitriao = db.prepare(`
    SELECT ${colunasReserva}, h.nome AS hospede_nome, h.telefone AS hospede_telefone
      FROM reservas r
      JOIN imoveis i ON i.id = r.imovel_id
      JOIN usuarios h ON h.id = r.hospede_id
     WHERE i.anfitriao_id = @anfitriaoId AND ${naoExpirada}
     ORDER BY r.data_checkin DESC, r.id DESC
  `);

  const consultaItens = db.prepare(`
    SELECT rs.id, rs.reserva_id, rs.servico_id, rs.data_servico, rs.quantidade, rs.preco_contratado,
           rs.preco_contratado * rs.quantidade AS subtotal, rs.valor_comissao, rs.reembolsado,
           s.tipo_servico, s.unidade_preco, s.prestador_id, p.nome AS prestador
      FROM reserva_servicos rs
      JOIN servicos s ON s.id = rs.servico_id
      JOIN usuarios p ON p.id = s.prestador_id
     WHERE rs.reserva_id IN (SELECT value FROM json_each(@ids))
     ORDER BY rs.data_servico, rs.id
  `);

  const consultaInclusosContratados = db.prepare(`
    SELECT ri.id, ri.reserva_id, ri.imovel_servico_id, ri.nome_contratado, ri.unidade_preco, ri.quantidade,
           ri.preco_contratado, ri.subtotal, ri.valor_comissao, ri.reembolsado
      FROM reserva_inclusos ri
      JOIN imovel_servicos_inclusos si ON si.id = ri.imovel_servico_id
     WHERE ri.reserva_id IN (SELECT value FROM json_each(@ids))
     ORDER BY si.ordem, ri.id
  `);

  // H3.3: cada serviço contratado do prestador, com a reserva a que pertence. De reserva cancelada,
  // só fica o item que NÃO foi reembolsado (RN10: o prestador recebe por ele)
  const consultaAgenda = db.prepare(`
    SELECT rs.id, rs.data_servico, rs.quantidade, rs.preco_contratado,
           rs.preco_contratado * rs.quantidade AS subtotal, rs.valor_comissao, rs.reembolsado,
           s.id AS servico_id, s.tipo_servico, s.unidade_preco,
           r.id AS reserva_id, r.status, r.data_reserva, r.data_checkin, r.data_checkout, r.num_hospedes,
           ${foiPaga('r')} AS foi_paga,
           i.titulo AS imovel_titulo, i.cidade AS imovel_cidade, i.estado AS imovel_estado, i.endereco AS imovel_endereco,
           h.nome AS hospede_nome, h.telefone AS hospede_telefone
      FROM reserva_servicos rs
      JOIN servicos s ON s.id = rs.servico_id
      JOIN reservas r ON r.id = rs.reserva_id
      JOIN imoveis i ON i.id = r.imovel_id
      JOIN usuarios h ON h.id = r.hospede_id
     WHERE s.prestador_id = @prestadorId AND (r.status <> 'cancelada' OR rs.reembolsado = 0) AND ${naoExpirada}
     ORDER BY rs.data_servico, rs.id
  `);

  const atualizacaoStatus = db.prepare('UPDATE reservas SET status = @para WHERE id = @id AND status = @de');
  // CB03: pagamento que chegou depois da expiração, com as datas ainda livres
  const reativacao = db.prepare("UPDATE reservas SET status = 'confirmada' WHERE id = @id AND status IN ('pendente', 'cancelada')");

  // RN07 com rotina: pendentes vencidas, para cancelar a reserva e a cobrança em aberto
  const consultaPendentesVencidas = db.prepare(`
    SELECT r.id FROM reservas r WHERE r.status = 'pendente' AND NOT ${condicaoReservaAtiva('r')} ORDER BY r.id
  `);

  // RN09: pagas, com check-in antes de @hoje e sem repasse feito. O momento exato (24h) é conferido no domínio.
  // Pagamento em 'reembolso_pendente' fica de fora: o dinheiro vai voltar inteiro ao hóspede
  const consultaParaRepasse = db.prepare(`
    SELECT ${colunasReserva}
      FROM reservas r JOIN imoveis i ON i.id = r.imovel_id
     WHERE r.repasse_em IS NULL AND r.data_checkin < @hoje
       AND r.status IN ('confirmada', 'concluida', 'cancelada')
       AND EXISTS (SELECT 1 FROM pagamentos pg WHERE pg.reserva_id = r.id AND pg.status IN ('aprovado', 'reembolsado'))
     ORDER BY r.data_checkin, r.id
  `);
  const gravacaoRepasse = db.prepare("UPDATE reservas SET repasse_em = datetime('now') WHERE id = ? AND repasse_em IS NULL");

  // RN10 + RN20: o que voltou para o hóspede no cancelamento (fica fora do repasse)
  const marcacaoHospedagem = db.prepare('UPDATE reservas SET hospedagem_reembolsada = @valor WHERE id = @reservaId');
  const marcacaoItem = db.prepare('UPDATE reserva_servicos SET reembolsado = @valor WHERE id = @id AND reserva_id = @reservaId');
  const marcacaoIncluso = db.prepare('UPDATE reserva_inclusos SET reembolsado = @valor WHERE id = @id AND reserva_id = @reservaId');

  // RN11: no dia seguinte ao checkout a estadia confirmada está concluída (pode haver serviço no dia do checkout, RN05)
  const conclusaoVencidas = db.prepare(`
    UPDATE reservas SET status = 'concluida' WHERE status = 'confirmada' AND data_checkout < @hoje
  `);

  // `immediate`: trava a escrita já no início, antes das conferências (CB01: duas reservas ao mesmo tempo)
  function emTransacao(funcao) {
    return db.transaction(funcao).immediate();
  }

  // Map: id → serviço visível (RN13). Serviço inativo ou inexistente não entra no Map
  function servicosParaReserva(ids) {
    const linhas = consultaServicos.all({ ...parametroRecebimento, ids: JSON.stringify(ids) });
    return new Map(linhas.map((servico) => [servico.id, servico]));
  }

  // Map: id → incluso ativo do imóvel (RN21: inativo, de outro imóvel ou inexistente não entra no Map)
  function inclusosParaReserva(imovelId, ids) {
    const linhas = consultaInclusos.all({ imovelId, ids: JSON.stringify(ids) });
    return new Map(linhas.map((incluso) => [incluso.id, incluso]));
  }

  function servicoOcupadoNoDia(servicoId, data) {
    return consultaServicoOcupado.get({ servicoId, data }).ocupado === 1;
  }

  // Map: id do serviço → dias da estadia em que ele já está contratado
  function diasOcupadosDosServicos(ids, { checkin, checkout }) {
    const diasPorServico = new Map(ids.map((id) => [id, []]));
    for (const { servico_id, data_servico } of consultaDiasOcupados.all({ ids: JSON.stringify(ids), checkin, checkout })) {
      diasPorServico.get(servico_id).push(data_servico);
    }
    return diasPorServico;
  }

  // `valores` e `itens` já calculados pela precificação (dominio/precificacao.js)
  function inserir({ hospedeId, imovelId, checkin, checkout, numHospedes, valores }) {
    const { lastInsertRowid: reservaId } = insercaoReserva.run({
      hospedeId,
      imovelId,
      checkin,
      checkout,
      numHospedes,
      valorHospedagem: valores.valorHospedagem,
      valorServicos: valores.valorServicos,
      valorTotal: valores.valorTotal,
      valorComissao: valores.valorComissao,
    });
    for (const item of valores.itens) {
      insercaoItem.run({
        reservaId,
        servicoId: item.servicoId,
        data: item.data,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        valorComissao: item.valorComissao,
      });
    }
    for (const incluso of valores.inclusos) {
      insercaoIncluso.run({
        reservaId,
        inclusoId: incluso.inclusoId,
        nome: incluso.nome,
        unidadePreco: incluso.unidadePreco,
        quantidade: incluso.quantidade,
        precoUnitario: incluso.precoUnitario,
        subtotal: incluso.subtotal,
        valorComissao: incluso.valorComissao,
      });
    }
    return reservaId;
  }

  // Cada reserva com os serviços premium (`itens`) e os inclusos do anfitrião (`inclusos`) contratados
  function comItens(reservas) {
    const ids = JSON.stringify(reservas.map((reserva) => reserva.id));
    const itensPorReserva = new Map(reservas.map((reserva) => [reserva.id, []]));
    const inclusosPorReserva = new Map(reservas.map((reserva) => [reserva.id, []]));
    for (const item of consultaItens.all({ ids })) itensPorReserva.get(item.reserva_id).push(item);
    for (const incluso of consultaInclusosContratados.all({ ids })) inclusosPorReserva.get(incluso.reserva_id).push(incluso);
    return reservas.map((reserva) => ({ ...reserva, itens: itensPorReserva.get(reserva.id), inclusos: inclusosPorReserva.get(reserva.id) }));
  }

  // Sem filtro de dono: uso interno (webhook do gateway e rotinas)
  function buscarPorId(id) {
    const reserva = consultaPorId.get({ id });
    return reserva ? comItens([reserva])[0] : null;
  }

  function buscarDoHospede(id, hospedeId) {
    const reserva = consultaUmaDoHospede.get({ id, hospedeId });
    return reserva ? comItens([reserva])[0] : null;
  }

  function listarDoHospede(hospedeId) {
    return comItens(consultaDoHospede.all({ hospedeId }));
  }

  function listarDosImoveisDoAnfitriao(anfitriaoId) {
    return comItens(consultaDoAnfitriao.all({ anfitriaoId }));
  }

  function agendaDoPrestador(prestadorId) {
    return consultaAgenda.all({ prestadorId });
  }

  // Só muda se o status atual ainda for `de` (outra requisição pode ter mudado antes)
  function alterarStatus(id, de, para) {
    return atualizacaoStatus.run({ id, de, para }).changes === 1;
  }

  function reativar(id) {
    return reativacao.run({ id }).changes === 1;
  }

  function pendentesVencidas() {
    return consultaPendentesVencidas.all().map((linha) => linha.id);
  }

  function paraRepasse(hoje) {
    return comItens(consultaParaRepasse.all({ hoje }));
  }

  function gravarRepasseFeito(id) {
    return gravacaoRepasse.run(id).changes === 1;
  }

  // `reembolso`: { hospedagem: bool, itens: [{ id, reembolsado }], inclusos: [{ id, reembolsado }] }
  // (o formato de dominio/cancelamento.js). Grava exatamente o que veio: serve também para desfazer
  function gravarReembolsos(reservaId, reembolso) {
    db.transaction(() => {
      marcacaoHospedagem.run({ reservaId, valor: reembolso.hospedagem ? 1 : 0 });
      for (const item of reembolso.itens) marcacaoItem.run({ reservaId, id: item.id, valor: item.reembolsado ? 1 : 0 });
      for (const incluso of reembolso.inclusos) marcacaoIncluso.run({ reservaId, id: incluso.id, valor: incluso.reembolsado ? 1 : 0 });
    })();
  }

  // `hoje`: dia de Brasília 'YYYY-MM-DD' (CB13). Devolve quantas reservas mudaram
  function concluirVencidas(hoje) {
    return conclusaoVencidas.run({ hoje }).changes;
  }

  return {
    emTransacao,
    servicosParaReserva,
    inclusosParaReserva,
    servicoOcupadoNoDia,
    diasOcupadosDosServicos,
    inserir,
    buscarPorId,
    buscarDoHospede,
    listarDoHospede,
    listarDosImoveisDoAnfitriao,
    agendaDoPrestador,
    alterarStatus,
    reativar,
    pendentesVencidas,
    paraRepasse,
    gravarRepasseFeito,
    gravarReembolsos,
    concluirVencidas,
  };
}

module.exports = { criarRepositorioReservas };
