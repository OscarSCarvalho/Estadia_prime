// Painéis do anfitrião (/api/meus-imoveis) e do prestador (/api/meus-servicos)
import { api, ErroApi } from './api.js';

const caminhoImovel = (id) => `/meus-imoveis/${encodeURIComponent(id)}`;

export async function listarMeusImoveis() {
  const { imoveis } = await api.get('/meus-imoveis');
  return imoveis;
}

// 404 (não existe ou é de outro anfitrião) vira null
export async function obterMeuImovel(id) {
  try {
    const { imovel } = await api.get(caminhoImovel(id));
    return imovel;
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 404) return null;
    throw erro;
  }
}

export async function cadastrarImovel(dados) {
  const { imovel } = await api.post('/meus-imoveis', dados);
  return imovel;
}

export async function editarImovel(id, dados) {
  const { imovel } = await api.put(caminhoImovel(id), dados);
  return imovel;
}

export async function alterarStatusImovel(id, status) {
  const { imovel } = await api.patch(`${caminhoImovel(id)}/status`, { status });
  return imovel;
}

// `arquivos`: File[] escolhidos no navegador, na ordem em que devem entrar
export async function enviarFotos(id, arquivos) {
  const formulario = new FormData();
  for (const arquivo of arquivos) formulario.append('fotos', arquivo);
  const { fotos } = await api.post(`${caminhoImovel(id)}/fotos`, formulario);
  return fotos;
}

export async function reordenarFotos(id, idsEmOrdem) {
  const { fotos } = await api.put(`${caminhoImovel(id)}/fotos/ordem`, { fotos: idsEmOrdem });
  return fotos;
}

export async function removerFoto(id, fotoId) {
  const { fotos } = await api.delete(`${caminhoImovel(id)}/fotos/${encodeURIComponent(fotoId)}`);
  return fotos;
}

// RN17: serviços inclusos do imóvel (o painel mostra também os inativos)
const caminhoInclusos = (id) => `${caminhoImovel(id)}/inclusos`;

export async function listarInclusos(id) {
  const { inclusos } = await api.get(caminhoInclusos(id));
  return inclusos;
}

export async function cadastrarIncluso(id, dados) {
  const { incluso } = await api.post(caminhoInclusos(id), dados);
  return incluso;
}

export async function editarIncluso(id, inclusoId, dados) {
  const { incluso } = await api.put(`${caminhoInclusos(id)}/${encodeURIComponent(inclusoId)}`, dados);
  return incluso;
}

export async function alterarStatusIncluso(id, inclusoId, status) {
  const { incluso } = await api.patch(`${caminhoInclusos(id)}/${encodeURIComponent(inclusoId)}/status`, { status });
  return incluso;
}

export async function reordenarInclusos(id, idsEmOrdem) {
  const { inclusos } = await api.put(`${caminhoInclusos(id)}/ordem`, { inclusos: idsEmOrdem });
  return inclusos;
}

export async function removerIncluso(id, inclusoId) {
  const { inclusos } = await api.delete(`${caminhoInclusos(id)}/${encodeURIComponent(inclusoId)}`);
  return inclusos;
}

export async function listarMeusServicos() {
  const { servicos } = await api.get('/meus-servicos');
  return servicos;
}

export async function cadastrarServico(dados) {
  const { servico } = await api.post('/meus-servicos', dados);
  return servico;
}

export async function editarServico(id, dados) {
  const { servico } = await api.put(`/meus-servicos/${encodeURIComponent(id)}`, dados);
  return servico;
}

export async function alterarStatusServico(id, status) {
  const { servico } = await api.patch(`/meus-servicos/${encodeURIComponent(id)}/status`, { status });
  return servico;
}
