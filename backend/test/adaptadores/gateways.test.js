// Adaptadores da Etapa 4b. O gatewayAsaas é testado com um fetch falso: nenhum teste chama a API real
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { criarGatewayAsaas, interpretarEventoAsaas } = require('../../src/adaptadores/gatewayAsaas');
const { criarGatewayFalso } = require('../../src/adaptadores/gatewayFalso');
const { criarCifraAesGcm } = require('../../src/adaptadores/cifraAesGcm');
const { ErroGateway } = require('../../src/dominio/erros');

// Responde na ordem as respostas programadas e guarda cada chamada
function fetchFalso(respostas) {
  const chamadas = [];
  async function fetch(url, opcoes) {
    chamadas.push({ url, ...opcoes, corpo: opcoes.body ? JSON.parse(opcoes.body) : undefined });
    const resposta = respostas.shift();
    if (resposta instanceof Error) throw resposta;
    return new Response(JSON.stringify(resposta.corpo ?? {}), { status: resposta.status ?? 200 });
  }
  return { fetch, chamadas };
}

const configAsaas = {
  urlApi: 'https://api-sandbox.asaas.com/v3/',
  chaveApi: '$aact_hmlg_teste',
  tokenWebhook: 'token-do-webhook-com-mais-de-32-caracteres',
  urlWebhook: 'https://estadiaprime.com.br/api/webhooks/asaas',
};

