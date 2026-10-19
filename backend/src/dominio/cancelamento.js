// RN10, política de cancelamento do MVP:
//   - até 7 dias antes do check-in: reembolso integral
//   - com menos de 7 dias: a hospedagem não volta; cada serviço volta se faltarem mais de 48h para o dia dele
// RN20: os serviços inclusos do anfitrião seguem a regra da HOSPEDAGEM (só voltam no reembolso integral).
// O reembolso de verdade (Stripe) é da Etapa 4b; aqui fica só a conta, testável sem gateway.

const ANTECEDENCIA_REEMBOLSO_INTEGRAL_DIAS = 7;
const ANTECEDENCIA_REEMBOLSO_SERVICO_HORAS = 48;
const UMA_HORA_MS = 3_600_000;

// CB13: os dias começam à meia-noite de Brasília. O Brasil não tem horário de verão desde 2019
function inicioDoDiaEmBrasilia(data) {
  return Date.parse(`${data}T00:00:00-03:00`);
}

function horasAte(data, agora) {
  return (inicioDoDiaEmBrasilia(data) - agora.getTime()) / UMA_HORA_MS;
}

const somarReembolsados = (linhas) => linhas.filter((linha) => linha.reembolsado).reduce((soma, linha) => soma + linha.valor, 0);
const semValor = (linhas) => linhas.map(({ id, reembolsado }) => ({ id, reembolsado }));

// `reserva`: { data_checkin, valor_hospedagem }; `itens` (premium): [{ id, data_servico, subtotal }];
// `inclusos`: [{ id, subtotal }]
function calcularReembolso({ reserva, itens, inclusos = [], agora = new Date() }) {
  const integral = horasAte(reserva.data_checkin, agora) >= ANTECEDENCIA_REEMBOLSO_INTEGRAL_DIAS * 24;

  const itensReembolsados = itens.map((item) => ({
    id: item.id,
    reembolsado: integral || horasAte(item.data_servico, agora) > ANTECEDENCIA_REEMBOLSO_SERVICO_HORAS,
    valor: item.subtotal,
  }));
  const inclusosReembolsados = inclusos.map((incluso) => ({ id: incluso.id, reembolsado: integral, valor: incluso.subtotal }));

  const valorHospedagem = integral ? reserva.valor_hospedagem : 0;
  const valorInclusos = somarReembolsados(inclusosReembolsados);
  const valorServicos = somarReembolsados(itensReembolsados);

  return {
    integral,
    valorHospedagem,
    valorInclusos,
    valorServicos,
    valorTotal: valorHospedagem + valorInclusos + valorServicos,
    itens: semValor(itensReembolsados),
    inclusos: semValor(inclusosReembolsados),
  };
}

module.exports = {
  ANTECEDENCIA_REEMBOLSO_INTEGRAL_DIAS,
  ANTECEDENCIA_REEMBOLSO_SERVICO_HORAS,
  calcularReembolso,
};
