// H6.3: o hóspede cancela uma reserva confirmada e recebe o reembolso da política RN10 (+ RN20 para os
// inclusos). A prévia e o cancelamento usam a MESMA conta (dominio/cancelamento.js).
// Depois do repasse (RN09) o dinheiro já está com anfitrião e prestadores: o cancelamento vai para o suporte
const { calcularReembolso } = require('../dominio/cancelamento');
const { exigirTransicao, estaExpirada } = require('../dominio/reserva');
const {
  ErroReservaNaoEncontrada,
  ErroReservaNaoCancelavel,
  ErroRepasseJaRealizado,
} = require('../dominio/erros');
const { paraReservaDoHospede } = require('./reservas');

const SEM_REEMBOLSO = Object.freeze({ integral: false, valorHospedagem: 0, valorInclusos: 0, valorServicos: 0, valorTotal: 0, itens: [], inclusos: [] });

function paraReembolso(calculo) {
  return {
    integral: calculo.integral,
    valor_hospedagem: calculo.valorHospedagem,
    valor_inclusos: calculo.valorInclusos,
    valor_servicos: calculo.valorServicos,
    valor_total: calculo.valorTotal,
  };
}

// Pendente dentro do prazo = desistência (nada foi pago). Confirmada = cancelamento com reembolso
function avaliar({ reserva, repositorioPagamentos, repositorioRepasses, agora }) {
  if (reserva.status === 'pendente' && !estaExpirada(reserva, agora)) return { tipo: 'desistencia', calculo: SEM_REEMBOLSO, pagamento: null };
  if (reserva.status !== 'confirmada') throw new ErroReservaNaoCancelavel();
  if (reserva.repasse_em || repositorioRepasses.algumEnviado(reserva.id)) throw new ErroRepasseJaRealizado();
  const pagamento = repositorioPagamentos.outroPagoDaReserva(reserva.id);
  if (pagamento?.status !== 'aprovado') {
    throw new ErroReservaNaoCancelavel('Não encontramos o pagamento desta reserva. Para cancelar, fale com o suporte');
  }
  return { tipo: 'cancelamento', calculo: calcularReembolso({ reserva, itens: reserva.itens, inclusos: reserva.inclusos, agora }), pagamento };
}

// GET /api/reservas/:id/cancelamento: quanto volta, antes de o hóspede confirmar
function criarPreviaCancelamento({ repositorioReservas, repositorioPagamentos, repositorioRepasses, relogio = () => new Date() }) {
  return function previaCancelamento(hospedeId, reservaId) {
    const reserva = repositorioReservas.buscarDoHospede(reservaId, hospedeId);
    if (!reserva) throw new ErroReservaNaoEncontrada();
    try {
      const { calculo } = avaliar({ reserva, repositorioPagamentos, repositorioRepasses, agora: relogio() });
      return { pode_cancelar: true, motivo: null, reembolso: paraReembolso(calculo) };
    } catch (erro) {
      if (!(erro instanceof ErroReservaNaoCancelavel || erro instanceof ErroRepasseJaRealizado)) throw erro;
      return { pode_cancelar: false, motivo: erro.message, reembolso: null };
    }
  };
}

// POST /api/reservas/:id/cancelar. A reserva é "reivindicada" (confirmada → cancelada, com os itens
// marcados) ANTES de chamar o gateway: dois cliques não geram dois reembolsos. Se o reembolso falhar,
// tudo volta ao que era e o hóspede pode tentar de novo
function criarCancelarReserva({ repositorioReservas, repositorioPagamentos, repositorioRepasses, gateway, desistirDaReserva, relogio = () => new Date() }) {
  return async function cancelarReserva(hospedeId, reservaId) {
    const reserva = repositorioReservas.buscarDoHospede(reservaId, hospedeId);
    if (!reserva) throw new ErroReservaNaoEncontrada();
    const agora = relogio();
    const { tipo, calculo, pagamento } = avaliar({ reserva, repositorioPagamentos, repositorioRepasses, agora });
    if (tipo === 'desistencia') {
      return { reserva: await desistirDaReserva(hospedeId, reservaId), reembolso: paraReembolso(calculo) };
    }

    exigirTransicao(reserva.status, 'cancelada');
    const marcas = { hospedagem: calculo.integral, itens: calculo.itens, inclusos: calculo.inclusos };
    const reivindicou = repositorioPagamentos.emTransacao(() => {
      if (!repositorioReservas.alterarStatus(reservaId, 'confirmada', 'cancelada')) return false;
      repositorioReservas.gravarReembolsos(reservaId, marcas);
      return true;
    });
    if (!reivindicou) throw new ErroReservaNaoCancelavel('Esta reserva acabou de mudar de situação. Atualize a página');

    if (calculo.valorTotal > 0) {
      try {
        await gateway.reembolsar(pagamento.id_externo, calculo.valorTotal, `Estadia Prime: cancelamento da reserva nº ${reservaId} pelo hóspede`);
      } catch (erro) {
        repositorioPagamentos.emTransacao(() => {
          repositorioReservas.alterarStatus(reservaId, 'cancelada', 'confirmada');
          repositorioReservas.gravarReembolsos(reservaId, {
            hospedagem: false,
            itens: calculo.itens.map(({ id }) => ({ id, reembolsado: false })),
            inclusos: calculo.inclusos.map(({ id }) => ({ id, reembolsado: false })),
          });
        });
        throw erro;
      }
      repositorioPagamentos.registrarReembolso(pagamento.id, calculo.valorTotal);
    }

    return { reserva: paraReservaDoHospede(repositorioReservas.buscarDoHospede(reservaId, hospedeId), agora), reembolso: paraReembolso(calculo) };
  };
}

module.exports = { criarPreviaCancelamento, criarCancelarReserva };
