// Etapa 4b (Asaas) via HTTP real + SQLite :memory: + gateway FALSO (nenhum teste chama a API real).
// Cenários "Pagamento com Split" e "Cancelamento" do SPEC, RN07–RN10, RN13, RN20 e CB03/CB04
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidorTeste, criarNavegador } = require('../ajudantes/servidorTeste');
const { criarImovel, criarServico } = require('../ajudantes/dadosBanco');
const { hojeEmBrasilia } = require('../../src/dominio/periodo');

let servidor;
let villa;
let mordomo;
let contas;
let contador = 0;

const CPF_HOSPEDE = '529.982.247-25';
const UM_DIA_MS = 86_400_000;
const diaDaqui = (dias) => hojeEmBrasilia(new Date(Date.now() + dias * UM_DIA_MS));

async function entrarComo(tipo, nome = `Pessoa ${tipo}`) {
  contador += 1;
  const navegador = criarNavegador(servidor.urlBase);
  const { corpo } = await navegador.post('/api/auth/cadastro', {
    nome, email: `pagamento${contador}@x.com`, senha: 'senhaForte123', tipo, telefone: '21999990000',
  });
  navegador.id = corpo.usuario.id;
  return navegador;
}

// Recebedor com subconta aprovada (RN13): walletId conhecido para conferir as transferências
function aprovarRecebimento(conta, walletId) {
  servidor.db.prepare(`
    UPDATE usuarios SET recebimento_ativo = 1, situacao_recebimento = 'aprovado', asaas_conta_id = ?, conta_pagamento_id = ? WHERE id = ?
  `).run(`acc-${walletId}`, walletId, conta.id);
}

function pedido(dados = {}) {
  return {
    imovel_id: villa,
    checkin: '2099-12-20',
    checkout: '2099-12-23',
    num_hospedes: 6,
    servicos: [{ servico_id: mordomo, data_servico: '2099-12-21', quantidade: 2 }],
    ...dados,
  };
}

async function reservar(hospede = contas.hospede, dados) {
  const resposta = await hospede.post('/api/reservas', pedido(dados));
  assert.equal(resposta.status, 201, JSON.stringify(resposta.corpo));
  return resposta.corpo.reserva;
}

async function iniciarPagamento(reservaId, metodo = 'pix', hospede = contas.hospede) {
  await hospede.put('/api/auth/eu/documento', { cpf_cnpj: CPF_HOSPEDE });
  const resposta = await hospede.post(`/api/reservas/${reservaId}/pagamento`, { metodo });
  assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));
  return resposta.corpo.pagamento;
}

const idExterno = (pagamentoId) => servidor.db.prepare('SELECT id_externo FROM pagamentos WHERE id = ?').get(pagamentoId).id_externo;
const statusReserva = (id) => servidor.db.prepare('SELECT status FROM reservas WHERE id = ?').get(id).status;
const pagamentoGravado = (id) => servidor.db.prepare('SELECT * FROM pagamentos WHERE id = ?').get(id);
const vencerPrazo = (reservaId) => servidor.db.prepare("UPDATE reservas SET data_reserva = datetime('now', '-31 minutes') WHERE id = ?").run(reservaId);

// Reserva paga e confirmada pelo caminho completo (cobrança → webhook do gateway)
async function reservaConfirmada(dados, hospede = contas.hospede) {
  const reserva = await reservar(hospede, dados);
  const pagamento = await iniciarPagamento(reserva.id, 'pix', hospede);
  const resposta = await hospede.webhook(servidor.gateway.eventoPagamento(idExterno(pagamento.id)));
  assert.equal(resposta.corpo.resultado, 'confirmada');
  return { reserva, pagamento };
}

