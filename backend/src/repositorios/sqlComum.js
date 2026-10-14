// Trechos de SQL repetidos entre repositórios. Só recebem nomes de alias escritos no código,
// nunca dados do usuário (que entram sempre como parâmetros).
const { PRAZO_PAGAMENTO_MINUTOS } = require('../dominio/reserva');

// RN04 + RN07: ocupa datas a reserva confirmada, ou pendente ainda dentro do prazo de pagamento.
// data_reserva é UTC 'YYYY-MM-DD HH:MM:SS', o mesmo formato de datetime('now'), então comparar como texto funciona
function condicaoReservaAtiva(alias) {
  return `(${alias}.status = 'confirmada' OR (${alias}.status = 'pendente' AND ${alias}.data_reserva > datetime('now', '-${PRAZO_PAGAMENTO_MINUTOS} minutes')))`;
}

function colunasAvaliacao(tipoAlvo, colunaId) {
  return `
    (SELECT ROUND(AVG(av.nota), 2) FROM avaliacoes av WHERE av.tipo_alvo = '${tipoAlvo}' AND av.alvo_id = ${colunaId}) AS nota_media,
    (SELECT COUNT(*) FROM avaliacoes av WHERE av.tipo_alvo = '${tipoAlvo}' AND av.alvo_id = ${colunaId}) AS total_avaliacoes`;
}

// RN13: ativo, dono com recebimento concluído (quando exigido) e, no caso do imóvel, pelo menos 1 foto.
// @exigirRecebimento é um parâmetro (0/1) fixado na criação do repositório
function condicaoImovelVisivel(aliasImovel, aliasAnfitriao) {
  return `${aliasImovel}.status = 'ativo'
    AND (@exigirRecebimento = 0 OR ${aliasAnfitriao}.recebimento_ativo = 1)
    AND EXISTS (SELECT 1 FROM imovel_fotos fv WHERE fv.imovel_id = ${aliasImovel}.id)`;
}

function condicaoServicoVisivel(aliasServico, aliasPrestador) {
  return `${aliasServico}.status = 'ativo'
    AND (@exigirRecebimento = 0 OR ${aliasPrestador}.recebimento_ativo = 1)`;
}

module.exports = { condicaoReservaAtiva, colunasAvaliacao, condicaoImovelVisivel, condicaoServicoVisivel };
