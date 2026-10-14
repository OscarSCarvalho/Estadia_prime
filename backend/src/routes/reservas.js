const express = require('express');
const { exigirPerfil } = require('../middleware/auth');
const { ErroReservaNaoEncontrada } = require('../dominio/erros');
const { lerId } = require('./parametros');

const usuarioLogado = (req) => req.session.usuario.id;

// /api/reservas: o hóspede cria e acompanha as próprias reservas
function criarRotasReservas({ criarReserva, listarMinhasReservas, desistirDaReserva }) {
  const rotas = express.Router();
  rotas.use(exigirPerfil('hospede'));

  rotas.post('/', (req, res) => {
    res.status(201).json({ reserva: criarReserva(usuarioLogado(req), req.body) });
  });

  rotas.get('/', (req, res) => {
    res.json({ reservas: listarMinhasReservas(usuarioLogado(req)) });
  });

  rotas.post('/:id/desistir', (req, res) => {
    const reservaId = lerId(req.params.id, ErroReservaNaoEncontrada);
    res.json({ reserva: desistirDaReserva(usuarioLogado(req), reservaId) });
  });

  return rotas;
}

// /api/reservas-recebidas: H2.4, reservas dos imóveis do anfitrião logado
function criarRotasReservasRecebidas({ listarReservasDoAnfitriao }) {
  const rotas = express.Router();
  rotas.use(exigirPerfil('anfitriao'));

  rotas.get('/', (req, res) => {
    res.json({ reservas: listarReservasDoAnfitriao(usuarioLogado(req)) });
  });

  return rotas;
}

// /api/agenda: H3.3, serviços contratados do prestador logado, por data
function criarRotasAgenda({ agendaDoPrestador }) {
  const rotas = express.Router();
  rotas.use(exigirPerfil('prestador'));

  rotas.get('/', (req, res) => {
    res.json({ agenda: agendaDoPrestador(usuarioLogado(req)) });
  });

  return rotas;
}

module.exports = { criarRotasReservas, criarRotasReservasRecebidas, criarRotasAgenda };