beforeEach(async () => {
  servidor = await iniciarServidorTeste();
  const anfitriao = await entrarComo('anfitriao', 'Ana Souza');
  const prestador = await entrarComo('prestador', 'Paulo Andrade');
  aprovarRecebimento(anfitriao, 'wallet-ana');
  aprovarRecebimento(prestador, 'wallet-paulo');
  villa = criarImovel(servidor.db, anfitriao.id, { titulo: 'Villa Vista Mar', endereco: 'Rua das Ondas, 10' });
  mordomo = criarServico(servidor.db, prestador.id, { tipo_servico: 'mordomo', preco: 80000 });
  contas = { anfitriao, prestador, hospede: await entrarComo('hospede', 'Hugo Lima') };
});

afterEach(async () => {
  await servidor.fechar();
  assert.deepEqual(servidor.errosRegistrados, [], 'nenhum erro inesperado deveria ter sido registrado');
});

test('Pix: pede o CPF, gera QR e copia-e-cola, e chamar de novo devolve a MESMA cobrança', async () => {
  const reserva = await reservar();
  const semCpf = await contas.hospede.post(`/api/reservas/${reserva.id}/pagamento`, { metodo: 'pix' });
  assert.equal(semCpf.status, 422);
  assert.equal(semCpf.corpo.erro.codigo, 'DOCUMENTO_OBRIGATORIO');

  const documento = await contas.hospede.put('/api/auth/eu/documento', { cpf_cnpj: CPF_HOSPEDE });
  assert.equal(documento.corpo.usuario.cpf_cnpj, '***.982.247-**', 'o CPF volta mascarado');
  assert.equal((await contas.hospede.put('/api/auth/eu/documento', { cpf_cnpj: '111.111.111-11' })).status, 400);

  const primeira = await contas.hospede.post(`/api/reservas/${reserva.id}/pagamento`, { metodo: 'pix' });
  assert.equal(primeira.status, 200);
  const { pagamento } = primeira.corpo;
  assert.equal(pagamento.status, 'pendente');
  assert.equal(pagamento.metodo, 'pix');
  assert.equal(pagamento.valor, 910000, 'o valor GRAVADO na reserva');
  assert.ok(pagamento.pix_copia_cola && pagamento.pix_qr_base64);
  assert.ok(pagamento.expira_em, 'o prazo dos 30 minutos vai para a contagem regressiva');

  const segunda = await contas.hospede.post(`/api/reservas/${reserva.id}/pagamento`, { metodo: 'pix' });
  assert.equal(segunda.corpo.pagamento.id, pagamento.id);
  assert.equal(servidor.gateway.cobrancas.size, 1, 'nenhuma cobrança duplicada no gateway');
  assert.equal(servidor.gateway.clientes.size, 1);
  assert.equal(servidor.db.prepare('SELECT asaas_cliente_id FROM usuarios WHERE id = ?').get(contas.hospede.id).asaas_cliente_id !== null, true);

  // CPF já enviado ao gateway: não muda mais
  const troca = await contas.hospede.put('/api/auth/eu/documento', { cpf_cnpj: '11.222.333/0001-81' });
  assert.equal(troca.status, 409);
});

test('Pix confirmado pelo webhook (RN08): reserva confirmada, endereço liberado, taxa do gateway gravada', async () => {
  const reserva = await reservar();
  const pagamento = await iniciarPagamento(reserva.id);

  // A tela de retorno NÃO confirma: só o webhook (RN08)
  assert.equal((await contas.hospede.get(`/api/reservas/${reserva.id}/pagamento`)).corpo.reserva.status, 'pendente');

  const evento = servidor.gateway.eventoPagamento(idExterno(pagamento.id));
  const resposta = await contas.hospede.webhook(evento);
  assert.equal(resposta.status, 200);
  assert.equal(resposta.corpo.resultado, 'confirmada');

  const situacao = (await contas.hospede.get(`/api/reservas/${reserva.id}/pagamento`)).corpo;
  assert.equal(situacao.reserva.status, 'confirmada');
  assert.equal(situacao.reserva.imovel.endereco, 'Rua das Ondas, 10', 'RN12');
  assert.equal(situacao.pagamento.status, 'aprovado');
  assert.equal(situacao.pagamento.pix_copia_cola, null, 'o QR some depois de pago');
  assert.equal(pagamentoGravado(pagamento.id).taxa_gateway, 199, 'Pix com taxa fixa de R$ 1,99');

  // Webhook repetido (mesmo id de evento) e PAYMENT_RECEIVED depois do CONFIRMED: nada muda
  assert.equal((await contas.hospede.webhook(evento)).corpo.resultado, 'repetido');
  const recebido = servidor.gateway.eventoPagamento(idExterno(pagamento.id), { tipo: 'PAYMENT_RECEIVED' });
  assert.equal((await contas.hospede.webhook(recebido)).corpo.resultado, 'ja_processado');
  assert.equal(servidor.db.prepare('SELECT COUNT(*) AS total FROM eventos_gateway').get().total, 2);
  assert.equal(statusReserva(reserva.id), 'confirmada');

  // Reserva já paga não gera nova cobrança
  assert.equal((await contas.hospede.post(`/api/reservas/${reserva.id}/pagamento`, { metodo: 'pix' })).status, 409);
});

