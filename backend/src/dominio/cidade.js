// CB11: "búzios ", "BÚZIOS" e "Búzios" precisam virar a mesma cidade. O COLLATE NOCASE do SQLite
// não resolve letras acentuadas, então a cidade é gravada sempre no mesmo formato.
const PARTICULAS_MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const CIDADE_TAMANHO_MAXIMO = 80;
const FORMATO_CIDADE = /^\p{L}[\p{L}' -]*\p{L}$/u;

const UFS = Object.freeze([
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]);

function capitalizar(palavra) {
  return palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1);
}

// Ex.: "  rio   DE janeiro " → "Rio de Janeiro"; "embu-guaçu" → "Embu-Guaçu"
function normalizarCidade(cidade) {
  if (typeof cidade !== 'string') return '';
  return cidade
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((palavra, posicao) =>
      posicao > 0 && PARTICULAS_MINUSCULAS.has(palavra) ? palavra : palavra.split('-').map(capitalizar).join('-'),
    )
    .join(' ');
}

// Devolve a mensagem do problema, ou null se a cidade (já normalizada) é válida
function problemaNaCidade(cidadeNormalizada) {
  if (cidadeNormalizada.length < 2 || cidadeNormalizada.length > CIDADE_TAMANHO_MAXIMO) {
    return `Informe uma cidade entre 2 e ${CIDADE_TAMANHO_MAXIMO} caracteres`;
  }
  if (!FORMATO_CIDADE.test(cidadeNormalizada)) return 'Use apenas letras no nome da cidade';
  return null;
}

function normalizarEstado(estado) {
  return typeof estado === 'string' ? estado.trim().toUpperCase() : '';
}

module.exports = { UFS, normalizarCidade, problemaNaCidade, normalizarEstado };
