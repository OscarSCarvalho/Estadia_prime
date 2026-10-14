const session = require('express-session');
const { ArmazemSessoesSqlite } = require('../adaptadores/armazemSessoesSqlite');

const NOME_COOKIE_SESSAO = 'estadia.sid';
const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;

function criarMiddlewareSessao({ db, segredo, emProducao }) {
  const armazem = new ArmazemSessoesSqlite(db);

  const middleware = session({
    name: NOME_COOKIE_SESSAO,
    secret: segredo,
    store: armazem,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: emProducao,
      maxAge: DURACAO_SESSAO_MS,
    },
  });

  return { middleware, armazem };
}

function opcoesCookieSessao(emProducao) {
  return { httpOnly: true, sameSite: 'lax', secure: emProducao, path: '/' };
}

module.exports = { criarMiddlewareSessao, opcoesCookieSessao, NOME_COOKIE_SESSAO };
