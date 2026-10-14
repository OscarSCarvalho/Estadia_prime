// H7.1 e H7.2: o hóspede avalia o imóvel e os serviços da estadia; qualquer visitante lê as avaliações
const {
  AVALIACOES_POR_PAGINA,
  exigirAvaliacaoLiberada,
  exigirAlvoDaReserva,
  validarAvaliacao,
  validarPaginaAvaliacoes,
  primeiroNome,
} = require('../dominio/avaliacao');
const { hojeEmBrasilia } = require('../dominio/periodo');
const { ErroReservaNaoEncontrada, ErroImovelNaoEncontrado, ErroServicoNaoEncontrado } = require('../dominio/erros');

// RN11 sem rotina agendada (como a RN07): toda leitura de reservas conclui antes as que já passaram do checkout
function criarConcluirReservasVencidas({ repositorioReservas, relogio = () => new Date() }) {
  return function concluirReservasVencidas() {
    return repositorioReservas.concluirVencidas(hojeEmBrasilia(relogio()));
  };
}

// SPEC "Avaliações". Reserva de outro hóspede responde 404, como em todo o resto da API
function criarAvaliar({ repositorioReservas, repositorioAvaliacoes, concluirReservasVencidas, relogio = () => new Date() }) {
  return function avaliar(hospedeId, reservaId, dados) {
    const avaliacao = validarAvaliacao(dados);
    concluirReservasVencidas();

    const reserva = repositorioReservas.buscarDoHospede(reservaId, hospedeId);
    if (!reserva) throw new ErroReservaNaoEncontrada();
    exigirAvaliacaoLiberada(reserva, hojeEmBrasilia(relogio()));
    exigirAlvoDaReserva(reserva, avaliacao);

    return repositorioAvaliacoes.inserir({ ...avaliacao, reservaId, autorId: hospedeId });
  };
}

function paraAvaliacaoPublica(avaliacao) {
  return {
    id: avaliacao.id,
    nota: avaliacao.nota,
    comentario: avaliacao.comentario,
    data: avaliacao.data,
    autor: primeiroNome(avaliacao.autor),
  };
}

// Só de imóvel ou serviço que aparece no site (RN13); os demais respondem 404
function criarListarAvaliacoes({ repositorioAvaliacoes, repositorioBusca, repositorioServicos }) {
  const alvoVisivel = {
    imovel: (id) => repositorioBusca.obterImovelVisivel(id),
    servico: (id) => repositorioServicos.obterVisivel(id),
  };
  const ErroNaoEncontrado = { imovel: ErroImovelNaoEncontrado, servico: ErroServicoNaoEncontrado };

  return function listarAvaliacoes(tipoAlvo, alvoId, consulta) {
    if (!alvoVisivel[tipoAlvo](alvoId)) throw new ErroNaoEncontrado[tipoAlvo]();
    const pagina = validarPaginaAvaliacoes(consulta);
    const alvo = { tipoAlvo, alvoId };
    const { nota_media, total_avaliacoes } = repositorioAvaliacoes.resumoDoAlvo(alvo);
    const avaliacoes = repositorioAvaliacoes.listarDoAlvo(alvo, {
      limite: AVALIACOES_POR_PAGINA,
      deslocamento: (pagina - 1) * AVALIACOES_POR_PAGINA,
    });

    return {
      nota_media,
      total_avaliacoes,
      avaliacoes: avaliacoes.map(paraAvaliacaoPublica),
      pagina,
      por_pagina: AVALIACOES_POR_PAGINA,
      total_paginas: Math.ceil(total_avaliacoes / AVALIACOES_POR_PAGINA),
    };
  };
}

module.exports = { criarConcluirReservasVencidas, criarAvaliar, criarListarAvaliacoes };
