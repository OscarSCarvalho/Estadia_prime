const crypto = require('node:crypto');
const { ErroGateway } = require('../dominio/erros');

// Adaptador do Asaas (API v3), conferido na documentação oficial (docs.asaas.com) em 2026-10-19.
// Modelo "cobrança única + transferências" (CONTEXT §4.4). Usa o fetch nativo: zero dependência nova.
// Centavos ↔ reais só aqui dentro: o resto do sistema só conhece centavos.
// A mesma interface é implementada pelo gatewayFalso.js (desenvolvimento e testes).

const TIMEOUT_PADRAO_MS = 15_000;
const USER_AGENT = 'EstadiaPrime/1.0 (Node.js)'; // obrigatório para contas criadas depois de 13/06/2024

const paraReais = (centavos) => Number((centavos / 100).toFixed(2));
const paraCentavos = (reais) => (typeof reais === 'number' ? Math.round(reais * 100) : null);

const BILLING_TYPE = Object.freeze({ pix: 'PIX', cartao: 'CREDIT_CARD' });
const COMPANY_TYPE = Object.freeze({ mei: 'MEI', limitada: 'LIMITED', individual: 'INDIVIDUAL', associacao: 'ASSOCIATION' });

// accountStatus.general do Asaas → situação do recebimento no nosso banco
const SITUACAO_DA_CONTA = Object.freeze({
  APPROVED: 'aprovado',
  AWAITING_APPROVAL: 'em_analise',
  PENDING: 'pendente',
  REJECTED: 'recusado',
});

// Eventos de situação da conta que a subconta envia para o nosso webhook
const EVENTOS_SITUACAO_CONTA = Object.freeze([
  'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED',
]);
const PREFIXO_SITUACAO_CONTA = 'ACCOUNT_STATUS_GENERAL_APPROVAL_';

