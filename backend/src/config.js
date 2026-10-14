const path = require('node:path');

const SEGREDO_PADRAO_DESENVOLVIMENTO = 'segredo-de-desenvolvimento-nao-usar-em-producao';

function lerInteiro(nome, padrao) {
  const valor = process.env[nome];
  if (valor === undefined || valor === '') return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0) {
    throw new Error(`Variável de ambiente ${nome} deve ser um número inteiro (recebido: "${valor}")`);
  }
  return numero;
}

function lerBooleano(nome, padrao) {
  const valor = process.env[nome];
  if (valor === undefined || valor === '') return padrao;
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  throw new Error(`Variável de ambiente ${nome} deve ser "true" ou "false" (recebido: "${valor}")`);
}

function carregarConfig() {
  const emProducao = process.env.NODE_ENV === 'production';
  const segredoSessao = process.env.SEGREDO_SESSAO;
  // RN13 exige recebimento no Stripe para aparecer na busca. Até a Etapa 4b, o desenvolvimento
  // precisa ver imóveis e serviços sem essa conta
  const permitirSemRecebimento = lerBooleano('PERMITIR_SEM_RECEBIMENTO', false);

  if (emProducao && (!segredoSessao || segredoSessao.length < 32)) {
    throw new Error('Em produção, SEGREDO_SESSAO é obrigatório e precisa ter pelo menos 32 caracteres');
  }
  if (emProducao && permitirSemRecebimento) {
    throw new Error('PERMITIR_SEM_RECEBIMENTO=true é só para desenvolvimento e não pode ser usado em produção');
  }

  return {
    emProducao,
    porta: lerInteiro('PORTA', 3001),
    segredoSessao: segredoSessao || SEGREDO_PADRAO_DESENVOLVIMENTO,
    custoHashSenha: lerInteiro('CUSTO_HASH_SENHA', 12),
    comissaoHospedagemPct: lerInteiro('COMISSAO_HOSPEDAGEM_PCT', 12),
    comissaoServicoPct: lerInteiro('COMISSAO_SERVICO_PCT', 15),
    permitirSemRecebimento,
    // Fotos enviadas pelos anfitriões. Relativo à pasta backend/, como o CAMINHO_BANCO
    pastaUploads: path.resolve(__dirname, '..', process.env.PASTA_UPLOADS || './uploads'),
  };
}

module.exports = { carregarConfig };
