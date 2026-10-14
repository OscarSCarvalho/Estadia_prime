const { condicaoReservaAtiva, colunasAvaliacao } = require('./sqlComum');

// Operações do anfitrião sobre os próprios imóveis. Toda consulta filtra por anfitriao_id:
// imóvel de outro dono se comporta como inexistente (SPEC: "Editar imóvel de outro anfitrião" → 404)
function criarRepositorioImoveis(db) {
  const insercao = db.prepare(`
    INSERT INTO imoveis (anfitriao_id, titulo, descricao, tipo_imovel, endereco, cidade, estado,
                         preco_diaria, num_hospedes, num_quartos)
    VALUES (@anfitriao_id, @titulo, @descricao, @tipo_imovel, @endereco, @cidade, @estado,
            @preco_diaria, @num_hospedes, @num_quartos)
  `);
  const consultaDoAnfitriao = db.prepare('SELECT * FROM imoveis WHERE id = ? AND anfitriao_id = ?');
  const atualizacao = db.prepare(`
    UPDATE imoveis
       SET titulo = @titulo, descricao = @descricao, tipo_imovel = @tipo_imovel, endereco = @endereco,
           cidade = @cidade, estado = @estado, preco_diaria = @preco_diaria,
           num_hospedes = @num_hospedes, num_quartos = @num_quartos
     WHERE id = @id AND anfitriao_id = @anfitriao_id
  `);
  const atualizacaoStatus = db.prepare('UPDATE imoveis SET status = ? WHERE id = ? AND anfitriao_id = ?');
  const listagemDoAnfitriao = db.prepare(`
    SELECT i.*,
           (SELECT COUNT(*) FROM imovel_fotos f WHERE f.imovel_id = i.id) AS total_fotos,
           (SELECT f.url_foto FROM imovel_fotos f WHERE f.imovel_id = i.id ORDER BY f.ordem, f.id LIMIT 1) AS foto_capa,
           ${colunasAvaliacao('imovel', 'i.id')}
      FROM imoveis i
     WHERE i.anfitriao_id = ?
     ORDER BY i.data_cadastro DESC, i.id DESC
  `);
  // CB06: reserva ativa que ainda não terminou (checkout depois de hoje)
  const consultaReservasFuturas = db.prepare(`
    SELECT EXISTS (
      SELECT 1 FROM reservas r
       WHERE r.imovel_id = ? AND r.data_checkout > ? AND ${condicaoReservaAtiva('r')}
    ) AS possui
  `);

  function buscarDoAnfitriao(id, anfitriaoId) {
    return consultaDoAnfitriao.get(id, anfitriaoId) ?? null;
  }

  function inserir(anfitriaoId, dados) {
    const { lastInsertRowid } = insercao.run({ ...dados, anfitriao_id: anfitriaoId });
    return buscarDoAnfitriao(lastInsertRowid, anfitriaoId);
  }

  function atualizar(id, anfitriaoId, dados) {
    const { changes } = atualizacao.run({ ...dados, id, anfitriao_id: anfitriaoId });
    return changes === 0 ? null : buscarDoAnfitriao(id, anfitriaoId);
  }

  function alterarStatus(id, anfitriaoId, status) {
    const { changes } = atualizacaoStatus.run(status, id, anfitriaoId);
    return changes === 0 ? null : buscarDoAnfitriao(id, anfitriaoId);
  }

  function listarDoAnfitriao(anfitriaoId) {
    return listagemDoAnfitriao.all(anfitriaoId);
  }

  function possuiReservasFuturas(imovelId, hoje) {
    return consultaReservasFuturas.get(imovelId, hoje).possui === 1;
  }

  return { inserir, buscarDoAnfitriao, atualizar, alterarStatus, listarDoAnfitriao, possuiReservasFuturas };
}

module.exports = { criarRepositorioImoveis };
