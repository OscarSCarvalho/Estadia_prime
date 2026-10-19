// H1.3 + RN13: anfitrião e prestador cadastram o recebimento (subconta Asaas). Só com a subconta aprovada
// o imóvel ou o serviço aparece na busca e o repasse pode ser transferido (RN09).
// Também: o CPF/CNPJ do usuário (o hóspede precisa dele para pagar)
const { validarDadosRecebimento } = require('../dominio/recebimento');
const { exigirCpfCnpj, mascararCpfCnpj } = require('../dominio/documento');
const { hojeEmBrasilia } = require('../dominio/periodo');
const { paraUsuarioPublico } = require('../dominio/usuario');
const {
  ErroUsuarioNaoEncontrado,
  ErroRecebimentoJaCadastrado,
  ErroDocumentoNaoAlteravel,
  ErroGateway,
} = require('../dominio/erros');

function paraSituacao(usuario) {
  return {
    situacao: usuario.asaas_conta_id ? usuario.situacao_recebimento : 'nao_cadastrado',
    recebimento_ativo: usuario.recebimento_ativo === 1,
    cpf_cnpj: mascararCpfCnpj(usuario.cpf_cnpj),
  };
}

function exigirUsuario(repositorioUsuarios, usuarioId) {
  const usuario = repositorioUsuarios.buscarPorId(usuarioId);
  if (!usuario) throw new ErroUsuarioNaoEncontrado();
  return usuario;
}

// Cria a subconta no Asaas e guarda: contaId, walletId (conta_pagamento_id) e a apiKey CIFRADA
// (ela só vem nesta resposta). A aprovação chega depois, por webhook ou pela consulta da situação
function criarIniciarCadastroRecebimento({ repositorioUsuarios, gateway, cifra, relogio = () => new Date() }) {
  return async function iniciarCadastroRecebimento(usuarioId, dados) {
    const usuario = exigirUsuario(repositorioUsuarios, usuarioId);
    if (usuario.asaas_conta_id) throw new ErroRecebimentoJaCadastrado();
    const recebedor = validarDadosRecebimento(dados, { hoje: hojeEmBrasilia(relogio()) });

    const subconta = await gateway.criarSubconta({ ...recebedor, nome: usuario.nome, email: usuario.email });
    repositorioUsuarios.atualizarDocumento(usuarioId, recebedor.cpfCnpj);
    const gravou = repositorioUsuarios.gravarSubconta(usuarioId, {
      contaId: subconta.contaId,
      walletId: subconta.walletId,
      chaveApiCifrada: subconta.chaveApi ? cifra.cifrar(subconta.chaveApi) : null,
      situacao: subconta.situacao,
    });
    if (!gravou) throw new ErroRecebimentoJaCadastrado();
    return paraSituacao(repositorioUsuarios.buscarPorId(usuarioId));
  };
}

// Enquanto não está aprovado, pergunta ao Asaas (com a apiKey da subconta). Se o Asaas não responder,
// mostra a última situação conhecida: a tela consulta de novo depois
function criarObterSituacaoRecebimento({ repositorioUsuarios, gateway, cifra, registrarErro = console.error }) {
  return async function obterSituacaoRecebimento(usuarioId) {
    const usuario = exigirUsuario(repositorioUsuarios, usuarioId);
    if (usuario.asaas_conta_id && usuario.situacao_recebimento !== 'aprovado' && usuario.asaas_chave_api_cifrada) {
      try {
        const { situacao } = await gateway.consultarSituacaoSubconta({ chaveApi: cifra.decifrar(usuario.asaas_chave_api_cifrada) });
        repositorioUsuarios.atualizarSituacaoRecebimento(usuarioId, situacao);
      } catch (erro) {
        if (!(erro instanceof ErroGateway)) registrarErro(erro);
      }
    }
    return paraSituacao(repositorioUsuarios.buscarPorId(usuarioId));
  };
}

// Webhook ACCOUNT_STATUS_GENERAL_APPROVAL_*: `conta` = { id, situacao } já traduzido pelo adaptador
function criarAtualizarSituacaoRecebimento({ repositorioUsuarios }) {
  return function atualizarSituacaoRecebimento(conta) {
    if (!conta?.id || !conta.situacao) return false;
    const usuario = repositorioUsuarios.buscarPorContaGateway(conta.id);
    if (!usuario) return false;
    return repositorioUsuarios.atualizarSituacaoRecebimento(usuario.id, conta.situacao);
  };
}

// PUT /api/auth/eu/documento. Depois de enviado ao Asaas (cliente ou subconta criados), não muda mais
function criarAtualizarDocumento({ repositorioUsuarios }) {
  return function atualizarDocumento(usuarioId, cpfCnpj) {
    const usuario = exigirUsuario(repositorioUsuarios, usuarioId);
    const documento = exigirCpfCnpj(cpfCnpj);
    if (documento !== usuario.cpf_cnpj) {
      if (usuario.asaas_cliente_id || usuario.asaas_conta_id) throw new ErroDocumentoNaoAlteravel();
      repositorioUsuarios.atualizarDocumento(usuarioId, documento);
    }
    return paraUsuarioPublico(repositorioUsuarios.buscarPorId(usuarioId));
  };
}

module.exports = {
  criarIniciarCadastroRecebimento,
  criarObterSituacaoRecebimento,
  criarAtualizarSituacaoRecebimento,
  criarAtualizarDocumento,
};
