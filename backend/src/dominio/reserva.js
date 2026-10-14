const { ErroDadosInvalidos, ErroTransicaoStatusInvalida } = require('./erros');
const { ehDataValida, validarPeriodo } = require('./periodo');
const { inteiroEntre } = require('./textos');

// RN07: reserva pendente sem pagamento aprovado expira depois deste prazo e libera as datas
const PRAZO_PAGAMENTO_MINUTOS = 30;
const QUANTIDADE_MAXIMA_SERVICO = 10;
const ITENS_MAXIMOS_POR_RESERVA = 60;
const HOSPEDES_MAXIMO = 50;

const STATUS_RESERVA = Object.freeze(['pendente', 'confirmada', 'cancelada', 'concluida']);

// RN08 + CB04: só estas mudanças de status existem. "confirmada" só vem do pagamento (Etapa 4b)
const TRANSICOES = Object.freeze({
  pendente: ['confirmada', 'cancelada'],
  confirmada: ['cancelada', 'concluida'],
  cancelada: [],
  concluida: [],
});

function podeMudarStatus(de, para) {
  return TRANSICOES[de]?.includes(para) ?? false;
}

function exigirTransicao(de, para) {
  if (!podeMudarStatus(de, para)) throw new ErroTransicaoStatusInvalida(de, para);
  return para;
}

// `dataReserva`: momento UTC 'YYYY-MM-DD HH:MM:SS', como o banco grava
function prazoPagamento(dataReserva) {
  return new Date(Date.parse(`${dataReserva.replace(' ', 'T')}Z`) + PRAZO_PAGAMENTO_MINUTOS * 60_000);
}

// RN07 sem rotina agendada: a pendente vencida é tratada como cancelada em toda leitura
function estaExpirada(reserva, agora = new Date()) {
  return reserva.status === 'pendente' && agora >= prazoPagamento(reserva.data_reserva);
}

// RN04: confirmada, ou pendente ainda dentro do prazo de pagamento, ocupa as datas
function estaAtiva(reserva, agora = new Date()) {
  return reserva.status === 'confirmada' || (reserva.status === 'pendente' && !estaExpirada(reserva, agora));
}

// Status mostrado nas telas: a pendente vencida aparece como "expirada"
function statusExibido(reserva, agora = new Date()) {
  return estaExpirada(reserva, agora) ? 'expirada' : reserva.status;
}

// Carrinho enviado pelo navegador → pedido validado. Valores em dinheiro são ignorados de propósito:
// o preço vem sempre do banco. O mesmo serviço no mesmo dia vira um item só (quantidades somadas)
function validarPedidoReserva(dados = {}, { hoje }) {
  const camposInvalidos = {};
  const imovelId = inteiroEntre(dados.imovel_id, 1, Number.MAX_SAFE_INTEGER);
  if (imovelId === null) camposInvalidos.imovel_id = 'Informe o imóvel';

  const numHospedes = inteiroEntre(dados.num_hospedes, 1, HOSPEDES_MAXIMO);
  if (numHospedes === null) camposInvalidos.num_hospedes = `Informe de 1 a ${HOSPEDES_MAXIMO} hóspedes`;

  const servicos = dados.servicos ?? [];
  const itensPorChave = new Map();
  if (!Array.isArray(servicos) || servicos.length > ITENS_MAXIMOS_POR_RESERVA) {
    camposInvalidos.servicos = `Envie uma lista com até ${ITENS_MAXIMOS_POR_RESERVA} serviços`;
  } else {
    for (const item of servicos) {
      const servicoId = inteiroEntre(item?.servico_id, 1, Number.MAX_SAFE_INTEGER);
      const quantidade = inteiroEntre(item?.quantidade, 1, QUANTIDADE_MAXIMA_SERVICO);
      const data = item?.data_servico;
      if (servicoId === null || quantidade === null || !ehDataValida(data)) {
        camposInvalidos.servicos = `Cada serviço precisa de servico_id, data_servico (AAAA-MM-DD) e quantidade de 1 a ${QUANTIDADE_MAXIMA_SERVICO}`;
        break;
      }
      const chave = `${servicoId}|${data}`;
      const anterior = itensPorChave.get(chave);
      const total = (anterior?.quantidade ?? 0) + quantidade;
      if (total > QUANTIDADE_MAXIMA_SERVICO) {
        camposInvalidos.servicos = `No máximo ${QUANTIDADE_MAXIMA_SERVICO} unidades do mesmo serviço no mesmo dia`;
        break;
      }
      itensPorChave.set(chave, { servicoId, data, quantidade: total });
    }
  }

  if (Object.keys(camposInvalidos).length > 0) throw new ErroDadosInvalidos(camposInvalidos);

  const periodo = validarPeriodo({ checkin: dados.checkin, checkout: dados.checkout, hoje });
  return { imovelId, numHospedes, ...periodo, itens: [...itensPorChave.values()] };
}

module.exports = {
  PRAZO_PAGAMENTO_MINUTOS,
  QUANTIDADE_MAXIMA_SERVICO,
  STATUS_RESERVA,
  podeMudarStatus,
  exigirTransicao,
  prazoPagamento,
  estaExpirada,
  estaAtiva,
  statusExibido,
  validarPedidoReserva,
};
