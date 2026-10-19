// RN17: o anfitrião gerencia os serviços inclusos dos próprios imóveis.
// Imóvel de outro dono responde como inexistente (404), como no resto do painel
const {
  LIMITE_INCLUSOS_POR_IMOVEL,
  validarServicoIncluso,
  validarStatusIncluso,
} = require('../dominio/servicoIncluso');
const { ErroDadosInvalidos, ErroServicoInclusoNaoEncontrado } = require('../dominio/erros');
const { exigirImovel } = require('./imoveisDoAnfitriao');

function exigirIncluso(incluso) {
  if (!incluso) throw new ErroServicoInclusoNaoEncontrado();
  return incluso;
}

function criarListarInclusos({ repositorioImoveis, repositorioServicosInclusos }) {
  return function listarInclusos(anfitriaoId, imovelId) {
    exigirImovel(repositorioImoveis.buscarDoAnfitriao(imovelId, anfitriaoId));
    return repositorioServicosInclusos.listar(imovelId);
  };
}

function criarCadastrarIncluso({ repositorioImoveis, repositorioServicosInclusos, limite = LIMITE_INCLUSOS_POR_IMOVEL }) {
  return function cadastrarIncluso(anfitriaoId, imovelId, dados) {
    exigirImovel(repositorioImoveis.buscarDoAnfitriao(imovelId, anfitriaoId));
    return repositorioServicosInclusos.inserir(imovelId, validarServicoIncluso(dados), limite);
  };
}

// O novo preço vale só para novas reservas: as antigas guardam nome e preço congelados (RN18)
function criarEditarIncluso({ repositorioImoveis, repositorioServicosInclusos }) {
  return function editarIncluso(anfitriaoId, imovelId, inclusoId, dados) {
    exigirImovel(repositorioImoveis.buscarDoAnfitriao(imovelId, anfitriaoId));
    const validado = validarServicoIncluso(dados);
    return exigirIncluso(repositorioServicosInclusos.atualizar(inclusoId, imovelId, validado));
  };
}

function criarAlterarStatusIncluso({ repositorioImoveis, repositorioServicosInclusos }) {
  return function alterarStatusIncluso(anfitriaoId, imovelId, inclusoId, status) {
    const novoStatus = validarStatusIncluso(status);
    exigirImovel(repositorioImoveis.buscarDoAnfitriao(imovelId, anfitriaoId));
    return exigirIncluso(repositorioServicosInclusos.alterarStatus(inclusoId, imovelId, novoStatus));
  };
}

// `idsEmOrdem`: todos os inclusos do imóvel, cada um uma vez, na nova ordem
function criarReordenarInclusos({ repositorioImoveis, repositorioServicosInclusos }) {
  return function reordenarInclusos(anfitriaoId, imovelId, idsEmOrdem) {
    exigirImovel(repositorioImoveis.buscarDoAnfitriao(imovelId, anfitriaoId));
    const idsValidos = Array.isArray(idsEmOrdem) && idsEmOrdem.every((id) => Number.isInteger(id) && id > 0);
    const inclusos = idsValidos ? repositorioServicosInclusos.reordenar(imovelId, idsEmOrdem) : null;
    if (!inclusos) {
      throw new ErroDadosInvalidos({ inclusos: 'Envie a lista com todos os serviços inclusos do imóvel, cada um uma única vez' });
    }
    return inclusos;
  };
}

// Só some de vez o incluso que nunca foi contratado; o contratado é desativado (histórico das reservas)
function criarRemoverIncluso({ repositorioImoveis, repositorioServicosInclusos }) {
  return function removerIncluso(anfitriaoId, imovelId, inclusoId) {
    exigirImovel(repositorioImoveis.buscarDoAnfitriao(imovelId, anfitriaoId));
    if (!repositorioServicosInclusos.remover(inclusoId, imovelId)) throw new ErroServicoInclusoNaoEncontrado();
    return repositorioServicosInclusos.listar(imovelId);
  };
}

module.exports = {
  criarListarInclusos,
  criarCadastrarIncluso,
  criarEditarIncluso,
  criarAlterarStatusIncluso,
  criarReordenarInclusos,
  criarRemoverIncluso,
};
