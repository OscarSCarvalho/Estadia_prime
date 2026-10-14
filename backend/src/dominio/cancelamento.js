// RN10, política de cancelamento do MVP:
//   - até 7 dias antes do check-in: reembolso integral
//   - com menos de 7 dias: a hospedagem não volta; cada serviço volta se faltarem mais de 48h para o dia dele
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

// `reserva`: { data_checkin, valor_hospedagem }; `itens`: [{ id, data_servico, subtotal }]
function calcularReembolso({ reserva, itens, agora = new Date() }) {
  const integral = horasAte(reserva.data_checkin, agora) >= ANTECEDENCIA_REEMBOLSO_INTEGRAL_DIAS * 24;

  const itensReembolsados = itens.map((item) => ({
    id: item.id,
    reembolsado: integral || horasAte(item.data_servico, agora) > ANTECEDENCIA_REEMBOLSO_SERVICO_HORAS,
    valor: item.subtotal,
  }));

  const valorHospedagem = integral ? reserva.valor_hospedagem : 0;
  const valorServicos = itensReembolsados.filter((item) => item.reembolsado).reduce((soma, item) => soma + item.valor, 0);

  return {
    integral,
    valorHospedagem,
    valorServicos,
    valorTotal: valorHospedagem + valorServicos,
    itens: itensReembolsados.map(({ id, reembolsado }) => ({ id, reembolsado })),
  };
}

module.exports = {
  ANTECEDENCIA_REEMBOLSO_INTEGRAL_DIAS,
  ANTECEDENCIA_REEMBOLSO_SERVICO_HORAS,
  calcularReembolso,
};
