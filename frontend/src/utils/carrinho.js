// Regras do carrinho no navegador, usadas só para montar e exibir o resumo.
// Na Etapa 4a a API recalcula tudo pelo banco e ignora os valores enviados (SPEC: "Preço manipulado no navegador").
import { calcularNoites } from './formatacao.js';

export const NOITES_MAXIMAS = 30;
export const QUANTIDADE_MAXIMA_SERVICO = 10;

const UM_DIA_MS = 86_400_000;

// RN05: o serviço pode acontecer em qualquer dia entre o check-in e o check-out, inclusive
export function diasDaEstadia(checkin, checkout) {
  const noites = calcularNoites(checkin, checkout);
  if (noites === 0) return [];
  const inicio = Date.parse(`${checkin}T00:00:00Z`);
  return Array.from({ length: noites + 1 }, (_, dia) => new Date(inicio + dia * UM_DIA_MS).toISOString().slice(0, 10));
}

// RN14 e RN15
export function problemaNaEstadia({ checkin, checkout, hospedes, capacidade, hoje }) {
  if (!checkin || !checkout) return 'Escolha as datas de check-in e check-out.';
  if (checkin < hoje) return 'O check-in não pode ser no passado.';
  const noites = calcularNoites(checkin, checkout);
  if (noites === 0) return 'O check-out precisa ser depois do check-in.';
  if (noites > NOITES_MAXIMAS) return `A estadia pode ter no máximo ${NOITES_MAXIMAS} noites.`;
  if (!(hospedes >= 1 && hospedes <= capacidade)) return `Este imóvel recebe até ${capacidade} hóspedes.`;
  return null;
}

function mesmoItem(a, b) {
  return a.servico_id === b.servico_id && a.data_servico === b.data_servico;
}

function limitarQuantidade(quantidade) {
  return Math.min(Math.max(quantidade, 1), QUANTIDADE_MAXIMA_SERVICO);
}

// RN06: o mesmo serviço não é contratado duas vezes no mesmo dia; repetir a escolha soma a quantidade
export function adicionarItem(itens, novoItem) {
  const existente = itens.find((item) => mesmoItem(item, novoItem));
  if (!existente) return [...itens, { ...novoItem, quantidade: limitarQuantidade(novoItem.quantidade) }];
  return itens.map((item) =>
    item === existente ? { ...item, quantidade: limitarQuantidade(item.quantidade + novoItem.quantidade) } : item,
  );
}

export function alterarQuantidade(itens, alvo, quantidade) {
  return itens.map((item) => (mesmoItem(item, alvo) ? { ...item, quantidade: limitarQuantidade(quantidade) } : item));
}

export function removerItem(itens, alvo) {
  return itens.filter((item) => !mesmoItem(item, alvo));
}

// Um carrinho salvo pode ficar desatualizado (serviço desativado, agenda do prestador ocupada)
export function manterItensValidos(itens, servicos, dias) {
  const servicosPorId = new Map(servicos.map((servico) => [servico.id, servico]));
  return itens.filter(({ servico_id, data_servico }) => {
    const servico = servicosPorId.get(servico_id);
    return Boolean(servico) && dias.includes(data_servico) && !servico.dias_indisponiveis.includes(data_servico);
  });
}

// RN17: estadia = valor fixo; noite = preço × noites; hospede = preço × nº de hóspedes (mesma regra da API)
export function quantidadeDoIncluso(unidadePreco, { noites, hospedes }) {
  if (unidadePreco === 'noite') return noites;
  if (unidadePreco === 'hospede') return hospedes;
  return 1;
}

// RN01 (noites × diária), RN02 (preço × quantidade) e RN17 (inclusos mantidos pelo hóspede).
// O total é a soma das três partes: hospedagem, serviços inclusos e serviços premium (H5.3)
export function calcularResumo({ precoDiaria, noites, hospedes, itens, servicos, inclusos = [] }) {
  const servicosPorId = new Map(servicos.map((servico) => [servico.id, servico]));
  const linhasServicos = itens
    .map((item) => {
      const servico = servicosPorId.get(item.servico_id);
      return { ...item, servico, valor: servico.preco * item.quantidade };
    })
    .sort((a, b) => a.data_servico.localeCompare(b.data_servico) || a.servico.prestador.localeCompare(b.servico.prestador));

  const linhasInclusos = inclusos.map((incluso) => {
    const quantidade = quantidadeDoIncluso(incluso.unidade_preco, { noites, hospedes });
    return { incluso, quantidade, valor: incluso.preco * quantidade };
  });

  const valorHospedagem = precoDiaria * noites;
  const valorInclusos = linhasInclusos.reduce((soma, linha) => soma + linha.valor, 0);
  const valorServicos = linhasServicos.reduce((soma, linha) => soma + linha.valor, 0);
  return {
    valorHospedagem,
    linhasInclusos,
    valorInclusos,
    linhasServicos,
    valorServicos,
    valorTotal: valorHospedagem + valorInclusos + valorServicos,
  };
}
