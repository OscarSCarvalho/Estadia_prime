const { ErroDadosInvalidos } = require('./erros');
const { reaisParaCentavos } = require('./dinheiro');
const { normalizarCidade, problemaNaCidade } = require('./cidade');
const { textoEmUmaLinha, textoLongo } = require('./textos');

// Os valores seguem os CHECKs da tabela servicos no schema.sql
const TIPOS_SERVICO = Object.freeze(['mordomo', 'copeiro', 'empregado', 'motorista', 'barman', 'eventos']);
const UNIDADES_PRECO = Object.freeze(['hora', 'diaria', 'evento']);
const STATUS_SERVICO = Object.freeze(['ativo', 'inativo']);

const DESCRICAO_TAMANHO_MAXIMO = 1000;
const PRECO_CENTAVOS = Object.freeze({ minimo: 100, maximo: 10_000_000 }); // R$ 1,00 a R$ 100.000,00

// H3.1. O preço chega em reais (`preco`) e sai em centavos, como no banco
function validarServico(dados = {}) {
  const tipo_servico = textoEmUmaLinha(dados.tipo_servico);
  const descricao = textoLongo(dados.descricao);
  const preco = reaisParaCentavos(dados.preco);
  const unidade_preco = textoEmUmaLinha(dados.unidade_preco);
  const cidade_atuacao = normalizarCidade(dados.cidade_atuacao);
  const camposInvalidos = {};

  if (!TIPOS_SERVICO.includes(tipo_servico)) {
    camposInvalidos.tipo_servico = `Tipos aceitos: ${TIPOS_SERVICO.join(', ')}`;
  }
  if (descricao.length > DESCRICAO_TAMANHO_MAXIMO) {
    camposInvalidos.descricao = `A descrição pode ter no máximo ${DESCRICAO_TAMANHO_MAXIMO} caracteres`;
  }
  if (preco === null || preco < PRECO_CENTAVOS.minimo || preco > PRECO_CENTAVOS.maximo) {
    camposInvalidos.preco = 'Informe o preço em reais, entre R$ 1,00 e R$ 100.000,00';
  }
  if (!UNIDADES_PRECO.includes(unidade_preco)) {
    camposInvalidos.unidade_preco = `Unidades aceitas: ${UNIDADES_PRECO.join(', ')}`;
  }
  const problemaCidade = problemaNaCidade(cidade_atuacao);
  if (problemaCidade) camposInvalidos.cidade_atuacao = problemaCidade;

  if (Object.keys(camposInvalidos).length > 0) {
    throw new ErroDadosInvalidos(camposInvalidos);
  }

  return { tipo_servico, descricao: descricao || null, preco, unidade_preco, cidade_atuacao };
}

function validarStatusServico(status) {
  if (!STATUS_SERVICO.includes(status)) {
    throw new ErroDadosInvalidos({ status: `Use um destes valores: ${STATUS_SERVICO.join(', ')}` });
  }
  return status;
}

module.exports = { TIPOS_SERVICO, UNIDADES_PRECO, STATUS_SERVICO, validarServico, validarStatusServico };
