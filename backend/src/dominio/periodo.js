const { ErroPeriodoInvalido } = require('./erros');

// CB13: datas de estadia são dias do calendário de Brasília, no formato 'YYYY-MM-DD'
const FUSO_ESTADIAS = 'America/Sao_Paulo';
const NOITES_MAXIMAS = 30;
const UM_DIA_MS = 86_400_000;
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

const formatadorDiaBrasilia = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_ESTADIAS,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function hojeEmBrasilia(agora = new Date()) {
  return formatadorDiaBrasilia.format(agora);
}

// Recusa datas inexistentes como '2026-02-30'
function ehDataValida(texto) {
  if (typeof texto !== 'string' || !FORMATO_DATA.test(texto)) return false;
  const data = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}

// RN01. Conta em UTC, sem horário de verão no caminho
function calcularNoites(checkin, checkout) {
  return Math.round((Date.parse(`${checkout}T00:00:00Z`) - Date.parse(`${checkin}T00:00:00Z`)) / UM_DIA_MS);
}

// RN15 e CB12: check-in hoje é permitido; no passado, não. De 1 a 30 noites
function validarPeriodo({ checkin, checkout, hoje }) {
  if (!ehDataValida(checkin) || !ehDataValida(checkout)) {
    throw new ErroPeriodoInvalido('Informe check-in e check-out no formato AAAA-MM-DD');
  }
  if (checkin < hoje) {
    throw new ErroPeriodoInvalido('O check-in não pode ser no passado');
  }
  const noites = calcularNoites(checkin, checkout);
  if (noites < 1) {
    throw new ErroPeriodoInvalido('O check-out precisa ser depois do check-in');
  }
  if (noites > NOITES_MAXIMAS) {
    throw new ErroPeriodoInvalido(`A estadia pode ter no máximo ${NOITES_MAXIMAS} noites`);
  }
  return { checkin, checkout, noites };
}

// RN04: o dia do checkout pode ser o checkin de outra reserva
function periodosSeSobrepoem(a, b) {
  return a.checkin < b.checkout && b.checkin < a.checkout;
}

// RN05: o serviço pode ser em qualquer dia de checkin a checkout, inclusive
function dataDentroDaEstadia(data, { checkin, checkout }) {
  return data >= checkin && data <= checkout;
}

module.exports = {
  FUSO_ESTADIAS,
  NOITES_MAXIMAS,
  hojeEmBrasilia,
  ehDataValida,
  calcularNoites,
  validarPeriodo,
  periodosSeSobrepoem,
  dataDentroDaEstadia,
};
