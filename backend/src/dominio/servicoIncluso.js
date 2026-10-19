const { ErroDadosInvalidos } = require('./erros');
const { reaisParaCentavos } = require('./dinheiro');
const { textoEmUmaLinha, textoLongo } = require('./textos');

// RN17: serviços que o próprio anfitrião oferece no imóvel (caseiro, limpeza diária, café da manhã...).
// Os valores seguem os CHECKs de imovel_servicos_inclusos (migração 002)
const UNIDADES_INCLUSO = Object.freeze(['estadia', 'noite', 'hospede']);
const STATUS_INCLUSO = Object.freeze(['ativo', 'inativo']);
const LIMITE_INCLUSOS_POR_IMOVEL = 15;

const LIMITES = Object.freeze({
  nome: { minimo: 3, maximo: 60 },
  descricao: { maximo: 300 },
  precoCentavos: { minimo: 1, maximo: 10_000_000 }, // R$ 0,01 a R$ 100.000,00
});

// O preço chega em reais (`preco`) e sai em centavos, como no banco
function validarServicoIncluso(dados = {}) {
  const nome = textoEmUmaLinha(dados.nome);
  const descricao = textoLongo(dados.descricao);
  const preco = reaisParaCentavos(dados.preco);
  const unidade_preco = textoEmUmaLinha(dados.unidade_preco);
  const camposInvalidos = {};

  if (nome.length < LIMITES.nome.minimo || nome.length > LIMITES.nome.maximo) {
    camposInvalidos.nome = `Informe um nome entre ${LIMITES.nome.minimo} e ${LIMITES.nome.maximo} caracteres`;
  }
  if (descricao.length > LIMITES.descricao.maximo) {
    camposInvalidos.descricao = `A descrição pode ter no máximo ${LIMITES.descricao.maximo} caracteres`;
  }
  if (preco === null || preco < LIMITES.precoCentavos.minimo || preco > LIMITES.precoCentavos.maximo) {
    camposInvalidos.preco = 'Informe o preço em reais, maior que zero e até R$ 100.000,00';
  }
  if (!UNIDADES_INCLUSO.includes(unidade_preco)) {
    camposInvalidos.unidade_preco = `Unidades aceitas: ${UNIDADES_INCLUSO.join(', ')}`;
  }

  if (Object.keys(camposInvalidos).length > 0) throw new ErroDadosInvalidos(camposInvalidos);

  return { nome, descricao: descricao || null, preco, unidade_preco };
}

function validarStatusIncluso(status) {
  if (!STATUS_INCLUSO.includes(status)) {
    throw new ErroDadosInvalidos({ status: `Use um destes valores: ${STATUS_INCLUSO.join(', ')}` });
  }
  return status;
}

// estadia = valor fixo; noite = preço × noites; hospede = preço × nº de hóspedes da reserva
function quantidadeDoIncluso(unidadePreco, { noites, numHospedes }) {
  if (unidadePreco === 'estadia') return 1;
  if (unidadePreco === 'noite') return noites;
  if (unidadePreco === 'hospede') return numHospedes;
  throw new ErroDadosInvalidos({ unidade_preco: `Unidades aceitas: ${UNIDADES_INCLUSO.join(', ')}` });
}

module.exports = {
  UNIDADES_INCLUSO,
  STATUS_INCLUSO,
  LIMITE_INCLUSOS_POR_IMOVEL,
  validarServicoIncluso,
  validarStatusIncluso,
  quantidadeDoIncluso,
};
