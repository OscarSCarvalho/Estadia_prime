// RN09: o dinheiro do anfitrião e dos prestadores fica retido na conta da plataforma e é transferido
// 24h depois do check-in. A taxa do Asaas é absorvida pela plataforma (sai da comissão), então o
// repasse é exatamente o valor gravado na reserva no momento da compra.

// O SPEC trata o check-in como um dia; para contar as 24h, o horário de entrada padrão é 15h de Brasília
const HORA_CHECKIN_BRASILIA = 15;
const HORAS_APOS_CHECKIN = 24;
const MAX_TENTATIVAS_REPASSE = 5;
const UMA_HORA_MS = 3_600_000;

const TIPOS_REPASSE = Object.freeze(['anfitriao', 'prestador']);

// CB13: Brasília é UTC−3 o ano todo (sem horário de verão desde 2019)
function momentoDoRepasse(dataCheckin) {
  const horaCheckin = String(HORA_CHECKIN_BRASILIA).padStart(2, '0');
  return new Date(Date.parse(`${dataCheckin}T${horaCheckin}:00:00-03:00`) + HORAS_APOS_CHECKIN * UMA_HORA_MS);
}

function repasseLiberado(reserva, agora = new Date()) {
  return agora >= momentoDoRepasse(reserva.data_checkin);
}

const naoReembolsados = (linhas) => linhas.filter((linha) => !linha.reembolsado);
const liquido = (linhas) => linhas.reduce((soma, linha) => soma + linha.subtotal - linha.valor_comissao, 0);
const somarComissoes = (linhas) => linhas.reduce((soma, linha) => soma + linha.valor_comissao, 0);

// `reserva`: { valor_hospedagem, valor_comissao (total gravado), hospedagem_reembolsada }
// `itens` (premium): [{ prestador_id, subtotal, valor_comissao, reembolsado }]
// `inclusos`: [{ subtotal, valor_comissao, reembolsado }]
// O que foi reembolsado no cancelamento (RN10/RN20) não é repassado. Devolve só linhas com valor > 0:
// [{ usuarioId, tipo, valor }], uma para o anfitrião e uma para cada prestador
function calcularRepasses({ reserva, anfitriaoId, itens = [], inclusos = [] }) {
  // A comissão total gravada = hospedagem + inclusos + premium; a da hospedagem é o que sobra
  const comissaoHospedagem = reserva.valor_comissao - somarComissoes(inclusos) - somarComissoes(itens);
  const hospedagem = reserva.hospedagem_reembolsada ? 0 : reserva.valor_hospedagem - comissaoHospedagem;

  const repasses = [{ usuarioId: anfitriaoId, tipo: 'anfitriao', valor: hospedagem + liquido(naoReembolsados(inclusos)) }];

  const porPrestador = new Map();
  for (const item of naoReembolsados(itens)) {
    porPrestador.set(item.prestador_id, (porPrestador.get(item.prestador_id) ?? 0) + item.subtotal - item.valor_comissao);
  }
  for (const [usuarioId, valor] of porPrestador) repasses.push({ usuarioId, tipo: 'prestador', valor });

  return repasses.filter((repasse) => repasse.valor > 0);
}

// Para as telas do anfitrião e do prestador. `repasse`: a linha da tabela repasses deste recebedor
// (ou null); `aReceber`: quanto ele recebe desta reserva, já sem o que foi reembolsado
function situacaoDoRepasse({ reserva, repasse, aReceber }) {
  if (repasse) return repasse.status === 'enviado' ? 'enviado' : 'processando';
  if (reserva.status === 'pendente' || aReceber <= 0) return null;
  return 'aguardando_checkin';
}

module.exports = {
  HORA_CHECKIN_BRASILIA,
  HORAS_APOS_CHECKIN,
  MAX_TENTATIVAS_REPASSE,
  TIPOS_REPASSE,
  momentoDoRepasse,
  repasseLiberado,
  calcularRepasses,
  situacaoDoRepasse,
};
