// H2.2: até 10 fotos por imóvel, na ordem escolhida pelo anfitrião
const { LIMITE_FOTOS_IMOVEL } = require('../dominio/imovel');
const { validarFotos } = require('../dominio/foto');
const { ErroDadosInvalidos, ErroFotoNaoEncontrada, ErroLimiteFotos } = require('../dominio/erros');
const { exigirImovel } = require('./imoveisDoAnfitriao');

// `arquivos`: [{ bytes }] na ordem enviada. Nada é salvo se uma foto for inválida ou passar do limite
function criarAdicionarFotos({ repositorioImoveis, repositorioFotos, armazenamentoFotos, limite = LIMITE_FOTOS_IMOVEL }) {
  return async function adicionarFotos(anfitriaoId, imovelId, arquivos) {
    exigirImovel(repositorioImoveis.buscarDoAnfitriao(imovelId, anfitriaoId));
    const extensoes = validarFotos(arquivos);
    if (repositorioFotos.contar(imovelId) + arquivos.length > limite) throw new ErroLimiteFotos(limite);

    const urlsSalvas = [];
    try {
      for (const [posicao, { bytes }] of arquivos.entries()) {
        urlsSalvas.push(await armazenamentoFotos.salvar(bytes, extensoes[posicao]));
      }
      // O repositório confere o limite de novo na transação (dois envios ao mesmo tempo)
      return repositorioFotos.adicionar(imovelId, urlsSalvas, limite);
    } catch (erro) {
      await Promise.allSettled(urlsSalvas.map((url) => armazenamentoFotos.apagar(url)));
      throw erro;
    }
  };
}

function criarRemoverFoto({ repositorioImoveis, repositorioFotos, armazenamentoFotos }) {
  return async function removerFoto(anfitriaoId, imovelId, fotoId) {
    exigirImovel(repositorioImoveis.buscarDoAnfitriao(imovelId, anfitriaoId));
    const foto = repositorioFotos.remover(fotoId, imovelId);
    if (!foto) throw new ErroFotoNaoEncontrada();
    await armazenamentoFotos.apagar(foto.url_foto);
    return repositorioFotos.listar(imovelId);
  };
}

// `idsEmOrdem`: todas as fotos do imóvel, cada uma uma vez, na nova ordem (a primeira é a capa)
function criarReordenarFotos({ repositorioImoveis, repositorioFotos }) {
  return function reordenarFotos(anfitriaoId, imovelId, idsEmOrdem) {
    exigirImovel(repositorioImoveis.buscarDoAnfitriao(imovelId, anfitriaoId));
    const idsValidos = Array.isArray(idsEmOrdem) && idsEmOrdem.every((id) => Number.isInteger(id) && id > 0);
    const fotos = idsValidos ? repositorioFotos.reordenar(imovelId, idsEmOrdem) : null;
    if (!fotos) {
      throw new ErroDadosInvalidos({ fotos: 'Envie a lista com todas as fotos do imóvel, cada uma uma única vez' });
    }
    return fotos;
  };
}

module.exports = { criarAdicionarFotos, criarRemoverFoto, criarReordenarFotos };
