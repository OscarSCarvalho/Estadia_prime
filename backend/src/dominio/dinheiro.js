// Dinheiro sempre em centavos inteiros (CONTEXT §5). A conversão aceita:
//   número JS  → 2500 | 2500.5
//   texto pt-BR → "2.500" | "2.500,50" | "R$ 2.500,50" | "2500,5"
// Devolve null quando o valor não é um preço válido (o chamador decide a mensagem).
const FORMATO_REAIS_TEXTO = /^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/;

function reaisParaCentavos(valor) {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor < 0) return null;
    const centavos = Math.round(valor * 100);
    // Mais de 2 casas decimais (ex.: 10.005) não é um preço
    return Math.abs(centavos - valor * 100) < 1e-6 ? centavos : null;
  }

  if (typeof valor !== 'string') return null;
  const texto = valor.replace(/^R\$\s*/, '').trim();
  if (!FORMATO_REAIS_TEXTO.test(texto)) return null;

  const [inteiros, decimais = ''] = texto.replace(/\./g, '').split(',');
  return Number(inteiros) * 100 + Number(decimais.padEnd(2, '0'));
}

function centavosParaReais(centavos) {
  return centavos / 100;
}

module.exports = { reaisParaCentavos, centavosParaReais };
