// H2: o anfitrião gerencia os próprios imóveis. Imóvel de outro dono responde como inexistente (404)
const { validarImovel, validarStatusImovel } = require('../dominio/imovel');
const { hojeEmBrasilia } = require('../dominio/periodo');
const { ErroImovelNaoEncontrado, ErroImovelComReservasFuturas } = require('../dominio/erros');

function exigirImovel(imovel) {
  if (!imovel) throw new ErroImovelNaoEncontrado();
  return imovel;
}

function criarCadastrarImovel({ repositorioImoveis }) {
  return function cadastrarImovel(anfitriaoId, dados) {
    return repositorioImoveis.inserir(anfitriaoId, validarImovel(dados));
  };
}

function criarEditarImovel({ repositorioImoveis }) {
  return function editarImovel(anfitriaoId, imovelId, dados) {
    return exigirImovel(repositorioImoveis.atualizar(imovelId, anfitriaoId, validarImovel(dados)));
  };
}

// H2.3 + CB06: desativar é bloqueado enquanto houver reserva ativa que ainda não terminou
function criarAlterarStatusImovel({ repositorioImoveis, hoje = hojeEmBrasilia }) {
  return function alterarStatusImovel(anfitriaoId, imovelId, status) {
    const novoStatus = validarStatusImovel(status);
    exigirImovel(repositorioImoveis.buscarDoAnfitriao(imovelId, anfitriaoId));
    if (novoStatus === 'inativo' && repositorioImoveis.possuiReservasFuturas(imovelId, hoje())) {
      throw new ErroImovelComReservasFuturas();
    }
    return repositorioImoveis.alterarStatus(imovelId, anfitriaoId, novoStatus);
  };
}

function criarListarMeusImoveis({ repositorioImoveis }) {
  return function listarMeusImoveis(anfitriaoId) {
    return repositorioImoveis.listarDoAnfitriao(anfitriaoId);
  };
}

// Formulário de edição: dados completos (com endereço) e as fotos com id, para remover e reordenar
function criarObterMeuImovel({ repositorioImoveis, repositorioFotos }) {
  return function obterMeuImovel(anfitriaoId, imovelId) {
    const imovel = exigirImovel(repositorioImoveis.buscarDoAnfitriao(imovelId, anfitriaoId));
    return { ...imovel, fotos: repositorioFotos.listar(imovelId) };
  };
}

module.exports = {
  exigirImovel,
  criarCadastrarImovel,
  criarEditarImovel,
  criarAlterarStatusImovel,
  criarListarMeusImoveis,
  criarObterMeuImovel,
};