describe('gatewayAsaas', () => {
  test('cobrança Pix: converte centavos → reais, manda a referência e busca o QR', async () => {
    const { fetch, chamadas } = fetchFalso([
      { corpo: { id: 'pay_1', invoiceUrl: 'https://sandbox.asaas.com/i/1' } },
      { corpo: { payload: '000201...', encodedImage: 'iVBOR...' } },
    ]);
    const gateway = criarGatewayAsaas({ ...configAsaas, fetch });
    const cobranca = await gateway.criarCobranca({
      clienteId: 'cus_1', valor: 910050, metodo: 'pix', descricao: 'Reserva 7', referencia: 7, vencimento: '2026-10-19', urlRetorno: 'http://localhost:5173/x',
    });

    assert.deepEqual(cobranca, { idExterno: 'pay_1', urlFatura: 'https://sandbox.asaas.com/i/1', pixCopiaCola: '000201...', pixQrBase64: 'iVBOR...' });
    assert.equal(chamadas[0].url, 'https://api-sandbox.asaas.com/v3/payments');
    assert.equal(chamadas[0].method, 'POST');
    assert.equal(chamadas[0].headers.access_token, '$aact_hmlg_teste');
    assert.ok(chamadas[0].headers['User-Agent'], 'User-Agent é obrigatório no Asaas');
    assert.deepEqual(chamadas[0].corpo, {
      customer: 'cus_1', billingType: 'PIX', value: 9100.5, dueDate: '2026-10-19', description: 'Reserva 7', externalReference: '7',
    });
    assert.equal(chamadas[1].url, 'https://api-sandbox.asaas.com/v3/payments/pay_1/pixQrCode');
  });

  test('cartão: só usa o retorno automático com https', async () => {
    const { fetch, chamadas } = fetchFalso([{ corpo: { id: 'pay_2', invoiceUrl: 'https://sandbox.asaas.com/i/2' } }]);
    const gateway = criarGatewayAsaas({ ...configAsaas, fetch });
    await gateway.criarCobranca({
      clienteId: 'cus_1', valor: 100, metodo: 'cartao', descricao: 'R', referencia: 1, vencimento: '2026-10-19', urlRetorno: 'https://estadiaprime.com.br/reservas/1/pagamento',
    });
    assert.equal(chamadas[0].corpo.billingType, 'CREDIT_CARD');
    assert.deepEqual(chamadas[0].corpo.callback, { successUrl: 'https://estadiaprime.com.br/reservas/1/pagamento', autoRedirect: true });
    assert.equal(chamadas.length, 1, 'cartão não busca QR');
  });

  test('subconta: campos obrigatórios da doc, webhook de situação e a apiKey devolvida', async () => {
    const { fetch, chamadas } = fetchFalso([{ corpo: { id: 'acc_1', walletId: 'wal_1', apiKey: '$aact_sub' } }]);
    const gateway = criarGatewayAsaas({ ...configAsaas, fetch });
    const conta = await gateway.criarSubconta({
      nome: 'Ana Souza', email: 'ana@x.com', cpfCnpj: '52998224725', dataNascimento: '1985-04-12', telefoneCelular: '21999990000',
      rendaMensal: 1500000, cep: '28950000', endereco: 'Rua das Ondas', numero: '10', bairro: 'Geribá',
    });
    assert.deepEqual(conta, { contaId: 'acc_1', walletId: 'wal_1', chaveApi: '$aact_sub', situacao: 'em_analise' });
    const corpo = chamadas[0].corpo;
    assert.equal(corpo.incomeValue, 15000);
    assert.equal(corpo.postalCode, '28950000');
    assert.equal(corpo.province, 'Geribá');
    assert.equal(corpo.webhooks[0].url, configAsaas.urlWebhook);
    assert.equal(corpo.webhooks[0].authToken, configAsaas.tokenWebhook);
    assert.ok(corpo.webhooks[0].events.includes('ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED'));
  });

  test('situação da subconta usa a apiKey da própria subconta', async () => {
    const { fetch, chamadas } = fetchFalso([{ corpo: { general: 'APPROVED' } }]);
    const gateway = criarGatewayAsaas({ ...configAsaas, fetch });
    assert.deepEqual(await gateway.consultarSituacaoSubconta({ chaveApi: '$aact_sub' }), { situacao: 'aprovado' });
    assert.equal(chamadas[0].url, 'https://api-sandbox.asaas.com/v3/myAccount/status');
    assert.equal(chamadas[0].headers.access_token, '$aact_sub');
  });

  test('reembolso parcial e transferência por walletId em reais', async () => {
    const { fetch, chamadas } = fetchFalso([{ corpo: { status: 'DONE' } }, { corpo: { id: 'tra_1', status: 'DONE' } }]);
    const gateway = criarGatewayAsaas({ ...configAsaas, fetch });
    await gateway.reembolsar('pay_1', 160000, 'Cancelamento');
    assert.equal(chamadas[0].url, 'https://api-sandbox.asaas.com/v3/payments/pay_1/refund');
    assert.deepEqual(chamadas[0].corpo, { value: 1600, description: 'Cancelamento' });
    assert.deepEqual(await gateway.transferirParaCarteira('wal_1', 660000, 'repasse-3'), { idExterno: 'tra_1', status: 'DONE' });
    assert.deepEqual(chamadas[1].corpo, { value: 6600, walletId: 'wal_1', externalReference: 'repasse-3' });
  });

  test('erro do Asaas vira ErroGateway com a descrição; rede fora e timeout também', async () => {
    const { fetch } = fetchFalso([
      { status: 400, corpo: { errors: [{ code: 'invalid_cpfCnpj', description: 'O CPF/CNPJ informado é inválido.' }] } },
      new TypeError('fetch failed'),
      Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
      { status: 200, corpo: { id: 'tra_2', status: 'FAILED' } },
    ]);
    const gateway = criarGatewayAsaas({ ...configAsaas, fetch });
    await assert.rejects(gateway.garantirCliente({ nome: 'X', cpfCnpj: '1' }), (erro) => erro instanceof ErroGateway && /CPF\/CNPJ informado é inválido/.test(erro.message));
    await assert.rejects(gateway.cancelarCobranca('pay_1'), ErroGateway);
    await assert.rejects(gateway.cancelarCobranca('pay_1'), /demorou para responder/);
    await assert.rejects(gateway.transferirParaCarteira('wal', 100, 'r'), ErroGateway, 'transferência FAILED conta como falha');
  });

  test('cliente já criado não é criado de novo', async () => {
    const { fetch, chamadas } = fetchFalso([]);
    const gateway = criarGatewayAsaas({ ...configAsaas, fetch });
    assert.equal(await gateway.garantirCliente({ asaasClienteId: 'cus_9' }), 'cus_9');
    assert.equal(chamadas.length, 0);
  });

  test('token do webhook e leitura do evento (reais → centavos)', () => {
    const gateway = criarGatewayAsaas({ ...configAsaas, fetch: async () => null });
    assert.ok(gateway.webhookAutorizado(configAsaas.tokenWebhook));
    assert.equal(gateway.webhookAutorizado('outro'), false);
    assert.equal(gateway.webhookAutorizado(undefined), false);

    const evento = interpretarEventoAsaas({
      id: 'evt_1', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1', value: 9100.1, netValue: 9098.11, externalReference: '7' },
    });
    assert.deepEqual(evento.pagamento, { idExterno: 'pay_1', valor: 910010, valorLiquido: 909811, referencia: '7', dataPagamento: null });
    const conta = interpretarEventoAsaas({ id: 'evt_2', event: 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED', accountStatus: { id: 'acc_1', general: 'APPROVED' } });
    assert.deepEqual(conta.conta, { id: 'acc_1', situacao: 'aprovado' });
    assert.equal(interpretarEventoAsaas({ event: 'PAYMENT_RECEIVED' }), null, 'sem id não dá para garantir idempotência');
  });
});

describe('gatewayFalso', () => {
  test('mesma interface do Asaas', () => {
    const asaas = criarGatewayAsaas({ ...configAsaas, fetch: async () => null });
    const falso = criarGatewayFalso();
    for (const [nome, valor] of Object.entries(asaas)) {
      assert.equal(typeof falso[nome], typeof valor, `gatewayFalso.${nome}`);
    }
  });

  test('simula pagamento, estorno limitado ao valor pago e falhas programadas', async () => {
    const gateway = criarGatewayFalso();
    const cliente = await gateway.garantirCliente({ nome: 'Hugo' });
    const { idExterno } = await gateway.criarCobranca({ clienteId: cliente, valor: 1000, metodo: 'pix', descricao: 'x', referencia: 1 });
    await assert.rejects(gateway.reembolsar(idExterno, 1000), ErroGateway, 'não pago ainda');
    gateway.eventoPagamento(idExterno);
    await gateway.reembolsar(idExterno, 600);
    await assert.rejects(gateway.reembolsar(idExterno, 600), ErroGateway, 'mais que o saldo');
    gateway.falharProximas('transferirParaCarteira', 1, 'Asaas fora do ar');
    await assert.rejects(gateway.transferirParaCarteira('w', 10, 'r'), /Asaas fora do ar/);
    await gateway.transferirParaCarteira('w', 10, 'r');
    assert.equal(gateway.transferencias.length, 1);
  });
});

describe('cifra AES-256-GCM', () => {
  const chave = 'ab'.repeat(32);

  test('cifra e decifra; cada cifragem é diferente (IV aleatório)', () => {
    const cifra = criarCifraAesGcm(chave);
    const a = cifra.cifrar('$aact_segredo');
    const b = cifra.cifrar('$aact_segredo');
    assert.notEqual(a, b);
    assert.ok(!a.includes('segredo'));
    assert.equal(cifra.decifrar(a), '$aact_segredo');
  });

  test('recusa dado alterado, chave errada e chave mal formada', () => {
    const cifra = criarCifraAesGcm(chave);
    const gravado = cifra.cifrar('$aact_segredo');
    const partes = gravado.split('.');
    partes[3] = Buffer.from('outra coisa').toString('base64url');
    assert.throws(() => cifra.decifrar(partes.join('.')));
    assert.throws(() => criarCifraAesGcm('cd'.repeat(32)).decifrar(gravado));
    assert.throws(() => criarCifraAesGcm('curta'), /64 caracteres/);
  });
});
