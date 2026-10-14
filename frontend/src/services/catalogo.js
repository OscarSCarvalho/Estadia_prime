// Catálogo público (sem login, RN16): imóveis, serviços e cidades vindos da API
import { api, ErroApi } from './api.js';
import { fotoDoServico } from '../utils/perfis.js';

// A tabela de serviços não tem foto: cada tipo usa uma foto padrão da marca
function comFoto(servico) {
  return { ...servico, foto: fotoDoServico(servico.tipo_servico) };
}

function consulta(parametros) {
  const preenchidos = Object.entries(parametros).filter(([, valor]) =>
    Array.isArray(valor) ? valor.length > 0 : valor !== '' && valor !== null && valor !== undefined,
  );
  const texto = new URLSearchParams(preenchidos.map(([nome, valor]) => [nome, String(valor)])).toString();
  return texto ? `?${texto}` : '';
}

// 404 vira null: a tela mostra "não encontrado" em vez de erro
async function nuloSeNaoEncontrado(promessa) {
  try {
    return await promessa;
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 404) return null;
    throw erro;
  }
}

export async function listarCidades() {
  const { cidades } = await api.get('/cidades');
  return cidades;
}

// Os filtros da tela guardam a diária em centavos; a API recebe em reais, como no cadastro
export async function buscarImoveis(filtros = {}) {
  const { cidade, checkin, checkout, hospedes, tipo, precoMin, precoMax, servicos = [], pagina } = filtros;
  return api.get(
    `/imoveis${consulta({
      cidade,
      checkin: checkin && checkout ? checkin : '',
      checkout: checkin && checkout ? checkout : '',
      hospedes,
      tipo,
      preco_min: precoMin ? precoMin / 100 : '',
      preco_max: precoMax ? precoMax / 100 : '',
      servicos: servicos.join(','),
      pagina: pagina > 1 ? pagina : '',
    })}`,
  );
}

export async function obterImovel(id) {
  const detalhe = await nuloSeNaoEncontrado(api.get(`/imoveis/${encodeURIComponent(id)}`));
  return detalhe && { imovel: detalhe.imovel, servicos: detalhe.servicos.map(comFoto) };
}

// Sem as duas datas não há o que verificar. Período inválido (passado, invertido) fica para
// a validação da tela, que mostra a mensagem certa: aqui responde "livre"
export async function verificarDisponibilidade(id, checkin, checkout) {
  if (!checkin || !checkout || checkout <= checkin) return true;
  try {
    const { livre } = await api.get(`/imoveis/${encodeURIComponent(id)}/disponibilidade${consulta({ checkin, checkout })}`);
    return livre;
  } catch (erro) {
    if (erro instanceof ErroApi && erro.codigo === 'PERIODO_INVALIDO') return true;
    if (erro instanceof ErroApi && erro.status === 404) return false;
    throw erro;
  }
}

// Serviços que podem ir no carrinho (RN05: mesma cidade do imóvel), cada um com os dias
// desta estadia em que o prestador já está contratado (RN06)
// Período inválido devolve lista vazia: a tela do carrinho já mostra o problema das datas
export async function listarServicosDaEstadia(id, checkin, checkout) {
  try {
    const detalhe = await nuloSeNaoEncontrado(
      api.get(`/imoveis/${encodeURIComponent(id)}/servicos${consulta({ checkin, checkout })}`),
    );
    return (detalhe?.servicos ?? []).map(comFoto);
  } catch (erro) {
    if (erro instanceof ErroApi && erro.codigo === 'PERIODO_INVALIDO') return [];
    throw erro;
  }
}

export async function buscarServicos({ cidade, tipo } = {}) {
  const { servicos } = await api.get(`/servicos${consulta({ cidade, tipo })}`);
  return servicos.map(comFoto);
}
