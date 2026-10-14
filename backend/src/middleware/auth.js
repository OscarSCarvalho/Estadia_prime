const { ErroNaoAutenticado, ErroAcessoNegado } = require('../dominio/erros');

function exigirLogin(req, _res, next) {
  if (!req.session?.usuario) return next(new ErroNaoAutenticado());
  next();
}

function exigirPerfil(...perfisPermitidos) {
  return function verificarPerfil(req, _res, next) {
    const usuarioLogado = req.session?.usuario;
    if (!usuarioLogado) return next(new ErroNaoAutenticado());
    if (!perfisPermitidos.includes(usuarioLogado.tipo)) return next(new ErroAcessoNegado());
    next();
  };
}

module.exports = { exigirLogin, exigirPerfil };
