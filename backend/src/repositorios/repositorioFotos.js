const { ErroLimiteFotos } = require('../dominio/erros');

// Fotos de um imóvel. A checagem de dono do imóvel é feita antes, no caso de uso
function criarRepositorioFotos(db) {
  const listagem = db.prepare('SELECT id, url_foto, ordem FROM imovel_fotos WHERE imovel_id = ? ORDER BY ordem, id');
  const contagem = db.prepare('SELECT COUNT(*) AS total FROM imovel_fotos WHERE imovel_id = ?');
  const maiorOrdem = db.prepare('SELECT COALESCE(MAX(ordem), 0) AS ordem FROM imovel_fotos WHERE imovel_id = ?');
  const insercao = db.prepare('INSERT INTO imovel_fotos (imovel_id, url_foto, ordem) VALUES (?, ?, ?)');
  const consultaDoImovel = db.prepare('SELECT id, url_foto, ordem FROM imovel_fotos WHERE id = ? AND imovel_id = ?');
  const remocao = db.prepare('DELETE FROM imovel_fotos WHERE id = ? AND imovel_id = ?');
  const atualizacaoOrdem = db.prepare('UPDATE imovel_fotos SET ordem = ? WHERE id = ? AND imovel_id = ?');

  function listar(imovelId) {
    return listagem.all(imovelId);
  }

  function contar(imovelId) {
    return contagem.get(imovelId).total;
  }

  // Contagem e inserção na mesma transação: dois envios simultâneos não passam do limite.
  // As fotos entram no fim, na ordem recebida
  const adicionar = db.transaction((imovelId, urls, limite) => {
    if (contar(imovelId) + urls.length > limite) throw new ErroLimiteFotos(limite);
    let ordem = maiorOrdem.get(imovelId).ordem;
    for (const url of urls) {
      ordem += 1;
      insercao.run(imovelId, url, ordem);
    }
    return listar(imovelId);
  });

  // Devolve a foto removida (para apagar o arquivo) ou null se ela não é deste imóvel
  const remover = db.transaction((fotoId, imovelId) => {
    const foto = consultaDoImovel.get(fotoId, imovelId);
    if (!foto) return null;
    remocao.run(fotoId, imovelId);
    return foto;
  });

  // `idsEmOrdem` precisa conter exatamente as fotos do imóvel; senão nada muda e devolve null
  const reordenar = db.transaction((imovelId, idsEmOrdem) => {
    const idsAtuais = listar(imovelId).map((foto) => foto.id);
    const mesmoConjunto =
      idsEmOrdem.length === idsAtuais.length &&
      new Set(idsEmOrdem).size === idsAtuais.length &&
      idsEmOrdem.every((id) => idsAtuais.includes(id));
    if (!mesmoConjunto) return null;

    idsEmOrdem.forEach((id, posicao) => atualizacaoOrdem.run(posicao + 1, id, imovelId));
    return listar(imovelId);
  });

  return { listar, contar, adicionar, remover, reordenar };
}

module.exports = { criarRepositorioFotos };
