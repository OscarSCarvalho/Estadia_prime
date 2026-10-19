// RN09: 24h depois do check-in, a plataforma transfere para a subconta (walletId) de cada recebedor o
// repasse gravado na reserva. Roda na rotina de 15 min (server.js); os testes chamam direto, com `agora`
const { calcularRepasses, repasseLiberado, MAX_TENTATIVAS_REPASSE } = require('../dominio/repasse');
const { hojeEmBrasilia } = require('../dominio/periodo');

function criarExecutarRepasses({ repositorioReservas, repositorioRepasses, gateway, relogio = () => new Date(), registrarErro = console.error }) {
  async function enviar(repasse) {
    if (!repasse.wallet_id || repasse.recebimento_ativo !== 1) {
      return { ok: false, erro: 'O recebedor não tem subconta Asaas aprovada' };
    }
    try {
      const transferencia = await gateway.transferirParaCarteira(repasse.wallet_id, repasse.valor, `repasse-${repasse.id}`);
      repositorioRepasses.marcarEnviado(repasse.id, transferencia.idExterno);
      return { ok: true };
    } catch (erro) {
      return { ok: false, erro: erro.message };
    }
  }

  return async function executarRepasses({ agora = relogio() } = {}) {
    const resumo = { reservas: 0, enviados: 0, falhas: 0 };
    for (const reserva of repositorioReservas.paraRepasse(hojeEmBrasilia(agora))) {
      if (!repasseLiberado(reserva, agora)) continue;
      resumo.reservas += 1;
      repositorioRepasses.criarPendentes(
        reserva.id,
        calcularRepasses({ reserva, anfitriaoId: reserva.anfitriao_id, itens: reserva.itens, inclusos: reserva.inclusos }),
      );

      for (const repasse of repositorioRepasses.aEnviarDaReserva(reserva.id)) {
        const resultado = await enviar(repasse);
        if (resultado.ok) {
          resumo.enviados += 1;
          continue;
        }
        resumo.falhas += 1;
        const tentativas = repositorioRepasses.marcarFalha(repasse.id, resultado.erro);
        if (tentativas >= MAX_TENTATIVAS_REPASSE) {
          registrarErro(new Error(`Repasse ${repasse.id} (reserva ${reserva.id}, usuário ${repasse.usuario_id}) falhou ${tentativas} vezes e não será tentado de novo: ${resultado.erro}. Resolver pelo painel do Asaas`));
        }
      }

      // Todos enviados (ou nada a repassar, como no reembolso integral): a reserva sai da fila
      if (repositorioRepasses.faltandoNaReserva(reserva.id) === 0) repositorioReservas.gravarRepasseFeito(reserva.id);
    }
    return resumo;
  };
}

module.exports = { criarExecutarRepasses };
