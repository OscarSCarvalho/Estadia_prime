const { ErroDadosInvalidos, ErroPeriodoInvalido } = require('./erros');
const { reaisParaCentavos } = require('./dinheiro');
const { normalizarCidade } = require('./cidade');
const { TIPOS_IMOVEL } = require('./imovel');
const { TIPOS_SERVICO } = require('./servico');
const { validarPeriodo } = require('./periodo');
const { textoOuVazio, inteiroEntre } = require('./textos');

const IMOVEIS_POR_PAGINA = 20;
const PAGINA_MAXIMA = 10_000;
const HOSPEDES_MAXIMO = 50;

// Parâmetro repetido na URL (?tipo=a&tipo=b) chega como lista: vale o primeiro
function primeiroValor(valor) {
  return textoOuVazio(Array.isArray(valor) ? valor[0] : valor);
}

// Aceita "mordomo,barman" e também ?servicos=mordomo&servicos=barman
function listaDeValores(valor) {
  const valores = (Array.isArray(valor) ? valor : [valor]).flatMap((item) => textoOuVazio(item).split(','));
  return [...new Set(valores.map((item) => item.trim()).filter(Boolean))];
}

// H4.1. Parâmetros da URL (texto) → filtros do repositório. Campo vazio = filtro não usado.
// Preços chegam em reais, como no cadastro, e saem em centavos
function validarFiltrosBusca(consulta = {}, { hoje }) {
  const camposInvalidos = {};
  const texto = (nome) => primeiroValor(consulta[nome]);

  const cidade = normalizarCidade(texto('cidade')) || null;

  const tipo = texto('tipo') || null;
  if (tipo && !TIPOS_IMOVEL.includes(tipo)) camposInvalidos.tipo = `Tipos aceitos: ${TIPOS_IMOVEL.join(', ')}`;

  const hospedes = texto('hospedes') ? inteiroEntre(texto('hospedes'), 1, HOSPEDES_MAXIMO) : null;
  if (texto('hospedes') && hospedes === null) camposInvalidos.hospedes = `Informe de 1 a ${HOSPEDES_MAXIMO} hóspedes`;

  const precoMin = texto('preco_min') ? reaisParaCentavos(texto('preco_min')) : null;
  const precoMax = texto('preco_max') ? reaisParaCentavos(texto('preco_max')) : null;
  if (texto('preco_min') && precoMin === null) camposInvalidos.preco_min = 'Informe a diária mínima em reais';
  if (texto('preco_max') && precoMax === null) camposInvalidos.preco_max = 'Informe a diária máxima em reais';
  if (precoMin !== null && precoMax !== null && precoMin > precoMax) {
    camposInvalidos.preco_max = 'A diária máxima precisa ser maior que a mínima';
  }

  const servicos = listaDeValores(consulta.servicos);
  if (servicos.some((servico) => !TIPOS_SERVICO.includes(servico))) {
    camposInvalidos.servicos = `Serviços aceitos: ${TIPOS_SERVICO.join(', ')}`;
  }

  const pagina = texto('pagina') ? inteiroEntre(texto('pagina'), 1, PAGINA_MAXIMA) : 1;
  if (pagina === null) camposInvalidos.pagina = 'Página inválida';

  if (Object.keys(camposInvalidos).length > 0) throw new ErroDadosInvalidos(camposInvalidos);

  const periodo = validarPeriodoOpcional({ checkin: texto('checkin'), checkout: texto('checkout'), hoje });

  return {
    filtros: { cidade, tipo, hospedes, precoMin, precoMax, servicos, ...periodo },
    pagina,
  };
}

// Sem datas, a busca ignora a disponibilidade. Só uma das duas é erro
function validarPeriodoOpcional({ checkin, checkout, hoje }) {
  if (!checkin && !checkout) return { checkin: null, checkout: null };
  if (!checkin || !checkout) throw new ErroPeriodoInvalido('Informe check-in e check-out');
  const periodo = validarPeriodo({ checkin, checkout, hoje });
  return { checkin: periodo.checkin, checkout: periodo.checkout };
}

function validarFiltrosServicos(consulta = {}) {
  const cidade = normalizarCidade(primeiroValor(consulta.cidade)) || null;
  const tipo = primeiroValor(consulta.tipo) || null;
  if (tipo && !TIPOS_SERVICO.includes(tipo)) {
    throw new ErroDadosInvalidos({ tipo: `Tipos aceitos: ${TIPOS_SERVICO.join(', ')}` });
  }
  return { cidade, tipo };
}

module.exports = { IMOVEIS_POR_PAGINA, validarFiltrosBusca, validarPeriodoOpcional, validarFiltrosServicos };
