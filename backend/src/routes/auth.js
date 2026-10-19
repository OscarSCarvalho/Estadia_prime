const express = require('express');
const { exigirLogin } = require('../middleware/auth');
const { NOME_COOKIE_SESSAO, opcoesCookieSessao } = require('../middleware/sessao');
const { ErroNaoAutenticado, ErroUsuarioNaoEncontrado } = require('../dominio/erros');

function regenerarSessao(req) {
  return new Promise((resolve, reject) => req.session.regenerate((erro) => (erro ? reject(erro) : resolve())));
}

function salvarSessao(req) {
  return new Promise((resolve, reject) => req.session.save((erro) => (erro ? reject(erro) : resolve())));
}

function destruirSessao(req) {
  return new Promise((resolve, reject) => req.session.destroy((erro) => (erro ? reject(erro) : resolve())));
}

// Gera um novo ID de sessão no login para impedir "session fixation"
async function iniciarSessao(req, usuario) {
  await regenerarSessao(req);
  req.session.usuario = { id: usuario.id, tipo: usuario.tipo };
  await salvarSessao(req);
}

function criarRotasAuth({ cadastrarUsuario, autenticarUsuario, obterUsuario, atualizarDocumento, emProducao }) {
  const rotas = express.Router();

  rotas.post('/cadastro', async (req, res) => {
    const usuario = await cadastrarUsuario(req.body ?? {});
    await iniciarSessao(req, usuario);
    res.status(201).json({ usuario });
  });

  rotas.post('/login', async (req, res) => {
    const { email, senha } = req.body ?? {};
    const usuario = await autenticarUsuario({ email, senha, origem: req.ip });
    await iniciarSessao(req, usuario);
    res.json({ usuario });
  });

  rotas.post('/logout', async (req, res) => {
    if (req.session) await destruirSessao(req);
    res.clearCookie(NOME_COOKIE_SESSAO, opcoesCookieSessao(emProducao));
    res.status(204).end();
  });

  rotas.get('/eu', exigirLogin, async (req, res) => {
    try {
      res.json({ usuario: obterUsuario(req.session.usuario.id) });
    } catch (erro) {
      if (!(erro instanceof ErroUsuarioNaoEncontrado)) throw erro;
      await destruirSessao(req);
      throw new ErroNaoAutenticado();
    }
  });

  // CPF/CNPJ do próprio usuário (o hóspede precisa dele para pagar). Volta só mascarado
  rotas.put('/eu/documento', exigirLogin, (req, res) => {
    res.json({ usuario: atualizarDocumento(req.session.usuario.id, req.body?.cpf_cnpj) });
  });

  return rotas;
}

module.exports = { criarRotasAuth };
