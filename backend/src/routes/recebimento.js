const express = require('express');
const { exigirPerfil } = require('../middleware/auth');

const usuarioLogado = (req) => req.session.usuario.id;

// /api/recebimento: H1.3, cadastro da subconta Asaas do anfitrião ou do prestador (RN13)
function criarRotasRecebimento({ iniciarCadastroRecebimento, obterSituacaoRecebimento }) {
  const rotas = express.Router();
  rotas.use(exigirPerfil('anfitriao', 'prestador'));

  rotas.post('/cadastro', async (req, res) => {
    res.status(201).json({ recebimento: await iniciarCadastroRecebimento(usuarioLogado(req), req.body ?? {}) });
  });

  rotas.get('/situacao', async (req, res) => {
    res.json({ recebimento: await obterSituacaoRecebimento(usuarioLogado(req)) });
  });

  return rotas;
}

module.exports = { criarRotasRecebimento };
