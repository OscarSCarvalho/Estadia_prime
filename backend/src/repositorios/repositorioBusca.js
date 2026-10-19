const {
  condicaoReservaAtiva,
  colunasAvaliacao,
  condicaoImovelVisivel,
  condicaoServicoVisivel,
} = require('./sqlComum');

// Leitura pública (visitante, sem login): só imóveis e serviços visíveis pela RN13.
// Os filtros chegam já validados e normalizados pelo caso de uso; null = filtro não usado.
function criarRepositorioBusca(db, { exigirRecebimento = true } = {}) {
  const parametroRecebimento = { exigirRecebimento: exigirRecebimento ? 1 : 0 };

  // H4.1 + H4.2. Disponibilidade (RN04/RN07), filtro de serviços (json_each: lista de tipos que
  // TODOS precisam ter prestador visível na cidade do imóvel) e de inclusos ativos (RN17) ficam no próprio SQL
  const deImoveisFiltrados = `
      FROM imoveis i
      JOIN usuarios u ON u.id = i.anfitriao_id
     WHERE ${condicaoImovelVisivel('i', 'u')}
       AND (@cidade IS NULL OR i.cidade = @cidade)
       AND (@tipo IS NULL OR i.tipo_imovel = @tipo)
       AND (@hospedes IS NULL OR i.num_hospedes >= @hospedes)
       AND (@precoMin IS NULL OR i.preco_diaria >= @precoMin)
       AND (@precoMax IS NULL OR i.preco_diaria <= @precoMax)
       AND (@comInclusos = 0 OR EXISTS (
             SELECT 1 FROM imovel_servicos_inclusos si WHERE si.imovel_id = i.id AND si.status = 'ativo'))
       AND (@checkin IS NULL OR NOT EXISTS (
             SELECT 1 FROM reservas r
              WHERE r.imovel_id = i.id
                AND r.data_checkin < @checkout AND @checkin < r.data_checkout
                AND ${condicaoReservaAtiva('r')}))
       AND NOT EXISTS (
             SELECT 1 FROM json_each(@servicos) pedido
              WHERE NOT EXISTS (
                SELECT 1 FROM servicos s
                  JOIN usuarios p ON p.id = s.prestador_id
                 WHERE s.cidade_atuacao = i.cidade
                   AND s.tipo_servico = pedido.value
                   AND ${condicaoServicoVisivel('s', 'p')}))`;

  const consultaImoveis = db.prepare(`
    SELECT i.id, i.titulo, i.descricao, i.tipo_imovel, i.cidade, i.estado, i.preco_diaria,
           i.num_hospedes, i.num_quartos, u.nome AS anfitriao,
           (SELECT COUNT(*) FROM imovel_servicos_inclusos si WHERE si.imovel_id = i.id AND si.status = 'ativo') AS qtd_inclusos,
           ${colunasAvaliacao('imovel', 'i.id')}
    ${deImoveisFiltrados}
     ORDER BY nota_media IS NULL, nota_media DESC, i.id DESC
     LIMIT @limite OFFSET @deslocamento
  `);
  const contagemImoveis = db.prepare(`SELECT COUNT(*) AS total ${deImoveisFiltrados}`);

  const consultaImovelVisivel = db.prepare(`
    SELECT i.*, u.nome AS anfitriao, ${colunasAvaliacao('imovel', 'i.id')}
      FROM imoveis i
      JOIN usuarios u ON u.id = i.anfitriao_id
     WHERE i.id = @id AND ${condicaoImovelVisivel('i', 'u')}
  `);

  const consultaImovelLivre = db.prepare(`
    SELECT NOT EXISTS (
      SELECT 1 FROM reservas r
       WHERE r.imovel_id = @id
         AND r.data_checkin < @checkout AND @checkin < r.data_checkout
         AND ${condicaoReservaAtiva('r')}
    ) AS livre
  `);

  const consultaFotos = db.prepare(`
    SELECT imovel_id, url_foto FROM imovel_fotos
     WHERE imovel_id IN (SELECT value FROM json_each(?))
     ORDER BY imovel_id, ordem, id
  `);

  const consultaTiposPorCidade = db.prepare(`
    SELECT DISTINCT s.cidade_atuacao AS cidade, s.tipo_servico
      FROM servicos s
      JOIN usuarios p ON p.id = s.prestador_id
     WHERE ${condicaoServicoVisivel('s', 'p')}
       AND s.cidade_atuacao IN (SELECT value FROM json_each(@cidades))
     ORDER BY s.tipo_servico
  `);

  const consultaCidades = db.prepare(`
    SELECT cidade, MAX(estado) AS estado FROM (
      SELECT i.cidade AS cidade, i.estado AS estado
        FROM imoveis i JOIN usuarios u ON u.id = i.anfitriao_id
       WHERE ${condicaoImovelVisivel('i', 'u')}
      UNION ALL
      SELECT s.cidade_atuacao, NULL
        FROM servicos s JOIN usuarios p ON p.id = s.prestador_id
       WHERE ${condicaoServicoVisivel('s', 'p')}
    )
    GROUP BY cidade
  `);

  function parametrosDaBusca(filtros) {
    return {
      ...parametroRecebimento,
      cidade: filtros.cidade ?? null,
      tipo: filtros.tipo ?? null,
      hospedes: filtros.hospedes ?? null,
      precoMin: filtros.precoMin ?? null,
      precoMax: filtros.precoMax ?? null,
      comInclusos: filtros.comInclusos ? 1 : 0,
      checkin: filtros.checkin ?? null,
      checkout: filtros.checkout ?? null,
      servicos: JSON.stringify(filtros.servicos ?? []),
    };
  }

  function buscarImoveis(filtros = {}, { limite, deslocamento }) {
    const parametros = parametrosDaBusca(filtros);
    return {
      imoveis: consultaImoveis.all({ ...parametros, limite, deslocamento }),
      total: contagemImoveis.get(parametros).total,
    };
  }

  function obterImovelVisivel(id) {
    return consultaImovelVisivel.get({ ...parametroRecebimento, id }) ?? null;
  }

  function imovelEstaLivre(id, { checkin, checkout }) {
    return consultaImovelLivre.get({ id, checkin, checkout }).livre === 1;
  }

  // Map: id do imóvel → URLs das fotos na ordem escolhida pelo anfitrião
  function fotosDosImoveis(ids) {
    const fotosPorImovel = new Map(ids.map((id) => [id, []]));
    for (const { imovel_id, url_foto } of consultaFotos.all(JSON.stringify(ids))) {
      fotosPorImovel.get(imovel_id).push(url_foto);
    }
    return fotosPorImovel;
  }

  // Map: cidade → tipos de serviço com prestador visível nela
  function tiposDeServicoPorCidade(cidades) {
    const tiposPorCidade = new Map(cidades.map((cidade) => [cidade, []]));
    const linhas = consultaTiposPorCidade.all({ ...parametroRecebimento, cidades: JSON.stringify(cidades) });
    for (const { cidade, tipo_servico } of linhas) {
      if (!tiposPorCidade.has(cidade)) tiposPorCidade.set(cidade, []);
      tiposPorCidade.get(cidade).push(tipo_servico);
    }
    return tiposPorCidade;
  }

  // CB11: o frontend oferece estas cidades numa lista em vez de texto livre
  function listarCidades() {
    return consultaCidades
      .all(parametroRecebimento)
      .sort((a, b) => a.cidade.localeCompare(b.cidade, 'pt-BR'));
  }

  return { buscarImoveis, obterImovelVisivel, imovelEstaLivre, fotosDosImoveis, tiposDeServicoPorCidade, listarCidades };
}

module.exports = { criarRepositorioBusca };
