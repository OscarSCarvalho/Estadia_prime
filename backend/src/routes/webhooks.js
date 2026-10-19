const express = require('express');
const { exigirPerfil } = require('../middleware/auth');
const { ErroWebhookNaoAutorizado, ErroReservaNaoEncontrada } = require('../dominio/erros');
const { lerId } = require('./parametros');

// /api/webhooks/asaas: sem sessão (quem chama é o Asaas). Todo evento precisa do token configurado no
// painel do Asaas, enviado no cabeçalho asaas-access-token; sem ele → 401 e nada muda.
// O processamento é só banco (rápido) e, raramente, um reembolso; a resposta 200 sai logo depois
function criarRotasWebhooks({ gateway, processarEventoPagamento }) {
  const rotas = express.Router();

  rotas.post('/asaas', async (req, res) => {
    if (!gateway.webhookAutorizado(req.get('asaas-access-token'))) throw new ErroWebhookNaoAutorizado();
    const { resultado } = await processarEventoPagamento(req.body);
    res.json({ recebido: true, resultado });
  });

  return rotas;
}

// /api/dev: SÓ em desenvolvimento com o gateway falso (o app.js nem monta estas rotas em outro caso).
// "Simular pagamento" gera o mesmo webhook que o Asaas mandaria
function criarRotasDesenvolvimento({ simularPagamento }) {
  const rotas = express.Router();
  rotas.use(exigirPerfil('hospede'));

  rotas.post('/reservas/:id/simular-pagamento', async (req, res) => {
    const reservaId = lerId(req.params.id, ErroReservaNaoEncontrada);
    res.json(await simularPagamento(req.session.usuario.id, reservaId));
  });

  return rotas;
}

module.exports = { criarRotasWebhooks, criarRotasDesenvolvimento };
