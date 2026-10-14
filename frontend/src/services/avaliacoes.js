// Avaliações (H7): o hóspede avalia a estadia; qualquer visitante lê
import { api } from './api.js';

// `alvo`: { tipo: 'imovel' | 'servico', id }
export async function avaliar(reservaId, { alvo, nota, comentario }) {
  const { avaliacao } = await api.post(`/reservas/${encodeURIComponent(reservaId)}/avaliacoes`, {
    tipo_alvo: alvo.tipo,
    alvo_id: alvo.id,
    nota,
    comentario,
  });
  return avaliacao;
}

const CAMINHO_POR_TIPO = { imovel: 'imoveis', servico: 'servicos' };

// { nota_media, total_avaliacoes, avaliacoes, pagina, total_paginas }
export async function listarAvaliacoes({ tipo, id }, pagina = 1) {
  const consulta = pagina > 1 ? `?pagina=${pagina}` : '';
  return api.get(`/${CAMINHO_POR_TIPO[tipo]}/${encodeURIComponent(id)}/avaliacoes${consulta}`);
}
