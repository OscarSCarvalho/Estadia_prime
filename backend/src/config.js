const path = require('node:path');

const SEGREDO_PADRAO_DESENVOLVIMENTO = 'segredo-de-desenvolvimento-nao-usar-em-producao';
// Só desenvolvimento com o gateway falso: as "apiKeys" das subcontas falsas não valem nada
const CHAVE_CRIPTOGRAFIA_DESENVOLVIMENTO = '0'.repeat(64);
const GATEWAYS_PAGAMENTO = ['falso', 'asaas'];
const URL_ASAAS_SANDBOX = 'https://api-sandbox.asaas.com/v3';
const URL_ASAAS_PRODUCAO = 'https://api.asaas.com/v3';

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

function lerEscolha(nome, opcoes, padrao) {
  const valor = process.env[nome] || padrao;
  if (!opcoes.includes(valor)) {
    throw new Error(`Variável de ambiente ${nome} deve ser ${opcoes.join(' ou ')} (recebido: "${valor}")`);
  }
  return valor;
}

// Etapa 4b (CONTEXT §4.4 e §7). Padrão: gateway falso, em memória, para desenvolvimento e testes.
// Proteções: produção nunca roda com o falso nem sem as chaves; fora de produção, a URL de produção
// do Asaas é recusada (a chave de produção não pode ser usada em desenvolvimento)
function carregarConfigPagamento(emProducao) {
  const gatewayPagamento = lerEscolha('GATEWAY_PAGAMENTO', GATEWAYS_PAGAMENTO, 'falso');
  const asaasApiUrl = (process.env.ASAAS_API_URL || URL_ASAAS_SANDBOX).replace(/\/+$/, '');
  const asaasApiKey = process.env.ASAAS_API_KEY || '';
  const asaasWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN || '';
  const chaveCriptografia = process.env.CHAVE_CRIPTOGRAFIA || '';
  const urlPublicaSite = (process.env.URL_PUBLICA_SITE || 'http://localhost:5173').replace(/\/+$/, '');

  if (emProducao && gatewayPagamento === 'falso') {
    throw new Error('Em produção, GATEWAY_PAGAMENTO precisa ser "asaas" (o gateway falso é só para desenvolvimento)');
  }
  if (gatewayPagamento === 'asaas') {
    const faltando = [
      ['ASAAS_API_KEY', asaasApiKey],
      ['ASAAS_WEBHOOK_TOKEN', asaasWebhookToken],
      ['CHAVE_CRIPTOGRAFIA', chaveCriptografia],
    ].filter(([, valor]) => !valor).map(([nome]) => nome);
    if (faltando.length > 0) throw new Error(`Com GATEWAY_PAGAMENTO=asaas, configure: ${faltando.join(', ')}`);
    if (asaasWebhookToken.length < 32) throw new Error('ASAAS_WEBHOOK_TOKEN precisa ter pelo menos 32 caracteres');
  }
  if (!emProducao && asaasApiUrl === URL_ASAAS_PRODUCAO) {
    throw new Error('Fora de produção use o sandbox do Asaas (ASAAS_API_URL=https://api-sandbox.asaas.com/v3)');
  }
  if (emProducao && !urlPublicaSite.startsWith('https://')) {
    throw new Error('Em produção, URL_PUBLICA_SITE precisa começar com https://');
  }

  return {
    gatewayPagamento,
    asaasApiUrl,
    asaasApiKey,
    asaasWebhookToken,
    chaveCriptografia: chaveCriptografia || CHAVE_CRIPTOGRAFIA_DESENVOLVIMENTO,
    urlPublicaSite,
  };
}

function carregarConfig() {
  const emProducao = process.env.NODE_ENV === 'production';
  const segredoSessao = process.env.SEGREDO_SESSAO;
  // RN13 exige subconta Asaas aprovada para aparecer na busca. Em desenvolvimento dá para ver
  // imóveis e serviços de quem ainda não cadastrou o recebimento
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
    ...carregarConfigPagamento(emProducao),
  };
}

module.exports = { carregarConfig };
