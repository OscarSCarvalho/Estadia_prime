// O banco grava momentos em UTC no formato 'YYYY-MM-DD HH:MM:SS'
export function formatarDataCadastro(dataUtc) {
  if (!dataUtc) return '';
  return new Date(`${dataUtc.replace(' ', 'T')}Z`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatarTelefone(digitos) {
  if (!digitos) return 'Não informado';
  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const meio = numero.length === 9 ? numero.slice(0, 5) : numero.slice(0, 4);
  return `(${ddd}) ${meio}-${numero.slice(meio.length)}`;
}

const formatoMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function formatarMoeda(centavos) {
  return formatoMoeda.format(Math.round(centavos / 100));
}

export function formatarNota(nota) {
  return nota.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Datas de estadia 'YYYY-MM-DD' (sem fuso): calcula em UTC para não sofrer com horário de verão
export function calcularNoites(checkin, checkout) {
  if (!checkin || !checkout) return 0;
  const noites = (Date.parse(`${checkout}T00:00:00Z`) - Date.parse(`${checkin}T00:00:00Z`)) / 86_400_000;
  return noites > 0 ? noites : 0;
}

export function formatarDataCurta(dataIso) {
  if (!dataIso) return '';
  return new Date(`${dataIso}T12:00:00Z`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

// Ex.: "sáb., 14 de nov."
export function formatarDiaDaSemana(dataIso) {
  return new Date(`${dataIso}T12:00:00Z`).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function hojeIso() {
  const agora = new Date();
  const ajusteFuso = agora.getTimezoneOffset() * 60_000;
  return new Date(agora.getTime() - ajusteFuso).toISOString().slice(0, 10);
}

// Para preencher campos de preço: 250000 → "2.500,00" (formato que a API aceita de volta)
export function centavosParaTextoReais(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Ex.: "20 de dez. de 2026" (reservas podem ser de outro ano)
export function formatarDataComAno(dataIso) {
  return new Date(`${dataIso}T12:00:00Z`).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Momento ISO → "14:35" no horário de Brasília
export function formatarHora(momentoIso) {
  return new Date(momentoIso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

// Momento UTC do banco → "outubro de 2026" (data das avaliações)
export function formatarMesAno(dataUtc) {
  return new Date(`${dataUtc.replace(' ', 'T')}Z`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
}
