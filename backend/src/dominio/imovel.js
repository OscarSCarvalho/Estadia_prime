const { ErroDadosInvalidos } = require('./erros');
const { reaisParaCentavos } = require('./dinheiro');
const { UFS, normalizarCidade, problemaNaCidade, normalizarEstado } = require('./cidade');
const { textoEmUmaLinha, textoLongo, inteiroEntre } = require('./textos');

// Os valores seguem o CHECK de imoveis.tipo_imovel no schema.sql
const TIPOS_IMOVEL = Object.freeze(['casa', 'apartamento', 'cobertura', 'chale', 'villa', 'fazenda']);
const STATUS_IMOVEL = Object.freeze(['ativo', 'inativo']);
const LIMITE_FOTOS_IMOVEL = 10;

const LIMITES = Object.freeze({
  titulo: { minimo: 5, maximo: 120 },
  descricao: { maximo: 3000 },
  endereco: { minimo: 5, maximo: 200 },
  diariaCentavos: { minimo: 100, maximo: 100_000_000 }, // R$ 1,00 a R$ 1.000.000,00
  hospedes: { minimo: 1, maximo: 50 },
  quartos: { minimo: 0, maximo: 50 },
});

// H2.1. A diária chega em reais (`diaria`) e sai em centavos (`preco_diaria`), como no banco
function validarImovel(dados = {}) {
  const titulo = textoEmUmaLinha(dados.titulo);
  const descricao = textoLongo(dados.descricao);
  const tipo_imovel = textoEmUmaLinha(dados.tipo_imovel);
  const endereco = textoEmUmaLinha(dados.endereco);
  const cidade = normalizarCidade(dados.cidade);
  const estado = normalizarEstado(dados.estado);
  const preco_diaria = reaisParaCentavos(dados.diaria);
  const num_hospedes = inteiroEntre(dados.num_hospedes, LIMITES.hospedes.minimo, LIMITES.hospedes.maximo);
  const num_quartos = inteiroEntre(dados.num_quartos, LIMITES.quartos.minimo, LIMITES.quartos.maximo);
  const camposInvalidos = {};

  if (titulo.length < LIMITES.titulo.minimo || titulo.length > LIMITES.titulo.maximo) {
    camposInvalidos.titulo = `Informe um título entre ${LIMITES.titulo.minimo} e ${LIMITES.titulo.maximo} caracteres`;
  }
  if (descricao.length > LIMITES.descricao.maximo) {
    camposInvalidos.descricao = `A descrição pode ter no máximo ${LIMITES.descricao.maximo} caracteres`;
  }
  if (!TIPOS_IMOVEL.includes(tipo_imovel)) {
    camposInvalidos.tipo_imovel = `Escolha um tipo: ${TIPOS_IMOVEL.join(', ')}`;
  }
  if (endereco.length < LIMITES.endereco.minimo || endereco.length > LIMITES.endereco.maximo) {
    camposInvalidos.endereco = `Informe o endereço entre ${LIMITES.endereco.minimo} e ${LIMITES.endereco.maximo} caracteres`;
  }
  const problemaCidade = problemaNaCidade(cidade);
  if (problemaCidade) camposInvalidos.cidade = problemaCidade;
  if (!UFS.includes(estado)) camposInvalidos.estado = 'Informe a sigla do estado (ex.: RJ)';
  if (
    preco_diaria === null ||
    preco_diaria < LIMITES.diariaCentavos.minimo ||
    preco_diaria > LIMITES.diariaCentavos.maximo
  ) {
    camposInvalidos.diaria = 'Informe a diária em reais, entre R$ 1,00 e R$ 1.000.000,00';
  }
  if (num_hospedes === null) {
    camposInvalidos.num_hospedes = `Informe de ${LIMITES.hospedes.minimo} a ${LIMITES.hospedes.maximo} hóspedes`;
  }
  if (num_quartos === null) {
    camposInvalidos.num_quartos = `Informe de ${LIMITES.quartos.minimo} a ${LIMITES.quartos.maximo} quartos`;
  }

  if (Object.keys(camposInvalidos).length > 0) {
    throw new ErroDadosInvalidos(camposInvalidos);
  }

  return {
    titulo,
    descricao: descricao || null,
    tipo_imovel,
    endereco,
    cidade,
    estado,
    preco_diaria,
    num_hospedes,
    num_quartos,
  };
}

function validarStatusImovel(status) {
  if (!STATUS_IMOVEL.includes(status)) {
    throw new ErroDadosInvalidos({ status: `Use um destes valores: ${STATUS_IMOVEL.join(', ')}` });
  }
  return status;
}

// RN12: antes da reserva confirmada, o hóspede vê só cidade e estado
function ocultarEndereco(imovel) {
  const imovelPublico = { ...imovel };
  delete imovelPublico.endereco;
  return imovelPublico;
}

module.exports = {
  TIPOS_IMOVEL,
  STATUS_IMOVEL,
  LIMITE_FOTOS_IMOVEL,
  validarImovel,
  validarStatusImovel,
  ocultarEndereco,
};
