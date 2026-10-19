const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { ErroGateway } = require('../dominio/erros');
const { interpretarEventoAsaas, tokenConfere } = require('./gatewayAsaas');

// Gateway em memória com a MESMA interface do gatewayAsaas.js. Usado em desenvolvimento
// (GATEWAY_PAGAMENTO=falso, o padrão) e em todos os testes: nenhum teste chama a API real.
// Os eventos que ele gera imitam o corpo dos webhooks do Asaas (valores em reais), para que o
// caminho webhook → interpretarEvento → caso de uso seja o mesmo da produção.

const paraReais = (centavos) => Number((centavos / 100).toFixed(2));

// "QR" de mentira para a tela de Pix em desenvolvimento: um PNG com quadradinhos tirados do hash do
// código. Não é um QR Code de verdade (nenhum app de banco lê), só ocupa o lugar dele
function imagemPixDeTeste(texto) {
  const modulos = 25;
  const escala = 8;
  const lado = modulos * escala;
  const hash = crypto.createHash('sha512').update(texto).digest();
  const escuro = (x, y) => {
    const canto = (cx, cy) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7;
    for (const [cx, cy] of [[0, 0], [modulos - 7, 0], [0, modulos - 7]]) {
      if (canto(cx, cy)) {
        const dx = x - cx;
        const dy = y - cy;
        return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
      }
    }
    const bit = (y * modulos + x) % (hash.length * 8);
    return ((hash[bit >> 3] >> (bit & 7)) & 1) === 1;
  };
  const linhas = Buffer.alloc((lado + 1) * lado);
  for (let y = 0; y < lado; y += 1) {
    linhas[y * (lado + 1)] = 0;
    for (let x = 0; x < lado; x += 1) {
      linhas[y * (lado + 1) + 1 + x] = escuro(Math.floor(x / escala), Math.floor(y / escala)) ? 0x1c : 0xff;
    }
  }
  const pedaco = (tipo, dados) => {
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(dados.length);
    const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(corpo));
    return Buffer.concat([tamanho, corpo, crc]);
  };
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(lado, 0);
  cabecalho.writeUInt32BE(lado, 4);
  cabecalho[8] = 8; // 8 bits por pixel
  cabecalho[9] = 0; // tons de cinza
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', cabecalho),
    pedaco('IDAT', zlib.deflateSync(linhas)),
    pedaco('IEND', Buffer.alloc(0)),
  ]).toString('base64');
}

