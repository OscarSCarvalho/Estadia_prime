const multer = require('multer');
const { TAMANHO_MAXIMO_FOTO_BYTES, TAMANHO_MAXIMO_FOTO_MB } = require('../dominio/foto');
const { LIMITE_FOTOS_IMOVEL } = require('../dominio/imovel');
const { ErroArquivoInvalido, ErroLimiteFotos } = require('../dominio/erros');

const CAMPO_FOTOS = 'fotos';

// Em memória: o arquivo só vai para o disco depois de o caso de uso conferir os bytes (CB15).
// O multer corta o envio no primeiro arquivo acima de 5 MB, sem ler o resto
const lerFormulario = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO_FOTO_BYTES, files: LIMITE_FOTOS_IMOVEL, fields: 0 },
}).array(CAMPO_FOTOS, LIMITE_FOTOS_IMOVEL);

function traduzirErro(erro) {
  if (erro.code === 'LIMIT_FILE_SIZE') {
    return new ErroArquivoInvalido(`Cada foto pode ter no máximo ${TAMANHO_MAXIMO_FOTO_MB} MB`);
  }
  if (erro.code === 'LIMIT_FILE_COUNT' || (erro.code === 'LIMIT_UNEXPECTED_FILE' && erro.field === CAMPO_FOTOS)) {
    return new ErroLimiteFotos(LIMITE_FOTOS_IMOVEL);
  }
  if (erro instanceof multer.MulterError) {
    return new ErroArquivoInvalido(`Envie apenas fotos, no campo "${CAMPO_FOTOS}"`);
  }
  // Com armazenamento em memória, qualquer outro erro aqui é um formulário malformado
  return new ErroArquivoInvalido('Não foi possível ler as fotos enviadas');
}

// Entrega ao caso de uso só os bytes, na ordem enviada. Nome e mimetype do navegador são ignorados
function receberFotos(req, res, next) {
  lerFormulario(req, res, (erro) => {
    if (erro) return next(traduzirErro(erro));
    req.fotosRecebidas = (req.files ?? []).map((arquivo) => ({ bytes: arquivo.buffer }));
    next();
  });
}

module.exports = { receberFotos, CAMPO_FOTOS };
