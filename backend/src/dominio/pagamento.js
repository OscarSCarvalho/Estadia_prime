const { ErroDadosInvalidos, ErroReservaNaoPagavel } = require('./erros');
const { estaExpirada } = require('./reserva');

// H6.1: Pix ou cartão de crédito à vista (sem parcelamento no MVP).
// Na API o cartão é 'cartao'; no banco (CHECK do schema) é 'cartao_credito'
const METODOS_PAGAMENTO = Object.freeze(['pix', 'cartao']);
const METODO_NO_BANCO = Object.freeze({ pix: 'pix', cartao: 'cartao_credito' });
const METODO_NA_API = Object.freeze({ pix: 'pix', cartao_credito: 'cartao' });

// Pagamento que já foi aprovado em algum momento (o dinheiro entrou na conta da plataforma)
const STATUS_PAGO = Object.freeze(['aprovado', 'reembolso_pendente', 'reembolsado']);

function validarMetodoPagamento(metodo) {
  if (!METODOS_PAGAMENTO.includes(metodo)) {
    throw new ErroDadosInvalidos({ metodo: `Escolha a forma de pagamento: ${METODOS_PAGAMENTO.join(' ou ')}` });
  }
  return metodo;
}

// RN07: só se paga reserva pendente dentro dos 30 minutos
function exigirReservaPagavel(reserva, agora) {
  if (reserva.status !== 'pendente') throw new ErroReservaNaoPagavel('Esta reserva não está aguardando pagamento');
  if (estaExpirada(reserva, agora)) throw new ErroReservaNaoPagavel('O prazo para pagar esta reserva terminou. Monte o carrinho de novo');
}

// RN08: o webhook só confirma se o pagamento é desta reserva e do valor GRAVADO nela.
// `recebido`: { valor (centavos), referencia } já convertidos pelo adaptador do gateway
function divergenciaDoPagamento(pagamento, recebido) {
  if (recebido.referencia !== String(pagamento.reserva_id)) return 'referencia_divergente';
  if (recebido.valor !== pagamento.valor_total) return 'valor_divergente';
  return null;
}

// O que fazer quando o gateway avisa que um pagamento foi aprovado:
//   'ja_processado' → evento repetido ou fora de ordem (ex.: PAYMENT_RECEIVED depois do PAYMENT_CONFIRMED)
//   'confirmar'     → reserva pendente dentro do prazo (RN08)
//   'reativar'      → CB03: chegou depois da expiração, mas as datas e os prestadores continuam livres
//   'reembolsar'    → CB03: as datas foram tomadas, ou a reserva já tinha sido paga por outra cobrança
function decidirPagamentoAprovado({ reserva, pagamento, outroPagamentoAprovado, datasLivres, agora }) {
  if (STATUS_PAGO.includes(pagamento.status)) return 'ja_processado';
  if (outroPagamentoAprovado) return 'reembolsar';
  if (reserva.status === 'pendente' && !estaExpirada(reserva, agora)) return 'confirmar';
  if (reserva.status === 'pendente' || reserva.status === 'cancelada') return datasLivres ? 'reativar' : 'reembolsar';
  return 'reembolsar';
}

// taxa_gateway = valor cobrado − valor líquido recebido. Sem o líquido (ainda não informado), fica nula
function taxaDoGateway(valor, valorLiquido) {
  if (valorLiquido === null || valorLiquido === undefined) return null;
  return Math.max(0, valor - valorLiquido);
}

module.exports = {
  METODOS_PAGAMENTO,
  METODO_NO_BANCO,
  METODO_NA_API,
  STATUS_PAGO,
  validarMetodoPagamento,
  exigirReservaPagavel,
  divergenciaDoPagamento,
  decidirPagamentoAprovado,
  taxaDoGateway,
};
