// Etapa 4b (Asaas): pagamento da reserva, cancelamento com reembolso, CPF do usuário e cadastro de
// recebimento do anfitrião/prestador. Valores sempre em centavos; o valor cobrado vem do banco, nunca daqui
import { api } from './api.js';

const caminhoReserva = (id) => `/reservas/${encodeURIComponent(id)}`;

// { reserva, pagamento } — a tela do Pix consulta a cada 5 s até a reserva ficar confirmada
export function obterSituacaoPagamento(reservaId) {
  return api.get(`${caminhoReserva(reservaId)}/pagamento`);
}

// `metodo`: 'pix' | 'cartao'. Chamar de novo com o mesmo método devolve a mesma cobrança
export async function iniciarPagamento(reservaId, metodo) {
  const { pagamento } = await api.post(`${caminhoReserva(reservaId)}/pagamento`, { metodo });
  return pagamento;
}

// Só em desenvolvimento (gateway falso): gera o mesmo aviso que o Asaas mandaria
export function simularPagamento(reservaId) {
  return api.post(`/dev${caminhoReserva(reservaId)}/simular-pagamento`);
}

// { pode_cancelar, motivo, reembolso: { integral, valor_hospedagem, valor_inclusos, valor_servicos, valor_total } }
export function previaCancelamento(reservaId) {
  return api.get(`${caminhoReserva(reservaId)}/cancelamento`);
}

// { reserva, reembolso }
export function cancelarReserva(reservaId) {
  return api.post(`${caminhoReserva(reservaId)}/cancelar`);
}

export async function atualizarDocumento(cpfCnpj) {
  const { usuario } = await api.put('/auth/eu/documento', { cpf_cnpj: cpfCnpj });
  return usuario;
}

// { situacao: 'nao_cadastrado' | 'em_analise' | 'pendente' | 'aprovado' | 'recusado', recebimento_ativo, cpf_cnpj }
export async function obterSituacaoRecebimento() {
  const { recebimento } = await api.get('/recebimento/situacao');
  return recebimento;
}

export async function cadastrarRecebimento(dados) {
  const { recebimento } = await api.post('/recebimento/cadastro', dados);
  return recebimento;
}
