// H5.2/H5.3, H2.4 e H3.3: carrinho → reserva pendente, e as listagens de cada perfil.
// O pagamento que confirma a reserva (RN08) chega na Etapa 4b
const { calcularReserva } = require('../dominio/precificacao');
const { validarPedidoReserva, statusExibido, prazoPagamento, exigirTransicao } = require('../dominio/reserva');
const { dataDentroDaEstadia, hojeEmBrasilia } = require('../dominio/periodo');
const { situacaoDaAvaliacao, ultimoDiaParaAvaliar } = require('../dominio/avaliacao');
const {
  ErroImovelNaoEncontrado,
  ErroImovelIndisponivel,
  ErroPrestadorIndisponivel,
  ErroServicoForaDaCidade,
  ErroDataServicoForaDaEstadia,
  ErroServicoIndisponivel,
  ErroCapacidadeExcedida,
  ErroReservaNaoEncontrada,
  ErroReservaNaoPendente,
} = require('../dominio/erros');

// RN12 + LGPD: endereço e telefone só depois da reserva confirmada
function contatoLiberado(reserva) {
  return reserva.status === 'confirmada' || reserva.status === 'concluida';
}

function paraImovel(reserva) {
  return {
    id: reserva.imovel_id,
    titulo: reserva.imovel_titulo,
    tipo_imovel: reserva.imovel_tipo,
    cidade: reserva.imovel_cidade,
    estado: reserva.imovel_estado,
    foto: reserva.imovel_foto,
    endereco: contatoLiberado(reserva) ? reserva.imovel_endereco : null,
  };
}

function paraItem(item) {
  return {
    id: item.id,
    servico_id: item.servico_id,
    tipo_servico: item.tipo_servico,
    unidade_preco: item.unidade_preco,
    prestador: item.prestador,
    data_servico: item.data_servico,
    quantidade: item.quantidade,
    preco_contratado: item.preco_contratado,
    subtotal: item.subtotal,
  };
}

function paraReservaBase(reserva, agora) {
  const status = statusExibido(reserva, agora);
  return {
    id: reserva.id,
    status,
    prazo_pagamento: status === 'pendente' ? prazoPagamento(reserva.data_reserva).toISOString() : null,
    data_checkin: reserva.data_checkin,
    data_checkout: reserva.data_checkout,
    num_hospedes: reserva.num_hospedes,
    valor_hospedagem: reserva.valor_hospedagem,
    valor_servicos: reserva.valor_servicos,
    valor_total: reserva.valor_total,
    imovel: paraImovel(reserva),
    itens: reserva.itens.map(paraItem),
  };
}

// O hóspede vê também se já pode avaliar a estadia (RN11) e o que já avaliou nela
function paraReservaDoHospede(reserva, agora, avaliacoesFeitas = []) {
  const situacao = situacaoDaAvaliacao(reserva, hojeEmBrasilia(agora));
  return {
    ...paraReservaBase(reserva, agora),
    avaliacao: situacao && {
      situacao,
      ultimo_dia: ultimoDiaParaAvaliar(reserva.data_checkout),
      feitas: avaliacoesFeitas,
    },
  };
}

// O anfitrião vê quanto recebe da hospedagem: a comissão dos serviços é a soma gravada em cada item
function paraReservaDoAnfitriao(reserva, agora) {
  const comissaoServicos = reserva.itens.reduce((soma, item) => soma + item.valor_comissao, 0);
  return {
    ...paraReservaBase(reserva, agora),
    repasse_hospedagem: reserva.valor_hospedagem - (reserva.valor_comissao - comissaoServicos),
    hospede: {
      nome: reserva.hospede_nome,
      telefone: contatoLiberado(reserva) ? reserva.hospede_telefone : null,
    },
  };
}

function paraItemDaAgenda(item, agora) {
  return {
    id: item.id,
    data_servico: item.data_servico,
    servico_id: item.servico_id,
    tipo_servico: item.tipo_servico,
    unidade_preco: item.unidade_preco,
    quantidade: item.quantidade,
    preco_contratado: item.preco_contratado,
    subtotal: item.subtotal,
    repasse: item.subtotal - item.valor_comissao,
    reserva: {
      id: item.reserva_id,
      status: statusExibido(item, agora),
      data_checkin: item.data_checkin,
      data_checkout: item.data_checkout,
      num_hospedes: item.num_hospedes,
    },
    imovel: {
      titulo: item.imovel_titulo,
      cidade: item.imovel_cidade,
      estado: item.imovel_estado,
      endereco: contatoLiberado(item) ? item.imovel_endereco : null,
    },
    hospede: { nome: item.hospede_nome, telefone: contatoLiberado(item) ? item.hospede_telefone : null },
  };
}

