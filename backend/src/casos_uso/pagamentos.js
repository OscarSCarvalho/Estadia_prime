// H6.1 + RN07/RN08 + CB03/CB04: o hóspede paga a reserva (Pix ou cartão) e o webhook do gateway confirma.
// O valor cobrado é sempre o valor_total GRAVADO na reserva, nunca um valor vindo do navegador.
// Transações do SQLite não atravessam um `await`: primeiro as conferências, depois a chamada ao gateway,
// e por fim a gravação com mudanças de status condicionais (WHERE status = ...)
const {
  METODO_NO_BANCO,
  METODO_NA_API,
  validarMetodoPagamento,
  exigirReservaPagavel,
  divergenciaDoPagamento,
  decidirPagamentoAprovado,
  taxaDoGateway,
} = require('../dominio/pagamento');
const { prazoPagamento } = require('../dominio/reserva');
const { hojeEmBrasilia } = require('../dominio/periodo');
const { ErroReservaNaoEncontrada, ErroDocumentoObrigatorio, ErroEventoInvalido, ErroReservaNaoPagavel } = require('../dominio/erros');
const { paraReservaDoHospede } = require('./reservas');

const EVENTOS_PAGO = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);
const EVENTOS_RECUSADO = new Set(['PAYMENT_REPROVED_BY_RISK_ANALYSIS', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED']);
const EVENTO_REEMBOLSADO = 'PAYMENT_REFUNDED';

const diaMes = (data) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

// Pix e fatura só enquanto a cobrança está em aberto. `simulavel`: tela de desenvolvimento (gateway falso)
function paraPagamento(pagamento, gateway) {
  if (!pagamento) return null;
  const aberto = pagamento.status === 'pendente';
  return {
    id: pagamento.id,
    status: pagamento.status,
    metodo: METODO_NA_API[pagamento.metodo] ?? null,
    valor: pagamento.valor_total,
    valor_reembolsado: pagamento.valor_reembolsado,
    expira_em: pagamento.expira_em,
    pix_copia_cola: aberto ? pagamento.pix_copia_cola : null,
    pix_qr_base64: aberto ? pagamento.pix_qr_base64 : null,
    url_fatura: aberto ? pagamento.url_fatura : null,
    simulavel: gateway.simulado && aberto,
  };
}

// Cancela no gateway a cobrança em aberto da reserva (expirada, desistência ou já paga por outra cobrança).
// Se o gateway recusar (ex.: acabou de ser paga), o webhook do pagamento resolve depois (CB03)
function criarCancelarCobrancaAberta({ repositorioPagamentos, gateway, registrarErro = console.error }) {
  return async function cancelarCobrancaAberta(reservaId) {
    const aberto = repositorioPagamentos.abertoDaReserva(reservaId);
    if (!aberto) return false;
    try {
      await gateway.cancelarCobranca(aberto.id_externo);
      return repositorioPagamentos.alterarStatus(aberto.id, 'pendente', 'cancelado');
    } catch (erro) {
      registrarErro(new Error(`Não foi possível cancelar a cobrança ${aberto.id_externo} da reserva ${reservaId}: ${erro.message}`));
      return false;
    }
  };
}

// POST /api/reservas/:id/pagamento { metodo }. Chamar de novo com o mesmo método devolve a mesma
// cobrança; trocar de método cancela a anterior. Devolve o QR do Pix ou o link da fatura do cartão
function criarIniciarPagamento({ repositorioReservas, repositorioPagamentos, repositorioUsuarios, gateway, urlPublicaSite, relogio = () => new Date(), registrarErro = console.error }) {
  return async function iniciarPagamento(hospedeId, reservaId, dados = {}) {
    const metodo = validarMetodoPagamento(dados.metodo);
    const reserva = repositorioReservas.buscarDoHospede(reservaId, hospedeId);
    if (!reserva) throw new ErroReservaNaoEncontrada();
    const agora = relogio();
    exigirReservaPagavel(reserva, agora);
    const hospede = repositorioUsuarios.buscarPorId(hospedeId);
    if (!hospede.cpf_cnpj) throw new ErroDocumentoObrigatorio();

    const aberto = repositorioPagamentos.abertoDaReserva(reservaId);
    if (aberto?.metodo === METODO_NO_BANCO[metodo]) return paraPagamento(aberto, gateway);
    if (aberto) {
      await gateway.cancelarCobranca(aberto.id_externo);
      repositorioPagamentos.alterarStatus(aberto.id, 'pendente', 'cancelado');
    }

    const clienteId = await gateway.garantirCliente({
      id: hospede.id,
      nome: hospede.nome,
      email: hospede.email,
      telefone: hospede.telefone,
      cpfCnpj: hospede.cpf_cnpj,
      asaasClienteId: hospede.asaas_cliente_id,
    });
    if (!hospede.asaas_cliente_id) repositorioUsuarios.gravarClienteGateway(hospedeId, clienteId);

    const cobranca = await gateway.criarCobranca({
      clienteId,
      valor: reserva.valor_total,
      metodo,
      descricao: `Estadia Prime · reserva nº ${reserva.id} · ${reserva.imovel_titulo} · ${diaMes(reserva.data_checkin)} a ${diaMes(reserva.data_checkout)}`,
      referencia: reserva.id,
      vencimento: hojeEmBrasilia(agora),
      urlRetorno: `${urlPublicaSite}/reservas/${reserva.id}/pagamento`,
    });

    const pagamento = repositorioPagamentos.inserir({
      reservaId: reserva.id,
      valorTotal: reserva.valor_total,
      valorComissao: reserva.valor_comissao,
      metodo: METODO_NO_BANCO[metodo],
      idExterno: cobranca.idExterno,
      urlFatura: cobranca.urlFatura,
      pixCopiaCola: cobranca.pixCopiaCola,
      pixQrBase64: cobranca.pixQrBase64,
      expiraEm: prazoPagamento(reserva.data_reserva).toISOString(),
    });
    if (pagamento) return paraPagamento(pagamento, gateway);

    // Outro clique criou a cobrança primeiro: esta sobra é apagada e vale a que já está gravada
    try {
      await gateway.cancelarCobranca(cobranca.idExterno);
    } catch (erro) {
      registrarErro(erro);
    }
    return paraPagamento(repositorioPagamentos.abertoDaReserva(reservaId), gateway);
  };
}

// GET /api/reservas/:id/pagamento: a tela do Pix consulta a cada 5 s até a reserva ficar confirmada
function criarObterSituacaoPagamento({ repositorioReservas, repositorioPagamentos, gateway, relogio = () => new Date() }) {
  return function obterSituacaoPagamento(hospedeId, reservaId) {
    const reserva = repositorioReservas.buscarDoHospede(reservaId, hospedeId);
    if (!reserva) throw new ErroReservaNaoEncontrada();
    return {
      reserva: paraReservaDoHospede(reserva, relogio()),
      pagamento: paraPagamento(repositorioPagamentos.ultimoDaReserva(reservaId), gateway),
    };
  };
}

// Devolve ao hóspede um pagamento marcado 'reembolso_pendente' (CB03). Se o gateway falhar (ex.: Pix recém-
// recebido sem saldo), continua pendente e a rotina de 15 min tenta de novo. A trava em memória impede
// dois reembolsos do mesmo pagamento ao mesmo tempo (webhook repetido + rotina)
function criarReembolsarPagamento({ repositorioPagamentos, gateway, registrarErro = console.error }) {
  const emAndamento = new Set();
  return async function reembolsarPagamento(pagamentoId) {
    if (emAndamento.has(pagamentoId)) return false;
    emAndamento.add(pagamentoId);
    try {
      const pagamento = repositorioPagamentos.buscarPorId(pagamentoId);
      if (pagamento?.status !== 'reembolso_pendente') return false;
      const valor = pagamento.valor_total - pagamento.valor_reembolsado;
      await gateway.reembolsar(pagamento.id_externo, valor, 'Estadia Prime: as datas não estavam mais disponíveis. Valor devolvido integralmente');
      return repositorioPagamentos.registrarReembolso(pagamentoId, valor);
    } catch (erro) {
      registrarErro(new Error(`Reembolso automático do pagamento ${pagamentoId} falhou (nova tentativa na próxima rotina): ${erro.message}`));
      return false;
    } finally {
      emAndamento.delete(pagamentoId);
    }
  };
}

function criarReembolsarPendentes({ repositorioPagamentos, reembolsarPagamento }) {
  return async function reembolsarPendentes() {
    let reembolsados = 0;
    for (const pagamento of repositorioPagamentos.reembolsosPendentes()) {
      if (await reembolsarPagamento(pagamento.id)) reembolsados += 1;
    }
    return { reembolsados };
  };
}

// POST /api/webhooks/asaas (token já conferido na rota). Idempotente pelo id do evento: a gravação do
// evento e as mudanças que ele causa entram na MESMA transação. Eventos que não interessam → ignorados
function criarProcessarEventoPagamento({
  repositorioReservas,
  repositorioPagamentos,
  repositorioBusca,
  gateway,
  atualizarSituacaoRecebimento,
  reembolsarPagamento,
  cancelarCobrancaAberta,
  relogio = () => new Date(),
  registrarErro = console.error,
}) {
  // CB03: a reserva expirada ainda pode ser confirmada se ninguém ocupou as datas nem os prestadores.
  // Ela já não está ativa, então as consultas de disponibilidade não a contam
  function datasLivres(reserva) {
    const periodo = { checkin: reserva.data_checkin, checkout: reserva.data_checkout };
    return repositorioBusca.imovelEstaLivre(reserva.imovel_id, periodo)
      && reserva.itens.every((item) => !repositorioReservas.servicoOcupadoNoDia(item.servico_id, item.data_servico));
  }

  function tudoReembolsado(reserva) {
    return {
      hospedagem: true,
      itens: reserva.itens.map((item) => ({ id: item.id, reembolsado: true })),
      inclusos: reserva.inclusos.map((incluso) => ({ id: incluso.id, reembolsado: true })),
    };
  }

  function pagamentoAprovado(evento) {
    const recebido = evento.pagamento;
    const pagamento = repositorioPagamentos.buscarPorIdExterno(recebido.idExterno);
    if (!pagamento) return { resultado: 'pagamento_desconhecido' };

    const divergencia = divergenciaDoPagamento(pagamento, recebido);
    if (divergencia) {
      registrarErro(new Error(`Webhook ${evento.idEvento} recusado (${divergencia}): pagamento ${pagamento.id}, esperado ${pagamento.valor_total} centavos da reserva ${pagamento.reserva_id}, recebido ${recebido.valor} da referência ${recebido.referencia}`));
      return { resultado: divergencia };
    }

    const taxaGateway = taxaDoGateway(recebido.valor, recebido.valorLiquido);
    const reserva = repositorioReservas.buscarPorId(pagamento.reserva_id);
    const outroPagamentoAprovado = repositorioPagamentos.outroPagoDaReserva(reserva.id, pagamento.id) !== null;
    const precisaConferirDatas = !outroPagamentoAprovado && reserva.status !== 'confirmada';
    const decisao = decidirPagamentoAprovado({
      reserva,
      pagamento,
      outroPagamentoAprovado,
      datasLivres: precisaConferirDatas && datasLivres(reserva),
      agora: relogio(),
    });

    if (decisao === 'ja_processado') {
      repositorioPagamentos.completarTaxa(pagamento.id, taxaGateway);
      return { resultado: 'ja_processado' };
    }
    repositorioPagamentos.aprovar(pagamento.id, { taxaGateway });
    if (decisao === 'confirmar') {
      repositorioReservas.alterarStatus(reserva.id, 'pendente', 'confirmada');
      return { resultado: 'confirmada', reservaId: reserva.id };
    }
    if (decisao === 'reativar') {
      repositorioReservas.reativar(reserva.id);
      return { resultado: 'reativada', reservaId: reserva.id };
    }
    // 'reembolsar': as datas foram tomadas (a reserva fica cancelada e tudo volta) ou pagou duas vezes
    repositorioPagamentos.alterarStatus(pagamento.id, 'aprovado', 'reembolso_pendente');
    if (!outroPagamentoAprovado) {
      repositorioReservas.alterarStatus(reserva.id, 'pendente', 'cancelada');
      repositorioReservas.gravarReembolsos(reserva.id, tudoReembolsado(reserva));
    }
    return { resultado: 'reembolso_automatico', reembolsar: pagamento.id };
  }

  function pagamentoRecusado(evento) {
    const pagamento = repositorioPagamentos.buscarPorIdExterno(evento.pagamento.idExterno);
    if (!pagamento) return { resultado: 'pagamento_desconhecido' };
    return { resultado: repositorioPagamentos.alterarStatus(pagamento.id, 'pendente', 'recusado') ? 'recusado' : 'ja_processado' };
  }

  // Reembolso feito fora do site (ex.: pelo painel do Asaas). Os reembolsos do próprio site já foram gravados
  function pagamentoReembolsado(evento) {
    const pagamento = repositorioPagamentos.buscarPorIdExterno(evento.pagamento.idExterno);
    if (!pagamento) return { resultado: 'pagamento_desconhecido' };
    return { resultado: repositorioPagamentos.registrarReembolsoExterno(pagamento.id) ? 'reembolsado' : 'ja_processado' };
  }

  function escolherTratamento(evento) {
    if (evento.conta) return () => ({ resultado: atualizarSituacaoRecebimento(evento.conta) ? 'conta_atualizada' : 'conta_desconhecida' });
    if (!evento.pagamento) return null;
    if (EVENTOS_PAGO.has(evento.tipo)) return () => pagamentoAprovado(evento);
    if (EVENTOS_RECUSADO.has(evento.tipo)) return () => pagamentoRecusado(evento);
    if (evento.tipo === EVENTO_REEMBOLSADO) return () => pagamentoReembolsado(evento);
    return null;
  }

  return async function processarEventoPagamento(corpo) {
    const evento = gateway.interpretarEvento(corpo);
    if (!evento) throw new ErroEventoInvalido();
    const tratar = escolherTratamento(evento);
    if (!tratar) return { resultado: 'ignorado' };

    const efeito = repositorioPagamentos.emTransacao(() => {
      if (repositorioPagamentos.eventoJaProcessado(evento.idEvento)) return { resultado: 'repetido' };
      const resultado = tratar();
      repositorioPagamentos.registrarEvento(evento.idEvento, evento.tipo);
      return resultado;
    });

    // Depois do commit: chamadas ao gateway (não podem ficar dentro da transação)
    if (efeito.reembolsar) await reembolsarPagamento(efeito.reembolsar);
    if (efeito.reservaId) await cancelarCobrancaAberta(efeito.reservaId);
    return { resultado: efeito.resultado };
  };
}

// RN07 com rotina: a reserva pendente vencida vira cancelada e a cobrança em aberto é apagada no gateway,
// para não ser paga depois (se for paga mesmo assim, o webhook trata: CB03)
function criarExpirarReservasPendentes({ repositorioReservas, cancelarCobrancaAberta }) {
  return async function expirarReservasPendentes() {
    let canceladas = 0;
    for (const reservaId of repositorioReservas.pendentesVencidas()) {
      if (!repositorioReservas.alterarStatus(reservaId, 'pendente', 'cancelada')) continue;
      canceladas += 1;
      await cancelarCobrancaAberta(reservaId);
    }
    return { canceladas };
  };
}

// Só desenvolvimento (GATEWAY_PAGAMENTO=falso): o botão "Simular pagamento" gera o mesmo webhook que o
// Asaas mandaria e passa pelo caminho de produção (processarEventoPagamento)
function criarSimularPagamento({ repositorioReservas, repositorioPagamentos, gateway, processarEventoPagamento }) {
  return async function simularPagamento(hospedeId, reservaId) {
    if (!repositorioReservas.buscarDoHospede(reservaId, hospedeId)) throw new ErroReservaNaoEncontrada();
    const aberto = repositorioPagamentos.abertoDaReserva(reservaId);
    if (!aberto) throw new ErroReservaNaoPagavel('Não há cobrança em aberto para simular');
    return processarEventoPagamento(gateway.eventoPagamento(aberto.id_externo));
  };
}

module.exports = {
  criarCancelarCobrancaAberta,
  criarIniciarPagamento,
  criarObterSituacaoPagamento,
  criarReembolsarPagamento,
  criarReembolsarPendentes,
  criarProcessarEventoPagamento,
  criarExpirarReservasPendentes,
  criarSimularPagamento,
};
