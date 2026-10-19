const { ErroLimiteInclusos, ErroServicoInclusoContratado } = require('../dominio/erros');

// RN17: serviços inclusos de um imóvel. A checagem de dono do imóvel é feita antes, no caso de uso;
// aqui toda consulta filtra também por imovel_id (incluso de outro imóvel = inexistente)
function criarRepositorioServicosInclusos(db) {
  const colunas = 'id, imovel_id, nome, descricao, preco, unidade_preco, status, ordem, data_cadastro';
  const listagem = db.prepare(`SELECT ${colunas} FROM imovel_servicos_inclusos WHERE imovel_id = ? ORDER BY ordem, id`);
  const listagemAtivos = db.prepare(`
    SELECT id, nome, descricao, preco, unidade_preco
      FROM imovel_servicos_inclusos
     WHERE imovel_id = ? AND status = 'ativo'
     ORDER BY ordem, id
  `);
  const consultaDoImovel = db.prepare(`SELECT ${colunas} FROM imovel_servicos_inclusos WHERE id = ? AND imovel_id = ?`);
  const contagem = db.prepare('SELECT COUNT(*) AS total FROM imovel_servicos_inclusos WHERE imovel_id = ?');
  const maiorOrdem = db.prepare('SELECT COALESCE(MAX(ordem), 0) AS ordem FROM imovel_servicos_inclusos WHERE imovel_id = ?');
  const insercao = db.prepare(`
    INSERT INTO imovel_servicos_inclusos (imovel_id, nome, descricao, preco, unidade_preco, ordem)
    VALUES (@imovelId, @nome, @descricao, @preco, @unidade_preco, @ordem)
  `);
  const atualizacao = db.prepare(`
    UPDATE imovel_servicos_inclusos
       SET nome = @nome, descricao = @descricao, preco = @preco, unidade_preco = @unidade_preco
     WHERE id = @id AND imovel_id = @imovelId
  `);
  const atualizacaoStatus = db.prepare('UPDATE imovel_servicos_inclusos SET status = ? WHERE id = ? AND imovel_id = ?');
  const atualizacaoOrdem = db.prepare('UPDATE imovel_servicos_inclusos SET ordem = ? WHERE id = ? AND imovel_id = ?');
  const consultaContratado = db.prepare('SELECT EXISTS (SELECT 1 FROM reserva_inclusos WHERE imovel_servico_id = ?) AS contratado');
  const remocao = db.prepare('DELETE FROM imovel_servicos_inclusos WHERE id = ? AND imovel_id = ?');

  function listar(imovelId) {
    return listagem.all(imovelId);
  }

  // Página do imóvel e carrinho: só os ativos, na ordem do anfitrião
  function listarAtivos(imovelId) {
    return listagemAtivos.all(imovelId);
  }

  function buscar(id, imovelId) {
    return consultaDoImovel.get(id, imovelId) ?? null;
  }

  // Contagem e inserção na mesma transação: dois cadastros ao mesmo tempo não passam do limite.
  // O novo incluso entra no fim da lista
  const inserir = db.transaction((imovelId, dados, limite) => {
    if (contagem.get(imovelId).total >= limite) throw new ErroLimiteInclusos(limite);
    const ordem = maiorOrdem.get(imovelId).ordem + 1;
    const { lastInsertRowid } = insercao.run({ ...dados, imovelId, ordem });
    return buscar(lastInsertRowid, imovelId);
  });

  function atualizar(id, imovelId, dados) {
    const { changes } = atualizacao.run({ ...dados, id, imovelId });
    return changes === 0 ? null : buscar(id, imovelId);
  }

  function alterarStatus(id, imovelId, status) {
    const { changes } = atualizacaoStatus.run(status, id, imovelId);
    return changes === 0 ? null : buscar(id, imovelId);
  }

  // `idsEmOrdem` precisa conter exatamente os inclusos do imóvel; senão nada muda e devolve null
  const reordenar = db.transaction((imovelId, idsEmOrdem) => {
    const idsAtuais = listar(imovelId).map((incluso) => incluso.id);
    const mesmoConjunto =
      idsEmOrdem.length === idsAtuais.length &&
      new Set(idsEmOrdem).size === idsAtuais.length &&
      idsEmOrdem.every((id) => idsAtuais.includes(id));
    if (!mesmoConjunto) return null;

    idsEmOrdem.forEach((id, posicao) => atualizacaoOrdem.run(posicao + 1, id, imovelId));
    return listar(imovelId);
  });

  // Devolve false se o incluso não é deste imóvel. Já contratado → erro (o histórico da reserva precisa dele)
  const remover = db.transaction((id, imovelId) => {
    if (!buscar(id, imovelId)) return false;
    if (consultaContratado.get(id).contratado === 1) throw new ErroServicoInclusoContratado();
    remocao.run(id, imovelId);
    return true;
  });

  return { listar, listarAtivos, buscar, inserir, atualizar, alterarStatus, reordenar, remover };
}

module.exports = { criarRepositorioServicosInclusos };
