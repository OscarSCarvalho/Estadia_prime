const { ErroEmailJaCadastrado } = require('../dominio/erros');

function criarRepositorioUsuarios(db) {
  const consultaPorEmail = db.prepare('SELECT * FROM usuarios WHERE email = ?');
  const consultaPorId = db.prepare('SELECT * FROM usuarios WHERE id = ?');
  const insercao = db.prepare(`
    INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo)
    VALUES (@nome, @email, @senha_hash, @telefone, @tipo)
  `);

  const atualizacaoDocumento = db.prepare('UPDATE usuarios SET cpf_cnpj = @cpfCnpj WHERE id = @id');
  const gravacaoCliente = db.prepare('UPDATE usuarios SET asaas_cliente_id = @clienteId WHERE id = @id AND asaas_cliente_id IS NULL');
  // Só grava se ainda não houver subconta: dois envios do formulário ao mesmo tempo não criam duas
  const gravacaoSubconta = db.prepare(`
    UPDATE usuarios
       SET asaas_conta_id = @contaId, conta_pagamento_id = @walletId, asaas_chave_api_cifrada = @chaveApiCifrada,
           situacao_recebimento = @situacao, recebimento_ativo = CASE WHEN @situacao = 'aprovado' THEN 1 ELSE 0 END
     WHERE id = @id AND asaas_conta_id IS NULL
  `);
  // RN13: recebimento_ativo acompanha a aprovação da subconta
  const atualizacaoSituacao = db.prepare(`
    UPDATE usuarios SET situacao_recebimento = @situacao, recebimento_ativo = CASE WHEN @situacao = 'aprovado' THEN 1 ELSE 0 END
     WHERE id = @id AND asaas_conta_id IS NOT NULL
  `);
  const consultaPorConta = db.prepare('SELECT * FROM usuarios WHERE asaas_conta_id = ?');

  function buscarPorEmail(email) {
    return consultaPorEmail.get(email) ?? null;
  }

  function buscarPorId(id) {
    return consultaPorId.get(id) ?? null;
  }

  function inserir({ nome, email, senha_hash, telefone, tipo }) {
    try {
      const { lastInsertRowid } = insercao.run({ nome, email, senha_hash, telefone, tipo });
      return buscarPorId(lastInsertRowid);
    } catch (erro) {
      if (erro.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new ErroEmailJaCadastrado();
      throw erro;
    }
  }

  function atualizarDocumento(id, cpfCnpj) {
    atualizacaoDocumento.run({ id, cpfCnpj });
  }

  function gravarClienteGateway(id, clienteId) {
    gravacaoCliente.run({ id, clienteId });
  }

  function gravarSubconta(id, { contaId, walletId, chaveApiCifrada, situacao }) {
    return gravacaoSubconta.run({ id, contaId, walletId, chaveApiCifrada, situacao }).changes === 1;
  }

  function atualizarSituacaoRecebimento(id, situacao) {
    return atualizacaoSituacao.run({ id, situacao }).changes === 1;
  }

  function buscarPorContaGateway(contaId) {
    return consultaPorConta.get(contaId) ?? null;
  }

  return {
    buscarPorEmail,
    buscarPorId,
    inserir,
    atualizarDocumento,
    gravarClienteGateway,
    gravarSubconta,
    atualizarSituacaoRecebimento,
    buscarPorContaGateway,
  };
}

module.exports = { criarRepositorioUsuarios };
