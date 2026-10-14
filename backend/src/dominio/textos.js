// Ajudantes de validação compartilhados pelas entidades do domínio
function textoOuVazio(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

// Uma linha: colapsa espaços (títulos, endereços)
function textoEmUmaLinha(valor) {
  return textoOuVazio(valor).replace(/\s+/g, ' ');
}

// Vários parágrafos: mantém as quebras de linha, limita linhas em branco seguidas
function textoLongo(valor) {
  return textoOuVazio(valor)
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

function inteiroEntre(valor, minimo, maximo) {
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo ? numero : null;
}

module.exports = { textoOuVazio, textoEmUmaLinha, textoLongo, inteiroEntre };