// SPEC "Carrinho e Criação da Reserva". Conferências e gravação na MESMA transação (CB01):
// ou a reserva entra inteira, com os preços do banco congelados, ou nada é gravado
function criarCriarReserva({ repositorioReservas, repositorioBusca, comissaoHospedagemPct, comissaoServicoPct, relogio = () => new Date() }) {
  return function criarReserva(hospedeId, dados) {
    const agora = relogio();
    const pedido = validarPedidoReserva(dados, { hoje: hojeEmBrasilia(agora) });
    const periodo = { checkin: pedido.checkin, checkout: pedido.checkout };

    const reservaId = repositorioReservas.emTransacao(() => {
      const imovel = repositorioBusca.obterImovelVisivel(pedido.imovelId);
      if (!imovel) throw new ErroImovelNaoEncontrado();
      if (pedido.numHospedes > imovel.num_hospedes) throw new ErroCapacidadeExcedida(imovel.num_hospedes);

      const servicos = repositorioReservas.servicosParaReserva([...new Set(pedido.itens.map((item) => item.servicoId))]);
      for (const item of pedido.itens) {
        const servico = servicos.get(item.servicoId);
        if (!servico) throw new ErroServicoIndisponivel(item.servicoId);
        if (servico.cidade_atuacao !== imovel.cidade) throw new ErroServicoForaDaCidade(item.servicoId);
        if (!dataDentroDaEstadia(item.data, periodo)) throw new ErroDataServicoForaDaEstadia(item);
      }

      if (!repositorioBusca.imovelEstaLivre(imovel.id, periodo)) throw new ErroImovelIndisponivel();
      for (const item of pedido.itens) {
        if (repositorioReservas.servicoOcupadoNoDia(item.servicoId, item.data)) throw new ErroPrestadorIndisponivel(item);
      }

      const valores = calcularReserva({
        precoDiaria: imovel.preco_diaria,
        noites: pedido.noites,
        itens: pedido.itens.map((item) => ({ ...item, precoUnitario: servicos.get(item.servicoId).preco })),
        comissaoHospedagemPct,
        comissaoServicoPct,
      });
      return repositorioReservas.inserir({ hospedeId, imovelId: imovel.id, ...periodo, numHospedes: pedido.numHospedes, valores });
    });

    return paraReservaDoHospede(repositorioReservas.buscarDoHospede(reservaId, hospedeId), agora);
  };
}

function criarListarMinhasReservas({ repositorioReservas, repositorioAvaliacoes, concluirReservasVencidas, relogio = () => new Date() }) {
  return function listarMinhasReservas(hospedeId) {
    concluirReservasVencidas();
    const agora = relogio();
    const reservas = repositorioReservas.listarDoHospede(hospedeId);
    const avaliacoesPorReserva = repositorioAvaliacoes.feitasNasReservas(hospedeId, reservas.map((reserva) => reserva.id));
    return reservas.map((reserva) => paraReservaDoHospede(reserva, agora, avaliacoesPorReserva.get(reserva.id)));
  };
}

function criarListarReservasDoAnfitriao({ repositorioReservas, concluirReservasVencidas, relogio = () => new Date() }) {
  return function listarReservasDoAnfitriao(anfitriaoId) {
    concluirReservasVencidas();
    const agora = relogio();
    return repositorioReservas.listarDosImoveisDoAnfitriao(anfitriaoId).map((reserva) => paraReservaDoAnfitriao(reserva, agora));
  };
}

function criarAgendaDoPrestador({ repositorioReservas, concluirReservasVencidas, relogio = () => new Date() }) {
  return function agendaDoPrestador(prestadorId) {
    concluirReservasVencidas();
    const agora = relogio();
    return repositorioReservas.agendaDoPrestador(prestadorId).map((item) => paraItemDaAgenda(item, agora));
  };
}

// O hóspede desiste de uma reserva que ainda não pagou: libera as datas na hora, sem esperar os 30 min.
// Cancelar reserva confirmada envolve reembolso (RN10) e fica para a Etapa 4b
function criarDesistirDaReserva({ repositorioReservas, relogio = () => new Date() }) {
  return function desistirDaReserva(hospedeId, reservaId) {
    const reserva = repositorioReservas.buscarDoHospede(reservaId, hospedeId);
    if (!reserva) throw new ErroReservaNaoEncontrada();
    if (reserva.status !== 'pendente') throw new ErroReservaNaoPendente();
    exigirTransicao(reserva.status, 'cancelada');
    // Se o status mudou entre a leitura e aqui (ex.: pagamento chegou), nada é alterado
    if (!repositorioReservas.alterarStatus(reservaId, 'pendente', 'cancelada')) throw new ErroReservaNaoPendente();
    return paraReservaDoHospede(repositorioReservas.buscarDoHospede(reservaId, hospedeId), relogio());
  };
}

module.exports = {
  criarCriarReserva,
  criarListarMinhasReservas,
  criarListarReservasDoAnfitriao,
  criarAgendaDoPrestador,
  criarDesistirDaReserva,
};
