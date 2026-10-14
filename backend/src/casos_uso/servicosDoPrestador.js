// H3: o prestador gerencia os próprios serviços. Serviço de outro prestador responde como inexistente (404)
const { validarServico, validarStatusServico } = require('../dominio/servico');
const { ErroServicoNaoEncontrado } = require('../dominio/erros');

function exigirServico(servico) {
  if (!servico) throw new ErroServicoNaoEncontrado();
  return servico;
}

function criarCadastrarServico({ repositorioServicos }) {
  return function cadastrarServico(prestadorId, dados) {
    return repositorioServicos.inserir(prestadorId, validarServico(dados));
  };
}

// CB07: o preço novo não muda reservas antigas, que guardam o preco_contratado
function criarEditarServico({ repositorioServicos }) {
  return function editarServico(prestadorId, servicoId, dados) {
    return exigirServico(repositorioServicos.atualizar(servicoId, prestadorId, validarServico(dados)));
  };
}

// H3.2 + CB05: desativar só tira o serviço de novas buscas; reservas existentes continuam valendo
function criarAlterarStatusServico({ repositorioServicos }) {
  return function alterarStatusServico(prestadorId, servicoId, status) {
    return exigirServico(repositorioServicos.alterarStatus(servicoId, prestadorId, validarStatusServico(status)));
  };
}

function criarListarMeusServicos({ repositorioServicos }) {
  return function listarMeusServicos(prestadorId) {
    return repositorioServicos.listarDoPrestador(prestadorId);
  };
}

module.exports = { criarCadastrarServico, criarEditarServico, criarAlterarStatusServico, criarListarMeusServicos };
