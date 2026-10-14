const { ErroDominio } = require('../dominio/erros');

const STATUS_HTTP_POR_CODIGO = {
  DADOS_INVALIDOS: 400,
  CREDENCIAIS_INVALIDAS: 401,
  NAO_AUTENTICADO: 401,
  ACESSO_NEGADO: 403,
  USUARIO_NAO_ENCONTRADO: 404,
  IMOVEL_NAO_ENCONTRADO: 404,
  SERVICO_NAO_ENCONTRADO: 404,
  FOTO_NAO_ENCONTRADA: 404,
  RESERVA_NAO_ENCONTRADA: 404,
  EMAIL_JA_CADASTRADO: 409,
  IMOVEL_COM_RESERVAS_FUTURAS: 409,
  IMOVEL_INDISPONIVEL: 409,
  PRESTADOR_INDISPONIVEL: 409,
  TRANSICAO_STATUS_INVALIDA: 409,
  RESERVA_NAO_PENDENTE: 409,
  AVALIACAO_REPETIDA: 409,
  AVALIACAO_ANTES_DO_CHECKOUT: 422,
  RESERVA_NAO_AVALIAVEL: 422,
  PRAZO_AVALIACAO_ENCERRADO: 422,
  ALVO_FORA_DA_RESERVA: 422,
  PERIODO_INVALIDO: 422,
  SERVICO_FORA_DA_CIDADE: 422,
  DATA_SERVICO_FORA_DA_ESTADIA: 422,
  SERVICO_INDISPONIVEL: 422,
  CAPACIDADE_EXCEDIDA: 422,
  LIMITE_FOTOS: 400,
  ARQUIVO_INVALIDO: 400,
  MUITAS_TENTATIVAS: 429,
};

function responderErro(res, status, codigo, mensagem, detalhes) {
  res.status(status).json({ erro: { codigo, mensagem, ...(detalhes && { detalhes }) } });
}

function rotaNaoEncontrada(req, res) {
  responderErro(res, 404, 'ROTA_NAO_ENCONTRADA', `Rota ${req.method} ${req.originalUrl} não existe`);
}

function criarTratadorErros({ registrarErro = console.error } = {}) {
  return function tratarErros(erro, _req, res, _next) {
    if (erro instanceof ErroDominio) {
      if (erro.codigo === 'MUITAS_TENTATIVAS') {
        res.set('Retry-After', String(erro.detalhes.segundosParaLiberar));
      }
      return responderErro(res, STATUS_HTTP_POR_CODIGO[erro.codigo] ?? 400, erro.codigo, erro.message, erro.detalhes);
    }
    if (erro.type === 'entity.parse.failed') {
      return responderErro(res, 400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido');
    }
    if (erro.type === 'entity.too.large') {
      return responderErro(res, 413, 'CORPO_GRANDE_DEMAIS', 'A requisição é grande demais');
    }

    registrarErro(erro);
    responderErro(res, 500, 'ERRO_INTERNO', 'Erro interno. Tente novamente em instantes');
  };
}

module.exports = { criarTratadorErros, rotaNaoEncontrada };
