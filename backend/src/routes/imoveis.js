const express = require('express');
const { exigirPerfil } = require('../middleware/auth');
const { receberFotos } = require('../middleware/receberFotos');
const { ErroImovelNaoEncontrado, ErroFotoNaoEncontrada } = require('../dominio/erros');
const { lerId } = require('./parametros');

const idDoImovel = (req) => lerId(req.params.id, ErroImovelNaoEncontrado);

// /api/imoveis: público, sem login (RN16)
function criarRotasImoveis({ buscarImoveis, obterImovel, verificarDisponibilidade, listarServicosDaEstadia }) {
  const rotas = express.Router();

  rotas.get('/', (req, res) => {
    res.json(buscarImoveis(req.query));
  });

  rotas.get('/:id', (req, res) => {
    res.json(obterImovel(idDoImovel(req)));
  });

  rotas.get('/:id/disponibilidade', (req, res) => {
    const { checkin, checkout } = req.query;
    res.json(verificarDisponibilidade(idDoImovel(req), { checkin, checkout }));
  });

  // Carrinho: serviços da cidade com os dias da estadia em que o prestador já está contratado
  rotas.get('/:id/servicos', (req, res) => {
    const { checkin, checkout } = req.query;
    res.json({ servicos: listarServicosDaEstadia(idDoImovel(req), { checkin, checkout }) });
  });

  return rotas;
}

// /api/meus-imoveis: painel do anfitrião. Toda rota age só sobre imóveis do usuário logado
function criarRotasMeusImoveis({
  cadastrarImovel,
  editarImovel,
  alterarStatusImovel,
  listarMeusImoveis,
  obterMeuImovel,
  adicionarFotos,
  removerFoto,
  reordenarFotos,
}) {
  const rotas = express.Router();
  rotas.use(exigirPerfil('anfitriao'));
  const anfitriaoId = (req) => req.session.usuario.id;

  rotas.get('/', (req, res) => {
    res.json({ imoveis: listarMeusImoveis(anfitriaoId(req)) });
  });

  rotas.post('/', (req, res) => {
    res.status(201).json({ imovel: cadastrarImovel(anfitriaoId(req), req.body) });
  });

  rotas.get('/:id', (req, res) => {
    res.json({ imovel: obterMeuImovel(anfitriaoId(req), idDoImovel(req)) });
  });

  rotas.put('/:id', (req, res) => {
    res.json({ imovel: editarImovel(anfitriaoId(req), idDoImovel(req), req.body) });
  });

  rotas.patch('/:id/status', (req, res) => {
    res.json({ imovel: alterarStatusImovel(anfitriaoId(req), idDoImovel(req), req.body?.status) });
  });

  // multipart/form-data com as fotos no campo "fotos"
  rotas.post('/:id/fotos', receberFotos, async (req, res) => {
    const fotos = await adicionarFotos(anfitriaoId(req), idDoImovel(req), req.fotosRecebidas);
    res.status(201).json({ fotos });
  });

  rotas.put('/:id/fotos/ordem', (req, res) => {
    res.json({ fotos: reordenarFotos(anfitriaoId(req), idDoImovel(req), req.body?.fotos) });
  });

  rotas.delete('/:id/fotos/:fotoId', async (req, res) => {
    const fotoId = lerId(req.params.fotoId, ErroFotoNaoEncontrada);
    res.json({ fotos: await removerFoto(anfitriaoId(req), idDoImovel(req), fotoId) });
  });

  return rotas;
}

module.exports = { criarRotasImoveis, criarRotasMeusImoveis };
