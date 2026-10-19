// Reservas: o hóspede cria e acompanha; anfitrião e prestador consultam as suas
import { api } from './api.js';

// `itens` do carrinho: [{ servico_id, data_servico, quantidade }]; `inclusos`: ids dos inclusos que o hóspede
// manteve marcados (RN18). Preços não vão: a API recalcula pelo banco
export async function criarReserva({ imovelId, checkin, checkout, hospedes, itens, inclusos }) {
  const { reserva } = await api.post('/reservas', {
    imovel_id: imovelId,
    checkin,
    checkout,
    num_hospedes: hospedes,
    servicos: itens.map(({ servico_id, data_servico, quantidade }) => ({ servico_id, data_servico, quantidade })),
    inclusos,
  });
  return reserva;
}

export async function listarMinhasReservas() {
  const { reservas } = await api.get('/reservas');
  return reservas;
}

export async function desistirDaReserva(id) {
  const { reserva } = await api.post(`/reservas/${encodeURIComponent(id)}/desistir`);
  return reserva;
}

export async function listarReservasRecebidas() {
  const { reservas } = await api.get('/reservas-recebidas');
  return reservas;
}

export async function obterAgenda() {
  const { agenda } = await api.get('/agenda');
  return agenda;
}