test('cartão: trocar de método cancela o Pix anterior; o webhook confirma o cartão', async () => {
  const reserva = await reservar();
  const pix = await iniciarPagamento(reserva.id, 'pix');
  const cartao = await iniciarPagamento(reserva.id, 'cartao');

  assert.notEqual(cartao.id, pix.id);
  assert.equal(cartao.metodo, 'cartao');
  assert.equal(cartao.pix_copia_cola, null);
  assert.equal(pagamentoGravado(pix.id).status, 'cancelado');
  assert.deepEqual(servidor.gateway.cancelamentos, [idExterno(pix.id)], 'a cobrança Pix foi apagada no gateway');

  const resposta = await contas.hospede.webhook(servidor.gateway.eventoPagamento(idExterno(cartao.id)));
  assert.equal(resposta.corpo.resultado, 'confirmada');
  assert.equal(pagamentoGravado(cartao.id).metodo, 'cartao_credito');
  assert.ok(pagamentoGravado(cartao.id).taxa_gateway > 0);
});

test('cartão recusado: pagamento recusado, reserva continua pendente e dá para tentar de novo', async () => {
  const reserva = await reservar();
  const cartao = await iniciarPagamento(reserva.id, 'cartao');
  const recusa = servidor.gateway.eventoPagamento(idExterno(cartao.id), { tipo: 'PAYMENT_REPROVED_BY_RISK_ANALYSIS' });
  assert.equal((await contas.hospede.webhook(recusa)).corpo.resultado, 'recusado');
  assert.equal(statusReserva(reserva.id), 'pendente');
  const novo = await iniciarPagamento(reserva.id, 'pix');
  assert.notEqual(novo.id, cartao.id);
});

test('webhook sem token ou com token errado → 401 e nada muda; evento desconhecido → 200 e ignorado', async () => {
  const reserva = await reservar();
  const pagamento = await iniciarPagamento(reserva.id);
  const evento = servidor.gateway.eventoPagamento(idExterno(pagamento.id));

  assert.equal((await contas.hospede.webhook(evento, null)).status, 401);
  assert.equal((await contas.hospede.webhook(evento, 'token-errado')).status, 401);
  assert.equal(statusReserva(reserva.id), 'pendente');
  assert.equal(servidor.db.prepare('SELECT COUNT(*) AS total FROM eventos_gateway').get().total, 0);

  const desconhecido = await contas.hospede.webhook({ id: 'evt_x', event: 'PAYMENT_BANK_SLIP_VIEWED', payment: { id: 'pay_x' } });
  assert.deepEqual([desconhecido.status, desconhecido.corpo.resultado], [200, 'ignorado']);
  assert.equal((await contas.hospede.webhook({ event: 'PAYMENT_RECEIVED' })).status, 400, 'sem id não dá para garantir idempotência');
});