function criarGatewayFalso({ tokenWebhook = 'token-webhook-de-desenvolvimento', taxaPixCentavos = 199 } = {}) {
  let sequencia = 0;
  const proximoId = (prefixo) => {
    sequencia += 1;
    return `${prefixo}_falso_${String(sequencia).padStart(6, '0')}`;
  };

  const clientes = new Map();
  const subcontas = new Map();
  const cobrancas = new Map();
  const transferencias = [];
  const reembolsos = [];
  const cancelamentos = [];
  const falhasProgramadas = new Map();

  // Nos testes: faz as próximas `vezes` chamadas de `metodo` falharem como se o Asaas estivesse fora
  function falharProximas(metodo, vezes = 1, mensagem) {
    falhasProgramadas.set(metodo, { vezes, mensagem });
  }

  function talvezFalhar(metodo) {
    const falha = falhasProgramadas.get(metodo);
    if (!falha) return;
    falha.vezes -= 1;
    if (falha.vezes <= 0) falhasProgramadas.delete(metodo);
    throw new ErroGateway(falha.mensagem);
  }

  async function criarSubconta(dados) {
    talvezFalhar('criarSubconta');
    const contaId = proximoId('acc');
    const subconta = { ...dados, contaId, walletId: crypto.randomUUID(), chaveApi: `$aact_falso_${crypto.randomUUID()}`, situacao: 'em_analise' };
    subcontas.set(contaId, subconta);
    return { contaId, walletId: subconta.walletId, chaveApi: subconta.chaveApi, situacao: 'em_analise' };
  }

  // Como o sandbox do Asaas, aprova automaticamente quando os dados estão completos.
  // Os testes desligam (`gateway.aprovacaoAutomatica = false`) para exercitar o webhook de aprovação
  async function consultarSituacaoSubconta({ chaveApi }) {
    talvezFalhar('consultarSituacaoSubconta');
    const subconta = [...subcontas.values()].find((conta) => conta.chaveApi === chaveApi);
    if (!subconta) throw new ErroGateway('Subconta não encontrada');
    if (gateway.aprovacaoAutomatica) subconta.situacao = 'aprovado';
    return { situacao: subconta.situacao };
  }

  async function garantirCliente(hospede) {
    talvezFalhar('garantirCliente');
    if (hospede.asaasClienteId) return hospede.asaasClienteId;
    const id = proximoId('cus');
    clientes.set(id, { ...hospede });
    return id;
  }

  async function criarCobranca({ clienteId, valor, metodo, descricao, referencia }) {
    talvezFalhar('criarCobranca');
    if (!clientes.has(clienteId)) throw new ErroGateway('Cliente não encontrado no gateway falso');
    const idExterno = proximoId('pay');
    const pixCopiaCola = metodo === 'pix' ? `00020126580014br.gov.bcb.pix-ESTADIAPRIME-TESTE-${idExterno}-${valor}` : null;
    cobrancas.set(idExterno, { idExterno, clienteId, valor, metodo, descricao, referencia: String(referencia), status: 'PENDING', reembolsado: 0 });
    return {
      idExterno,
      // Sem fatura de verdade: a tela de desenvolvimento mostra o botão "Simular pagamento"
      urlFatura: null,
      pixCopiaCola,
      pixQrBase64: metodo === 'pix' ? imagemPixDeTeste(pixCopiaCola) : null,
    };
  }

  function exigirCobranca(idExterno) {
    const cobranca = cobrancas.get(idExterno);
    if (!cobranca) throw new ErroGateway('Cobrança não encontrada no gateway falso');
    return cobranca;
  }

  async function cancelarCobranca(idExterno) {
    talvezFalhar('cancelarCobranca');
    const cobranca = exigirCobranca(idExterno);
    if (cobranca.status !== 'PENDING') throw new ErroGateway('Só cobranças pendentes podem ser removidas');
    cobranca.status = 'DELETED';
    cancelamentos.push(idExterno);
  }

  async function reembolsar(idExterno, valorCentavos, descricao) {
    talvezFalhar('reembolsar');
    const cobranca = exigirCobranca(idExterno);
    if (cobranca.status !== 'RECEIVED') throw new ErroGateway('Só cobranças pagas podem ser estornadas');
    if (cobranca.reembolsado + valorCentavos > cobranca.valor) throw new ErroGateway('Valor do estorno maior que o saldo da cobrança');
    cobranca.reembolsado += valorCentavos;
    reembolsos.push({ idExterno, valor: valorCentavos, descricao });
    return { status: 'DONE' };
  }

  async function transferirParaCarteira(walletId, valorCentavos, referencia) {
    talvezFalhar('transferirParaCarteira');
    const idExterno = proximoId('tra');
    transferencias.push({ idExterno, walletId, valor: valorCentavos, referencia });
    return { idExterno, status: 'DONE' };
  }

  // Corpo de webhook igual ao do Asaas. `valor` (centavos) e `referencia` permitem simular divergências.
  // Um evento novo a cada chamada; para testar repetição, envie o MESMO objeto duas vezes
  function eventoPagamento(idExterno, { tipo = 'PAYMENT_CONFIRMED', valor, referencia } = {}) {
    const cobranca = exigirCobranca(idExterno);
    if (tipo === 'PAYMENT_CONFIRMED' || tipo === 'PAYMENT_RECEIVED') cobranca.status = 'RECEIVED';
    const valorCobrado = valor ?? cobranca.valor;
    const taxa = cobranca.metodo === 'pix' ? taxaPixCentavos : Math.round(valorCobrado * 0.0299) + 49;
    return {
      id: proximoId('evt'),
      event: tipo,
      dateCreated: new Date().toISOString().slice(0, 19).replace('T', ' '),
      payment: {
        object: 'payment',
        id: idExterno,
        customer: cobranca.clienteId,
        value: paraReais(valorCobrado),
        netValue: paraReais(valorCobrado - taxa),
        billingType: cobranca.metodo === 'pix' ? 'PIX' : 'CREDIT_CARD',
        status: 'CONFIRMED',
        externalReference: referencia ?? cobranca.referencia,
        confirmedDate: new Date().toISOString().slice(0, 10),
      },
    };
  }

  const GERAL_DA_SITUACAO = { aprovado: 'APPROVED', em_analise: 'AWAITING_APPROVAL', pendente: 'PENDING', recusado: 'REJECTED' };

  function eventoSituacaoConta(contaId, situacao = 'aprovado') {
    const subconta = subcontas.get(contaId);
    if (subconta) subconta.situacao = situacao;
    const geral = GERAL_DA_SITUACAO[situacao];
    return {
      id: proximoId('evt'),
      event: `ACCOUNT_STATUS_GENERAL_APPROVAL_${geral}`,
      dateCreated: new Date().toISOString().slice(0, 19).replace('T', ' '),
      account: { id: contaId, ownerId: null },
      accountStatus: { id: contaId, commercialInfo: geral, bankAccountInfo: geral, documentation: geral, general: geral },
    };
  }

  const gateway = {
    nome: 'falso',
    simulado: true,
    aprovacaoAutomatica: true,
    tokenWebhook,
    webhookAutorizado: (token) => tokenConfere(token, tokenWebhook),
    interpretarEvento: interpretarEventoAsaas,
    criarSubconta,
    consultarSituacaoSubconta,
    garantirCliente,
    criarCobranca,
    cancelarCobranca,
    reembolsar,
    transferirParaCarteira,
    // Só do falso: inspeção e simulação nos testes e na tela de desenvolvimento
    eventoPagamento,
    eventoSituacaoConta,
    falharProximas,
    clientes,
    subcontas,
    cobrancas,
    transferencias,
    reembolsos,
    cancelamentos,
  };
  return gateway;
}

module.exports = { criarGatewayFalso };