// Comparação em tempo constante: não revela, pelo tempo de resposta, quantos caracteres do token acertaram
function tokenConfere(recebido, esperado) {
  if (typeof recebido !== 'string' || !esperado) return false;
  const a = crypto.createHash('sha256').update(recebido).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

// Corpo do webhook do Asaas → evento no formato do nosso sistema (valores em centavos).
// Compartilhado com o gatewayFalso, que imita o formato do Asaas
function interpretarEventoAsaas(corpo) {
  if (!corpo || typeof corpo.id !== 'string' || typeof corpo.event !== 'string') return null;
  const evento = { idEvento: corpo.id, tipo: corpo.event, pagamento: null, conta: null };
  if (corpo.payment) {
    evento.pagamento = {
      idExterno: corpo.payment.id,
      valor: paraCentavos(corpo.payment.value),
      valorLiquido: paraCentavos(corpo.payment.netValue),
      referencia: corpo.payment.externalReference === undefined || corpo.payment.externalReference === null ? null : String(corpo.payment.externalReference),
      dataPagamento: corpo.payment.confirmedDate ?? corpo.payment.paymentDate ?? null,
    };
  }
  if (corpo.event.startsWith(PREFIXO_SITUACAO_CONTA)) {
    evento.conta = {
      id: corpo.account?.id ?? corpo.accountStatus?.id ?? null,
      situacao: SITUACAO_DA_CONTA[corpo.accountStatus?.general] ?? SITUACAO_DA_CONTA[corpo.event.slice(PREFIXO_SITUACAO_CONTA.length)] ?? null,
    };
  }
  return evento;
}

function lerJson(texto) {
  try {
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

// Erro do Asaas: { errors: [{ code, description }] }. A descrição vem em português e é mostrável
function mensagemDoErro(corpo, status) {
  const descricao = corpo?.errors?.map((erro) => erro.description).filter(Boolean).join(' ');
  if (descricao) return `O Asaas recusou o pedido: ${descricao}`;
  if (status === 401) return 'O serviço de pagamento recusou a credencial da plataforma. Avise o suporte';
  return 'O serviço de pagamento está com instabilidade. Tente novamente em instantes';
}

function criarGatewayAsaas({ urlApi, chaveApi, tokenWebhook, urlWebhook, fetch = globalThis.fetch, timeoutMs = TIMEOUT_PADRAO_MS }) {
  if (!urlApi || !chaveApi) throw new Error('Gateway Asaas precisa de ASAAS_API_URL e ASAAS_API_KEY');
  const base = urlApi.replace(/\/+$/, '');

  async function chamar(metodo, caminho, { corpo, chave = chaveApi } = {}) {
    let resposta;
    try {
      resposta = await fetch(`${base}${caminho}`, {
        method: metodo,
        headers: {
          access_token: chave,
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (erro) {
      if (erro.name === 'TimeoutError') throw new ErroGateway('O serviço de pagamento demorou para responder. Tente novamente');
      throw new ErroGateway();
    }
    const dados = lerJson(await resposta.text());
    if (!resposta.ok) throw new ErroGateway(mensagemDoErro(dados, resposta.status));
    return dados;
  }

  // POST /v3/accounts. A apiKey da subconta só vem nesta resposta. O webhook de situação da conta é
  // configurado na criação (campo `webhooks`) para avisar quando o cadastro for aprovado (RN13)
  async function criarSubconta(dados) {
    const resposta = await chamar('POST', '/accounts', {
      corpo: {
        name: dados.nome,
        email: dados.email,
        cpfCnpj: dados.cpfCnpj,
        birthDate: dados.dataNascimento ?? undefined,
        companyType: dados.tipoEmpresa ? COMPANY_TYPE[dados.tipoEmpresa] : undefined,
        mobilePhone: dados.telefoneCelular,
        incomeValue: paraReais(dados.rendaMensal),
        address: dados.endereco,
        addressNumber: dados.numero,
        complement: dados.complemento ?? undefined,
        province: dados.bairro,
        postalCode: dados.cep,
        webhooks: urlWebhook
          ? [{
            name: 'Estadia Prime - situação da conta',
            url: urlWebhook,
            email: dados.emailAvisos ?? dados.email,
            sendType: 'SEQUENTIALLY',
            interrupted: false,
            enabled: true,
            apiVersion: 3,
            authToken: tokenWebhook,
            events: EVENTOS_SITUACAO_CONTA,
          }]
          : undefined,
      },
    });
    return {
      contaId: resposta.id,
      walletId: resposta.walletId,
      // A documentação mostra a chave em `apiKey`; algumas versões a devolvem em `accessToken.apiKey`
      chaveApi: resposta.apiKey ?? resposta.accessToken?.apiKey ?? null,
      situacao: 'em_analise',
    };
  }

  // GET /v3/myAccount/status com a apiKey DA SUBCONTA
  async function consultarSituacaoSubconta({ chaveApi: chaveSubconta }) {
    const resposta = await chamar('GET', '/myAccount/status', { chave: chaveSubconta });
    return { situacao: SITUACAO_DA_CONTA[resposta?.general] ?? 'em_analise' };
  }

  // POST /v3/customers. O Asaas aceita clientes duplicados: quem chama guarda o id e reaproveita
  async function garantirCliente(hospede) {
    if (hospede.asaasClienteId) return hospede.asaasClienteId;
    const resposta = await chamar('POST', '/customers', {
      corpo: {
        name: hospede.nome,
        cpfCnpj: hospede.cpfCnpj,
        email: hospede.email,
        mobilePhone: hospede.telefone ?? undefined,
        externalReference: String(hospede.id),
        notificationDisabled: true,
      },
    });
    return resposta.id;
  }

  // POST /v3/payments (+ GET /v3/payments/{id}/pixQrCode no Pix). Cartão: o hóspede paga na fatura
  // hospedada pelo Asaas (invoiceUrl); o site nunca toca em dado de cartão (sem escopo PCI)
  async function criarCobranca({ clienteId, valor, metodo, descricao, referencia, vencimento, urlRetorno }) {
    const cobranca = await chamar('POST', '/payments', {
      corpo: {
        customer: clienteId,
        billingType: BILLING_TYPE[metodo],
        value: paraReais(valor),
        dueDate: vencimento,
        description: descricao.slice(0, 500),
        externalReference: String(referencia),
        // O Asaas só aceita o retorno em domínio público com https (o cadastrado na conta)
        callback: metodo === 'cartao' && urlRetorno?.startsWith('https://') ? { successUrl: urlRetorno, autoRedirect: true } : undefined,
      },
    });
    const resultado = { idExterno: cobranca.id, urlFatura: cobranca.invoiceUrl ?? null, pixCopiaCola: null, pixQrBase64: null };
    if (metodo === 'pix') {
      const qr = await chamar('GET', `/payments/${encodeURIComponent(cobranca.id)}/pixQrCode`);
      resultado.pixCopiaCola = qr.payload;
      resultado.pixQrBase64 = qr.encodedImage;
    }
    return resultado;
  }

  // DELETE /v3/payments/{id}: a cobrança deixa de poder ser paga (não é reembolso)
  async function cancelarCobranca(idExterno) {
    await chamar('DELETE', `/payments/${encodeURIComponent(idExterno)}`);
  }

  // POST /v3/payments/{id}/refund: total ou parcial
  async function reembolsar(idExterno, valorCentavos, descricao) {
    const resposta = await chamar('POST', `/payments/${encodeURIComponent(idExterno)}/refund`, {
      corpo: { value: paraReais(valorCentavos), description: descricao },
    });
    return { status: resposta?.status ?? null };
  }

  // POST /v3/transfers com walletId: transferência entre contas Asaas. A documentação não lista
  // `description` neste caso; a identificação vai em externalReference
  async function transferirParaCarteira(walletId, valorCentavos, referencia) {
    const resposta = await chamar('POST', '/transfers', {
      corpo: { value: paraReais(valorCentavos), walletId, externalReference: referencia },
    });
    if (resposta?.status === 'FAILED' || resposta?.status === 'CANCELLED') {
      throw new ErroGateway(`A transferência foi recusada pelo Asaas (${resposta.status})`);
    }
    return { idExterno: resposta.id, status: resposta.status };
  }

  return {
    nome: 'asaas',
    simulado: false,
    webhookAutorizado: (token) => tokenConfere(token, tokenWebhook),
    interpretarEvento: interpretarEventoAsaas,
    criarSubconta,
    consultarSituacaoSubconta,
    garantirCliente,
    criarCobranca,
    cancelarCobranca,
    reembolsar,
    transferirParaCarteira,
  };
}

module.exports = { criarGatewayAsaas, interpretarEventoAsaas, tokenConfere, EVENTOS_SITUACAO_CONTA };