test('valor ou referência divergente: o webhook é recusado e a reserva continua pendente', async () => {
  const reserva = await reservar();
  const pagamento = await iniciarPagamento(reserva.id);

  const valorErrado = servidor.gateway.eventoPagamento(idExterno(pagamento.id), { valor: 100 });
  assert.equal((await contas.hospede.webhook(valorErrado)).corpo.resultado, 'valor_divergente');
  const outraReserva = servidor.gateway.eventoPagamento(idExterno(pagamento.id), { referencia: '999' });
  assert.equal((await contas.hospede.webhook(outraReserva)).corpo.resultado, 'referencia_divergente');

  assert.equal(statusReserva(reserva.id), 'pendente');
  assert.equal(pagamentoGravado(pagamento.id).status, 'pendente');
  assert.equal(servidor.errosRegistrados.length, 2, 'divergências vão para o log');
  servidor.errosRegistrados.length = 0;
});

test('CB03: pagamento depois da expiração com as datas livres → reserva confirmada', async () => {
  const reserva = await reservar();
  const pagamento = await iniciarPagamento(reserva.id);
  vencerPrazo(reserva.id);
  assert.equal((await contas.hospede.post(`/api/reservas/${reserva.id}/pagamento`, { metodo: 'pix' })).status, 409, 'prazo encerrado');

  const resposta = await contas.hospede.webhook(servidor.gateway.eventoPagamento(idExterno(pagamento.id)));
  assert.equal(resposta.corpo.resultado, 'reativada');
  assert.equal(statusReserva(reserva.id), 'confirmada');
  assert.equal(servidor.gateway.reembolsos.length, 0);
});

test('CB03/CB04: pagamento depois da expiração com as datas tomadas → reembolso integral automático e reserva cancelada', async () => {
  const atrasada = await reservar();
  const pagamento = await iniciarPagamento(atrasada.id);
  vencerPrazo(atrasada.id);
  await (await entrarComo('hospede')).post('/api/reservas', pedido()).then((r) => assert.equal(r.status, 201, 'outro hóspede pega as datas'));

  const resposta = await contas.hospede.webhook(servidor.gateway.eventoPagamento(idExterno(pagamento.id)));
  assert.equal(resposta.corpo.resultado, 'reembolso_automatico');
  assert.equal(statusReserva(atrasada.id), 'cancelada');
  const gravado = pagamentoGravado(pagamento.id);
  assert.deepEqual([gravado.status, gravado.valor_reembolsado], ['reembolsado', 910000]);
  assert.deepEqual(servidor.gateway.reembolsos.map((r) => r.valor), [910000]);

  // Aparece para o hóspede como cancelada com o valor devolvido; nada a repassar
  const minhas = (await contas.hospede.get('/api/reservas')).corpo.reservas;
  assert.equal(minhas.find((r) => r.id === atrasada.id).valor_reembolsado, 910000);
  await servidor.rotinas.executarRepasses({ agora: new Date('2100-01-10T12:00:00Z') });
  assert.equal(servidor.gateway.transferencias.length, 0);
});

test('reembolso automático que falha fica pendente e a rotina tenta de novo', async () => {
  const atrasada = await reservar();
  const pagamento = await iniciarPagamento(atrasada.id);
  vencerPrazo(atrasada.id);
  await (await entrarComo('hospede')).post('/api/reservas', pedido());

  servidor.gateway.falharProximas('reembolsar', 1, 'Saldo insuficiente');
  await contas.hospede.webhook(servidor.gateway.eventoPagamento(idExterno(pagamento.id)));
  assert.equal(pagamentoGravado(pagamento.id).status, 'reembolso_pendente');
  assert.equal(servidor.errosRegistrados.length, 1);
  servidor.errosRegistrados.length = 0;

  assert.deepEqual(await servidor.rotinas.reembolsarPendentes(), { reembolsados: 1 });
  assert.equal(pagamentoGravado(pagamento.id).status, 'reembolsado');
  assert.deepEqual(await servidor.rotinas.reembolsarPendentes(), { reembolsados: 0 }, 'não reembolsa duas vezes');
});

