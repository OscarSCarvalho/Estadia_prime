// IDs da URL: só inteiros positivos. Qualquer outra coisa é tratada como "não encontrado"
const FORMATO_ID = /^[1-9]\d{0,14}$/;

function lerId(texto, ErroNaoEncontrado) {
  if (!FORMATO_ID.test(texto)) throw new ErroNaoEncontrado();
  return Number(texto);
}

module.exports = { lerId };
