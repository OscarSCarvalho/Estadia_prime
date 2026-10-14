const express = require('express');
const { exigirPerfil } = require('../middleware/auth');
const { ErroServicoNaoEncontrado } = require('../dominio/erros');
const { lerId } = require('./parametros');

// /api/servicos: público, sem login (RN16). Filtros opcionais ?cidade= e ?tipo=
function criarRotasServicos({ buscarServicos }) {
  const rotas = express.Router();

  rotas.get('/', (req, res) => {
    res.json({ servicos: buscarServicos(req.query) });
  });

  return rotas;
}

// /api/meus-servicos: painel do prestador. Toda rota age só sobre serviços do usuário logado
function criarRotasMeusServicos({ cadastrarServico, editarServico, alterarStatusServico, listarMeusServicos }) {
  const rotas = express.Router();
  rotas.use(exigirPerfil('prestador'));
  const prestadorId = (req) => req.session.usuario.id;
  const idDoServico = (req) => lerId(req.params.id, ErroServicoNaoEncontrado);

  rotas.get('/', (req, res) => {
    res.json({ servicos: listarMeusServicos(prestadorId(req)) });
  });

  rotas.post('/', (req, res) => {
    res.status(201).json({ servico: cadastrarServico(prestadorId(req), req.body) });
  });

  rotas.put('/:id', (req, res) => {
    res.json({ servico: editarServico(prestadorId(req), idDoServico(req), req.body) });
  });

  rotas.patch('/:id/status', (req, res) => {
    res.json({ servico: alterarStatusServico(prestadorId(req), idDoServico(req), req.body?.status) });
  });

  return rotas;
}

module.exports = { criarRotasServicos, criarRotasMeusServicos };
