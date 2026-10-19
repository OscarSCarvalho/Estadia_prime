const express = require('express');
const { exigirPerfil } = require('../middleware/auth');
const { ErroReservaNaoEncontrada } = require('../dominio/erros');
const { lerId } = require('./parametros');

const usuarioLogado = (req) => req.session.usuario.id;

// /api/reservas: o hóspede cria e acompanha as próprias reservas
function criarRotasReservas({
  criarReserva,
  listarMinhasReservas,
  desistirDaReserva,
  iniciarPagamento,
  obterSituacaoPagamento,
  previaCancelamento,
  cancelarReserva,
}) {
  const rotas = express.Router();
  rotas.use(exigirPerfil('hospede'));

  rotas.post('/', (req, res) => {
    res.status(201).json({ reserva: criarReserva(usuarioLogado(req), req.body) });
  });

  rotas.get('/', (req, res) => {
    res.json({ reservas: listarMinhasReservas(usuarioLogado(req)) });
  });

  rotas.post('/:id/desistir', async (req, res) => {
    const reservaId = lerId(req.params.id, ErroReservaNaoEncontrada);
    res.json({ reserva: await desistirDaReserva(usuarioLogado(req), reservaId) });
  });

  // H6.1: { metodo: 'pix' | 'cartao' } → QR do Pix ou link da fatura do Asaas
  rotas.post('/:id/pagamento', async (req, res) => {
    const reservaId = lerId(req.params.id, ErroReservaNaoEncontrada);
    res.json({ pagamento: await iniciarPagamento(usuarioLogado(req), reservaId, req.body ?? {}) });
  });

  rotas.get('/:id/pagamento', (req, res) => {
    const reservaId = lerId(req.params.id, ErroReservaNaoEncontrada);
    res.json(obterSituacaoPagamento(usuarioLogado(req), reservaId));
  });

  // H6.3: prévia (quanto volta) e o cancelamento em si, com a mesma conta (RN10 + RN20)
  rotas.get('/:id/cancelamento', (req, res) => {
    const reservaId = lerId(req.params.id, ErroReservaNaoEncontrada);
    res.json(previaCancelamento(usuarioLogado(req), reservaId));
  });

  rotas.post('/:id/cancelar', async (req, res) => {
    const reservaId = lerId(req.params.id, ErroReservaNaoEncontrada);
    res.json(await cancelarReserva(usuarioLogado(req), reservaId));
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