test('RN07: a rotina cancela a reserva vencida e apaga a cobrança no gateway', async () => {
  const reserva = await reservar();
  const pagamento = await iniciarPagamento(reserva.id);
  const emDia = await reservar(contas.hospede, { checkin: '2099-11-01', checkout: '2099-11-03', servicos: [] });

  vencerPrazo(reserva.id);
  assert.deepEqual(await servidor.rotinas.expirarReservasPendentes(), { canceladas: 1 });
  assert.equal(statusReserva(reserva.id), 'cancelada');
  assert.equal(statusReserva(emDia.id), 'pendente', 'a que está no prazo não muda');
  assert.equal(pagamentoGravado(pagamento.id).status, 'cancelado');
  assert.deepEqual(servidor.gateway.cancelamentos, [idExterno(pagamento.id)]);

  // Carrinho abandonado não polui as listas
  const ids = (await contas.hospede.get('/api/reservas')).corpo.reservas.map((r) => r.id);
  assert.deepEqual(ids, [emDia.id]);
});

test('desistir de reserva pendente apaga a cobrança em aberto', async () => {
  const reserva = await reservar();
  const pagamento = await iniciarPagamento(reserva.id);
  assert.equal((await contas.hospede.post(`/api/reservas/${reserva.id}/desistir`)).status, 200);
  assert.equal(pagamentoGravado(pagamento.id).status, 'cancelado');
});

test('RN09: repasse só 24h depois do check-in, uma única vez, para o walletId de cada recebedor', async () => {
  const { reserva } = await reservaConfirmada();
  const recebidas = (await contas.anfitriao.get('/api/reservas-recebidas')).corpo.reservas;
  assert.equal(recebidas[0].repasse.situacao, 'aguardando_checkin');
  assert.equal(recebidas[0].repasse.previsto_para, '2099-12-21T18:00:00.000Z');

  assert.deepEqual(await servidor.rotinas.executarRepasses({ agora: new Date('2099-12-21T17:59:00Z') }), { reservas: 0, enviados: 0, falhas: 0 });
  assert.deepEqual(await servidor.rotinas.executarRepasses({ agora: new Date('2099-12-21T18:00:00Z') }), { reservas: 1, enviados: 2, falhas: 0 });

  assert.deepEqual(
    servidor.gateway.transferencias.map(({ walletId, valor }) => ({ walletId, valor })),
    [{ walletId: 'wallet-ana', valor: 660000 }, { walletId: 'wallet-paulo', valor: 136000 }],
    'SPEC: anfitrião R$ 6.600 e mordomo R$ 1.360; a plataforma fica com R$ 1.140',
  );
  assert.ok(servidor.db.prepare('SELECT repasse_em FROM reservas WHERE id = ?').get(reserva.id).repasse_em);

  await servidor.rotinas.executarRepasses({ agora: new Date('2099-12-25T12:00:00Z') });
  assert.equal(servidor.gateway.transferencias.length, 2, 'nunca repassa duas vezes');

  assert.equal((await contas.anfitriao.get('/api/reservas-recebidas')).corpo.reservas[0].repasse.situacao, 'enviado');
  assert.equal((await contas.prestador.get('/api/agenda')).corpo.agenda[0].situacao_repasse, 'enviado');

  // Depois do repasse, o cancelamento vai para o suporte
  const cancelar = await contas.hospede.post(`/api/reservas/${reserva.id}/cancelar`);
  assert.equal(cancelar.status, 409);
  assert.equal(cancelar.corpo.erro.codigo, 'REPASSE_JA_REALIZADO');
});

