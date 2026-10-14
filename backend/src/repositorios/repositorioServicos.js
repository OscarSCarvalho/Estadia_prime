const { colunasAvaliacao, condicaoServicoVisivel } = require('./sqlComum');

// `exigirRecebimento` (RN13) vem da configuração: falso só em desenvolvimento, até a Etapa 4b
function criarRepositorioServicos(db, { exigirRecebimento = true } = {}) {
  const parametroRecebimento = { exigirRecebimento: exigirRecebimento ? 1 : 0 };

  const insercao = db.prepare(`
    INSERT INTO servicos (prestador_id, tipo_servico, descricao, preco, unidade_preco, cidade_atuacao)
    VALUES (@prestador_id, @tipo_servico, @descricao, @preco, @unidade_preco, @cidade_atuacao)
  `);
  const consultaDoPrestador = db.prepare('SELECT * FROM servicos WHERE id = ? AND prestador_id = ?');
  const atualizacao = db.prepare(`
    UPDATE servicos
       SET tipo_servico = @tipo_servico, descricao = @descricao, preco = @preco,
           unidade_preco = @unidade_preco, cidade_atuacao = @cidade_atuacao
     WHERE id = @id AND prestador_id = @prestador_id
  `);
  const atualizacaoStatus = db.prepare('UPDATE servicos SET status = ? WHERE id = ? AND prestador_id = ?');
  const listagemDoPrestador = db.prepare(`
    SELECT s.*, ${colunasAvaliacao('servico', 's.id')}
      FROM servicos s
     WHERE s.prestador_id = ?
     ORDER BY s.id DESC
  `);
  // H5.1 e aba "Serviços" do Explorar. CB05: serviço desativado some daqui, mas segue nas reservas existentes
  const listagemVisiveis = db.prepare(`
    SELECT s.id, s.tipo_servico, s.descricao, s.preco, s.unidade_preco, s.cidade_atuacao,
           p.nome AS prestador, ${colunasAvaliacao('servico', 's.id')}
      FROM servicos s
      JOIN usuarios p ON p.id = s.prestador_id
     WHERE ${condicaoServicoVisivel('s', 'p')}
       AND (@cidade IS NULL OR s.cidade_atuacao = @cidade)
       AND (@tipo IS NULL OR s.tipo_servico = @tipo)
     ORDER BY nota_media IS NULL, nota_media DESC, s.id
  `);

  const consultaVisivel = db.prepare(`
    SELECT s.id, s.tipo_servico, s.cidade_atuacao, p.nome AS prestador
      FROM servicos s
      JOIN usuarios p ON p.id = s.prestador_id
     WHERE s.id = @id AND ${condicaoServicoVisivel('s', 'p')}
  `);

  function obterVisivel(id) {
    return consultaVisivel.get({ ...parametroRecebimento, id }) ?? null;
  }

  function buscarDoPrestador(id, prestadorId) {
    return consultaDoPrestador.get(id, prestadorId) ?? null;
  }

  function inserir(prestadorId, dados) {
    const { lastInsertRowid } = insercao.run({ ...dados, prestador_id: prestadorId });
    return buscarDoPrestador(lastInsertRowid, prestadorId);
  }

  function atualizar(id, prestadorId, dados) {
    const { changes } = atualizacao.run({ ...dados, id, prestador_id: prestadorId });
    return changes === 0 ? null : buscarDoPrestador(id, prestadorId);
  }

  function alterarStatus(id, prestadorId, status) {
    const { changes } = atualizacaoStatus.run(status, id, prestadorId);
    return changes === 0 ? null : buscarDoPrestador(id, prestadorId);
  }

  function listarDoPrestador(prestadorId) {
    return listagemDoPrestador.all(prestadorId);
  }

  // `cidade` já normalizada (normalizarCidade) ou null
  function listarVisiveis({ cidade = null, tipo = null } = {}) {
    return listagemVisiveis.all({ ...parametroRecebimento, cidade, tipo });
  }

  return { inserir, buscarDoPrestador, atualizar, alterarStatus, listarDoPrestador, listarVisiveis, obterVisivel };
}

module.exports = { criarRepositorioServicos };
