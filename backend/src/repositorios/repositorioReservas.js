const { condicaoReservaAtiva, condicaoServicoVisivel } = require('./sqlComum');

// Reservas e seus serviços. As regras (RN04–RN07, RN12, RN14) ficam no caso de uso e no domínio;
// aqui só SQL parametrizado. Pendentes vencidas (RN07) não aparecem em nenhuma listagem.
function criarRepositorioReservas(db, { exigirRecebimento = true } = {}) {
  const parametroRecebimento = { exigirRecebimento: exigirRecebimento ? 1 : 0 };
  const naoExpirada = `(r.status <> 'pendente' OR ${condicaoReservaAtiva('r')})`;

  const consultaServicos = db.prepare(`
    SELECT s.id, s.prestador_id, s.tipo_servico, s.preco, s.unidade_preco, s.cidade_atuacao, p.nome AS prestador
      FROM servicos s
      JOIN usuarios p ON p.id = s.prestador_id
     WHERE s.id IN (SELECT value FROM json_each(@ids))
       AND ${condicaoServicoVisivel('s', 'p')}
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

  const colunasReserva = `
    r.id, r.imovel_id, r.data_checkin, r.data_checkout, r.num_hospedes, r.valor_hospedagem, r.valor_servicos,
    r.valor_total, r.valor_comissao, r.status, r.data_reserva,
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
           rs.preco_contratado * rs.quantidade AS subtotal, rs.valor_comissao,
           s.tipo_servico, s.unidade_preco, p.nome AS prestador
      FROM reserva_servicos rs
      JOIN servicos s ON s.id = rs.servico_id
      JOIN usuarios p ON p.id = s.prestador_id
     WHERE rs.reserva_id IN (SELECT value FROM json_each(@ids))
     ORDER BY rs.data_servico, rs.id
  `);

  // H3.3: cada serviço contratado do prestador, com a reserva a que pertence. Canceladas ficam de fora
  const consultaAgenda = db.prepare(`
    SELECT rs.id, rs.data_servico, rs.quantidade, rs.preco_contratado,
           rs.preco_contratado * rs.quantidade AS subtotal, rs.valor_comissao,
           s.id AS servico_id, s.tipo_servico, s.unidade_preco,
           r.id AS reserva_id, r.status, r.data_reserva, r.data_checkin, r.data_checkout, r.num_hospedes,
           i.titulo AS imovel_titulo, i.cidade AS imovel_cidade, i.estado AS imovel_estado, i.endereco AS imovel_endereco,
           h.nome AS hospede_nome, h.telefone AS hospede_telefone
      FROM reserva_servicos rs
      JOIN servicos s ON s.id = rs.servico_id
      JOIN reservas r ON r.id = rs.reserva_id
      JOIN imoveis i ON i.id = r.imovel_id
      JOIN usuarios h ON h.id = r.hospede_id
     WHERE s.prestador_id = @prestadorId AND r.status <> 'cancelada' AND ${naoExpirada}
     ORDER BY rs.data_servico, rs.id
  `);

  const atualizacaoStatus = db.prepare('UPDATE reservas SET status = @para WHERE id = @id AND status = @de');

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
    return reservaId;
  }

  function comItens(reservas) {
    const itensPorReserva = new Map(reservas.map((reserva) => [reserva.id, []]));
    for (const item of consultaItens.all({ ids: JSON.stringify(reservas.map((reserva) => reserva.id)) })) {
      itensPorReserva.get(item.reserva_id).push(item);
    }
    return reservas.map((reserva) => ({ ...reserva, itens: itensPorReserva.get(reserva.id) }));
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

  // `hoje`: dia de Brasília 'YYYY-MM-DD' (CB13). Devolve quantas reservas mudaram
  function concluirVencidas(hoje) {
    return conclusaoVencidas.run({ hoje }).changes;
  }

  return {
    emTransacao,
    servicosParaReserva,
    servicoOcupadoNoDia,
    diasOcupadosDosServicos,
    inserir,
    buscarDoHospede,
    listarDoHospede,
    listarDosImoveisDoAnfitriao,
    agendaDoPrestador,
    alterarStatus,
    concluirVencidas,
  };
}

module.exports = { criarRepositorioReservas };