test('repasse que falha é tentado de novo na rodada seguinte (até 5 vezes)', async () => {
  const { reserva } = await reservaConfirmada();
  const depoisDoCheckin = { agora: new Date('2099-12-22T12:00:00Z') };

  servidor.gateway.falharProximas('transferirParaCarteira', 1, 'Asaas fora do ar');
  assert.deepEqual(await servidor.rotinas.executarRepasses(depoisDoCheckin), { reservas: 1, enviados: 1, falhas: 1 });
  const falhou = servidor.db.prepare("SELECT * FROM repasses WHERE status = 'falhou'").get();
  assert.deepEqual([falhou.tentativa, falhou.ultimo_erro], [1, 'Asaas fora do ar']);
  assert.equal(servidor.db.prepare('SELECT repasse_em FROM reservas WHERE id = ?').get(reserva.id).repasse_em, null);

  assert.deepEqual(await servidor.rotinas.executarRepasses(depoisDoCheckin), { reservas: 1, enviados: 1, falhas: 0 });
  assert.equal(servidor.db.prepare("SELECT COUNT(*) AS total FROM repasses WHERE status = 'enviado'").get().total, 2);
  assert.ok(servidor.db.prepare('SELECT repasse_em FROM reservas WHERE id = ?').get(reserva.id).repasse_em);

  // Esgotou as 5 tentativas: para de tentar e avisa no log
  const outra = await reservaConfirmada({ checkin: '2099-10-01', checkout: '2099-10-03', servicos: [] });
  servidor.gateway.falharProximas('transferirParaCarteira', 99, 'Conta bloqueada');
  for (let rodada = 0; rodada < 6; rodada += 1) await servidor.rotinas.executarRepasses(depoisDoCheckin);
  const esgotado = servidor.db.prepare('SELECT tentativa FROM repasses WHERE reserva_id = ?').get(outra.reserva.id);
  assert.equal(esgotado.tentativa, 5);
  assert.equal(servidor.errosRegistrados.length, 1);
  servidor.errosRegistrados.length = 0;
});

test('cancelamento com 7+ dias: prévia = valor devolvido; reembolso integral (inclusos também, RN20); datas e prestador liberados', async () => {
  const incluso = servidor.db.prepare("INSERT INTO imovel_servicos_inclusos (imovel_id, nome, preco, unidade_preco) VALUES (?, 'Caseiro', 15000, 'noite')").run(villa).lastInsertRowid;
  const { reserva, pagamento } = await reservaConfirmada({ inclusos: [incluso] });
  assert.equal(reserva.valor_total, 955000);

  const previa = (await contas.hospede.get(`/api/reservas/${reserva.id}/cancelamento`)).corpo;
  assert.deepEqual(previa, {
    pode_cancelar: true,
    motivo: null,
    reembolso: { integral: true, valor_hospedagem: 750000, valor_inclusos: 45000, valor_servicos: 160000, valor_total: 955000 },
  });

  const resposta = await contas.hospede.post(`/api/reservas/${reserva.id}/cancelar`);
  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.corpo.reembolso, previa.reembolso, 'cancelou com a mesma conta da prévia');
  assert.equal(resposta.corpo.reserva.status, 'cancelada');
  assert.deepEqual(servidor.gateway.reembolsos.map((r) => r.valor), [955000]);
  const gravado = pagamentoGravado(pagamento.id);
  assert.deepEqual([gravado.status, gravado.valor_reembolsado], ['reembolsado', 955000]);
  assert.equal(servidor.db.prepare('SELECT COUNT(*) AS total FROM reserva_inclusos WHERE reembolsado = 1').get().total, 1);

  assert.equal((await (await entrarComo('hospede')).post('/api/reservas', pedido())).status, 201, 'datas e mordomo liberados');
  assert.equal((await contas.hospede.post(`/api/reservas/${reserva.id}/cancelar`)).status, 409, 'já cancelada');

  await servidor.rotinas.executarRepasses({ agora: new Date('2100-01-10T12:00:00Z') });
  assert.equal(servidor.gateway.transferencias.length, 0, 'nada a repassar');
});

