const express = require('express');
const { exigirPerfil } = require('../middleware/auth');
const { ErroReservaNaoEncontrada, ErroImovelNaoEncontrado, ErroServicoNaoEncontrado } = require('../dominio/erros');
const { lerId } = require('./parametros');

// Montado em /api. Ler avaliações é público (RN16); avaliar é do hóspede dono da reserva (RN11)
function criarRotasAvaliacoes({ avaliar, listarAvaliacoes }) {
  const rotas = express.Router();

  rotas.get('/imoveis/:id/avaliacoes', (req, res) => {
    res.json(listarAvaliacoes('imovel', lerId(req.params.id, ErroImovelNaoEncontrado), req.query));
  });

  rotas.get('/servicos/:id/avaliacoes', (req, res) => {
    res.json(listarAvaliacoes('servico', lerId(req.params.id, ErroServicoNaoEncontrado), req.query));
  });

  // Corpo: { tipo_alvo: 'imovel' | 'servico', alvo_id, nota: 1–5, comentario? }
  rotas.post('/reservas/:id/avaliacoes', exigirPerfil('hospede'), (req, res) => {
    const reservaId = lerId(req.params.id, ErroReservaNaoEncontrada);
    res.status(201).json({ avaliacao: avaliar(req.session.usuario.id, reservaId, req.body) });
  });

  return rotas;
}

module.exports = { criarRotasAvaliacoes };
