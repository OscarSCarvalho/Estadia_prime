const express = require('express');

// /api/cidades: CB11, o frontend oferece estas cidades numa lista em vez de texto livre
function criarRotasCidades({ listarCidades }) {
  const rotas = express.Router();

  rotas.get('/', (_req, res) => {
    res.json({ cidades: listarCidades() });
  });

  return rotas;
}

module.exports = { criarRotasCidades };