test('cancelamento com menos de 7 dias: só o serviço a mais de 48h volta; hospedagem e inclusos ficam (RN10 + RN20)', async () => {
  const incluso = servidor.db.prepare("INSERT INTO imovel_servicos_inclusos (imovel_id, nome, preco, unidade_preco) VALUES (?, 'Lenha', 12000, 'estadia')").run(villa).lastInsertRowid;
  const checkin = diaDaqui(1);
  const { reserva } = await reservaConfirmada({
    checkin,
    checkout: diaDaqui(4),
    inclusos: [incluso],
    servicos: [
      { servico_id: mordomo, data_servico: diaDaqui(1), quantidade: 1 }, // menos de 48h: não volta
      { servico_id: mordomo, data_servico: diaDaqui(3), quantidade: 2 }, // mais de 48h: volta
    ],
  });

  const resposta = await contas.hospede.post(`/api/reservas/${reserva.id}/cancelar`);
  assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));
  assert.deepEqual(resposta.corpo.reembolso, { integral: false, valor_hospedagem: 0, valor_inclusos: 0, valor_servicos: 160000, valor_total: 160000 });
  assert.deepEqual(servidor.gateway.reembolsos.map((r) => r.valor), [160000]);

  // Repasse do que NÃO voltou: anfitrião (hospedagem + Lenha) e o mordomo pelo dia que ficou
  const depois = new Date(Date.parse(`${checkin}T15:00:00-03:00`) + 2 * UM_DIA_MS);
  await servidor.rotinas.executarRepasses({ agora: depois });
  assert.deepEqual(
    servidor.gateway.transferencias.map(({ walletId, valor }) => ({ walletId, valor })),
    [{ walletId: 'wallet-ana', valor: 660000 + 10560 }, { walletId: 'wallet-paulo', valor: 68000 }],
  );
  const agenda = (await contas.prestador.get('/api/agenda')).corpo.agenda;
  assert.deepEqual(agenda.map((item) => item.data_servico), [diaDaqui(1)], 'o item reembolsado sai da agenda');
});

test('reembolso que falha no gateway: a reserva continua confirmada e dá para tentar de novo', async () => {
  const { reserva } = await reservaConfirmada();
  servidor.gateway.falharProximas('reembolsar', 1, 'Asaas fora do ar');
  const falha = await contas.hospede.post(`/api/reservas/${reserva.id}/cancelar`);
  assert.equal(falha.status, 502);
  assert.equal(falha.corpo.erro.mensagem, 'Asaas fora do ar');
  assert.equal(statusReserva(reserva.id), 'confirmada');
  assert.equal(servidor.db.prepare('SELECT hospedagem_reembolsada FROM reservas WHERE id = ?').get(reserva.id).hospedagem_reembolsada, 0);

  assert.equal((await contas.hospede.post(`/api/reservas/${reserva.id}/cancelar`)).status, 200);
});

test('reserva de outro hóspede → 404 em pagar, consultar, prévia e cancelar; anfitrião → 403', async () => {
  const { reserva } = await reservaConfirmada();
  const intruso = await entrarComo('hospede');
  await intruso.put('/api/auth/eu/documento', { cpf_cnpj: CPF_HOSPEDE });
  assert.equal((await intruso.post(`/api/reservas/${reserva.id}/pagamento`, { metodo: 'pix' })).status, 404);
  assert.equal((await intruso.get(`/api/reservas/${reserva.id}/pagamento`)).status, 404);
  assert.equal((await intruso.get(`/api/reservas/${reserva.id}/cancelamento`)).status, 404);
  assert.equal((await intruso.post(`/api/reservas/${reserva.id}/cancelar`)).status, 404);
  assert.equal((await contas.anfitriao.post(`/api/reservas/${reserva.id}/cancelar`)).status, 403);
  assert.equal(statusReserva(reserva.id), 'confirmada');
});

