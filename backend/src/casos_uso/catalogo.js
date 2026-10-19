// H4 e H5.1: catálogo público, sem login (RN16). Só imóveis e serviços visíveis pela RN13
const { IMOVEIS_POR_PAGINA, validarFiltrosBusca, validarFiltrosServicos } = require('../dominio/busca');
const { ocultarEndereco } = require('../dominio/imovel');
const { hojeEmBrasilia, validarPeriodo } = require('../dominio/periodo');
const { ErroImovelNaoEncontrado } = require('../dominio/erros');

function criarBuscarImoveis({ repositorioBusca, hoje = hojeEmBrasilia }) {
  return function buscarImoveis(consulta) {
    const { filtros, pagina } = validarFiltrosBusca(consulta, { hoje: hoje() });
    const { imoveis, total } = repositorioBusca.buscarImoveis(filtros, {
      limite: IMOVEIS_POR_PAGINA,
      deslocamento: (pagina - 1) * IMOVEIS_POR_PAGINA,
    });

    const fotosPorImovel = repositorioBusca.fotosDosImoveis(imoveis.map((imovel) => imovel.id));
    const servicosPorCidade = repositorioBusca.tiposDeServicoPorCidade([...new Set(imoveis.map((imovel) => imovel.cidade))]);

    return {
      imoveis: imoveis.map((imovel) => ({
        ...imovel,
        fotos: fotosPorImovel.get(imovel.id),
        servicos_disponiveis: servicosPorCidade.get(imovel.cidade),
      })),
      total,
      pagina,
      por_pagina: IMOVEIS_POR_PAGINA,
      total_paginas: Math.ceil(total / IMOVEIS_POR_PAGINA),
    };
  };
}

// RN12: o endereço fica oculto. Os serviços premium são os da cidade do imóvel (RN05);
// os inclusos (RN17) são os ativos do próprio anfitrião, na ordem que ele escolheu
function criarObterImovel({ repositorioBusca, repositorioServicos, repositorioServicosInclusos }) {
  return function obterImovel(imovelId) {
    const imovel = repositorioBusca.obterImovelVisivel(imovelId);
    if (!imovel) throw new ErroImovelNaoEncontrado();

    const servicos = repositorioServicos.listarVisiveis({ cidade: imovel.cidade });
    const tiposDisponiveis = [...new Set(servicos.map((servico) => servico.tipo_servico))].sort();

    return {
      imovel: {
        ...ocultarEndereco(imovel),
        fotos: repositorioBusca.fotosDosImoveis([imovel.id]).get(imovel.id),
        servicos_disponiveis: tiposDisponiveis,
      },
      inclusos: repositorioServicosInclusos.listarAtivos(imovel.id),
      servicos,
    };
  };
}

// H4.2 na página do imóvel: responde só livre/ocupado, sem expor a agenda
function criarVerificarDisponibilidade({ repositorioBusca, hoje = hojeEmBrasilia }) {
  return function verificarDisponibilidade(imovelId, { checkin, checkout }) {
    if (!repositorioBusca.obterImovelVisivel(imovelId)) throw new ErroImovelNaoEncontrado();
    const periodo = validarPeriodo({ checkin, checkout, hoje: hoje() });
    return { ...periodo, livre: repositorioBusca.imovelEstaLivre(imovelId, periodo) };
  };
}

// Carrinho (H5.2): serviços da cidade do imóvel (RN05) com os dias da estadia em que cada um já está
// contratado (RN06). Só a lista de dias ocupados sai, nunca de quem é a outra reserva
function criarListarServicosDaEstadia({ repositorioBusca, repositorioServicos, repositorioReservas, hoje = hojeEmBrasilia }) {
  return function listarServicosDaEstadia(imovelId, { checkin, checkout }) {
    const imovel = repositorioBusca.obterImovelVisivel(imovelId);
    if (!imovel) throw new ErroImovelNaoEncontrado();
    const periodo = validarPeriodo({ checkin, checkout, hoje: hoje() });

    const servicos = repositorioServicos.listarVisiveis({ cidade: imovel.cidade });
    const diasOcupados = repositorioReservas.diasOcupadosDosServicos(servicos.map((servico) => servico.id), periodo);
    return servicos.map((servico) => ({ ...servico, dias_indisponiveis: diasOcupados.get(servico.id) }));
  };
}

function criarListarCidades({ repositorioBusca }) {
  return function listarCidades() {
    return repositorioBusca.listarCidades();
  };
}

// Aba "Serviços" do Explorar
function criarBuscarServicos({ repositorioServicos }) {
  return function buscarServicos(consulta) {
    return repositorioServicos.listarVisiveis(validarFiltrosServicos(consulta));
  };
}

module.exports = {
  criarBuscarImoveis,
  criarObterImovel,
  criarVerificarDisponibilidade,
  criarListarServicosDaEstadia,
  criarListarCidades,
  criarBuscarServicos,
};
