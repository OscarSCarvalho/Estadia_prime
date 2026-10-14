const { ErroArquivoInvalido } = require('./erros');

const TAMANHO_MAXIMO_FOTO_MB = 5;
const TAMANHO_MAXIMO_FOTO_BYTES = TAMANHO_MAXIMO_FOTO_MB * 1024 * 1024;

// CB15: o tipo vem da assinatura dos primeiros bytes, nunca da extensão ou do mimetype enviados.
// SVG fica de fora de propósito: pode carregar script
const ASSINATURAS = [
  { extensao: 'jpg', confere: (bytes) => comeca(bytes, [0xff, 0xd8, 0xff]) },
  { extensao: 'png', confere: (bytes) => comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  {
    extensao: 'webp',
    confere: (bytes) => comeca(bytes, [0x52, 0x49, 0x46, 0x46]) && comeca(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50]),
  },
];

function comeca(bytes, assinatura) {
  return bytes.length >= assinatura.length && assinatura.every((byte, posicao) => bytes[posicao] === byte);
}

function identificarTipoFoto(bytes) {
  return ASSINATURAS.find((tipo) => tipo.confere(bytes))?.extensao ?? null;
}

// Devolve a extensão de cada foto, na mesma ordem. Erra na primeira inválida, antes de salvar qualquer uma
function validarFotos(arquivos) {
  if (!Array.isArray(arquivos) || arquivos.length === 0) {
    throw new ErroArquivoInvalido('Envie pelo menos uma foto');
  }
  return arquivos.map(({ bytes }, posicao) => {
    const numero = arquivos.length > 1 ? ` ${posicao + 1}` : '';
    if (bytes.length > TAMANHO_MAXIMO_FOTO_BYTES) {
      throw new ErroArquivoInvalido(`A foto${numero} passa de ${TAMANHO_MAXIMO_FOTO_MB} MB`);
    }
    const extensao = identificarTipoFoto(bytes);
    if (!extensao) {
      throw new ErroArquivoInvalido(`O arquivo${numero} não é uma foto JPG, PNG ou WEBP`);
    }
    return extensao;
  });
}

module.exports = { TAMANHO_MAXIMO_FOTO_MB, TAMANHO_MAXIMO_FOTO_BYTES, identificarTipoFoto, validarFotos };