test('RN13: recebedor sem subconta aprovada some da busca; aprovação por webhook o traz de volta', async () => {
  const anfitriao = await entrarComo('anfitriao', 'Bia Rocha');
  const casa = criarImovel(servidor.db, anfitriao.id, { titulo: 'Casa do Lago', cidade: 'Paraty' });
  const naBusca = async () => (await contas.hospede.get('/api/imoveis?cidade=Paraty')).corpo.imoveis.map((imovel) => imovel.id);
  assert.deepEqual(await naBusca(), [], 'sem cadastro de recebimento');

  servidor.gateway.aprovacaoAutomatica = false;
  const dados = {
    cpf_cnpj: '529.982.247-25', data_nascimento: '1985-04-12', telefone_celular: '21999990000', renda_mensal: '15000',
    cep: '23970000', endereco: 'Rua do Comércio', numero: '5', bairro: 'Centro',
  };
  assert.equal((await anfitriao.post('/api/recebimento/cadastro', { ...dados, cep: '1' })).status, 400);
  const cadastro = await anfitriao.post('/api/recebimento/cadastro', dados);
  assert.equal(cadastro.status, 201);
  assert.deepEqual(cadastro.corpo.recebimento, { situacao: 'em_analise', recebimento_ativo: false, cpf_cnpj: '***.982.247-**' });
  assert.equal((await anfitriao.post('/api/recebimento/cadastro', dados)).status, 409, 'uma subconta só');
  assert.equal(JSON.stringify(cadastro.corpo).includes('aact'), false, 'a apiKey da subconta nunca sai pela API');

  const gravado = servidor.db.prepare('SELECT asaas_conta_id, conta_pagamento_id, asaas_chave_api_cifrada FROM usuarios WHERE id = ?').get(anfitriao.id);
  assert.ok(gravado.conta_pagamento_id, 'walletId guardado para os repasses');
  assert.ok(gravado.asaas_chave_api_cifrada.startsWith('v1.') && !gravado.asaas_chave_api_cifrada.includes('aact'), 'apiKey cifrada');
  assert.deepEqual(await naBusca(), [], 'em análise ainda não aparece');
  assert.equal((await anfitriao.get('/api/recebimento/situacao')).corpo.recebimento.situacao, 'em_analise');

  const aprovacao = servidor.gateway.eventoSituacaoConta(gravado.asaas_conta_id, 'aprovado');
  assert.equal((await contas.hospede.webhook(aprovacao)).corpo.resultado, 'conta_atualizada');
  assert.deepEqual(await naBusca(), [casa]);
  assert.equal((await anfitriao.get('/api/recebimento/situacao')).corpo.recebimento.situacao, 'aprovado');

  // Reprovada depois: some de novo
  await contas.hospede.webhook(servidor.gateway.eventoSituacaoConta(gravado.asaas_conta_id, 'recusado'));
  assert.deepEqual(await naBusca(), []);
  assert.equal((await contas.hospede.post('/api/recebimento/cadastro', dados)).status, 403, 'hóspede não cadastra recebimento');
});

test('situação consultada no gateway quando o webhook não chega (sandbox aprova sozinho)', async () => {
  const prestador = await entrarComo('prestador');
  await prestador.post('/api/recebimento/cadastro', {
    cpf_cnpj: '11.222.333/0001-81', tipo_empresa: 'mei', telefone_celular: '21999990000', renda_mensal: '8000',
    cep: '28950000', endereco: 'Rua A', numero: 'S/N', bairro: 'Centro',
  });
  assert.equal((await prestador.get('/api/recebimento/situacao')).corpo.recebimento.situacao, 'aprovado');
  assert.equal(servidor.db.prepare('SELECT recebimento_ativo FROM usuarios WHERE id = ?').get(prestador.id).recebimento_ativo, 1);
});

test('desenvolvimento: "Simular pagamento" passa pelo mesmo caminho do webhook', async () => {
  const reserva = await reservar();
  await iniciarPagamento(reserva.id);
  const resposta = await contas.hospede.post(`/api/dev/reservas/${reserva.id}/simular-pagamento`);
  assert.equal(resposta.status, 200);
  assert.equal(resposta.corpo.resultado, 'confirmada');
  assert.equal(statusReserva(reserva.id), 'confirmada');
});
