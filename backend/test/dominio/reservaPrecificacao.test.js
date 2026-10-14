const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { calcularReserva, dividirValor } = require('../../src/dominio/precificacao');
const {
  podeMudarStatus,
  exigirTransicao,
  estaExpirada,
  estaAtiva,
  statusExibido,
  validarPedidoReserva,
} = require('../../src/dominio/reserva');
const { calcularReembolso } = require('../../src/dominio/cancelamento');
const { ErroDadosInvalidos, ErroPeriodoInvalido, ErroTransicaoStatusInvalida } = require('../../src/dominio/erros');

describe('precificação (RN01–RN03, CB10)', () => {
  test('exemplo do SPEC: 3 noites de R$ 2.500 + mordomo R$ 800 × 2', () => {
    const valores = calcularReserva({
      precoDiaria: 250000,
      noites: 3,
      itens: [{ servicoId: 1, precoUnitario: 80000, quantidade: 2 }],
      comissaoHospedagemPct: 12,
      comissaoServicoPct: 15,
    });
    assert.equal(valores.valorHospedagem, 750000);
    assert.equal(valores.valorServicos, 160000);
    assert.equal(valores.valorTotal, 910000);
    assert.equal(valores.valorComissao, 114000);
    assert.equal(valores.repasseAnfitriao, 660000);
    assert.equal(valores.itens[0].repasse, 136000);
    assert.equal(valores.itens[0].servicoId, 1, 'campos extras do item são mantidos');
  });

  test('centavos ímpares: repasse arredondado para baixo, a sobra fica com a plataforma e a soma fecha', () => {
    for (const valor of [1, 333, 999, 12_345, 100_001]) {
      for (const pct of [0, 12, 15, 100]) {
        const { comissao, repasse } = dividirValor(valor, pct);
        assert.equal(comissao + repasse, valor);
        assert.ok(Number.isInteger(comissao) && Number.isInteger(repasse));
        assert.ok(repasse <= (valor * (100 - pct)) / 100);
      }
    }
    assert.deepEqual(dividirValor(333, 12), { comissao: 40, repasse: 293 });
  });

  test('sem serviços: total é só a hospedagem', () => {
    const valores = calcularReserva({ precoDiaria: 95000, noites: 2, comissaoHospedagemPct: 12, comissaoServicoPct: 15 });
    assert.equal(valores.valorTotal, 190000);
    assert.equal(valores.valorServicos, 0);
    assert.equal(valores.valorComissao, 22800);
  });
});

describe('status da reserva (RN07, RN08, CB04)', () => {
  const criadaEm = '2026-10-12 12:00:00';
  const minutosDepois = (minutos) => new Date(Date.parse('2026-10-12T12:00:00Z') + minutos * 60_000);

  test('só as transições previstas são aceitas', () => {
    assert.ok(podeMudarStatus('pendente', 'confirmada'));
    assert.ok(podeMudarStatus('pendente', 'cancelada'));
    assert.ok(podeMudarStatus('confirmada', 'concluida'));
    assert.equal(podeMudarStatus('cancelada', 'confirmada'), false);
    assert.equal(podeMudarStatus('concluida', 'cancelada'), false);
    assert.equal(podeMudarStatus('pendente', 'concluida'), false);
    assert.throws(() => exigirTransicao('cancelada', 'confirmada'), ErroTransicaoStatusInvalida);
  });

  test('pendente expira em 30 minutos; confirmada nunca expira', () => {
    const pendente = { status: 'pendente', data_reserva: criadaEm };
    assert.equal(estaExpirada(pendente, minutosDepois(29)), false);
    assert.equal(estaAtiva(pendente, minutosDepois(29)), true);
    assert.equal(estaExpirada(pendente, minutosDepois(30)), true);
    assert.equal(statusExibido(pendente, minutosDepois(31)), 'expirada');

    const confirmada = { status: 'confirmada', data_reserva: criadaEm };
    assert.equal(estaAtiva(confirmada, minutosDepois(600)), true);
    assert.equal(statusExibido(confirmada, minutosDepois(600)), 'confirmada');
    assert.equal(estaAtiva({ status: 'cancelada', data_reserva: criadaEm }, minutosDepois(1)), false);
  });
});

describe('pedido de reserva vindo do navegador', () => {
  const hoje = '2026-10-12';
  const base = { imovel_id: 1, checkin: '2026-12-20', checkout: '2026-12-23', num_hospedes: 6 };

  test('junta o mesmo serviço no mesmo dia e ignora qualquer preço enviado', () => {
    const pedido = validarPedidoReserva(
      {
        ...base,
        valor_total: 1,
        servicos: [
          { servico_id: 7, data_servico: '2026-12-21', quantidade: 1, preco: 1 },
          { servico_id: 7, data_servico: '2026-12-21', quantidade: 2 },
          { servico_id: 7, data_servico: '2026-12-22', quantidade: 1 },
        ],
      },
      { hoje },
    );
    assert.deepEqual(pedido, {
      imovelId: 1,
      numHospedes: 6,
      checkin: '2026-12-20',
      checkout: '2026-12-23',
      noites: 3,
      itens: [
        { servicoId: 7, data: '2026-12-21', quantidade: 3 },
        { servicoId: 7, data: '2026-12-22', quantidade: 1 },
      ],
    });
  });

  test('sem serviços é válido; quantidade acima de 10 (somada) ou dados quebrados não', () => {
    assert.deepEqual(validarPedidoReserva(base, { hoje }).itens, []);
    const onze = [
      { servico_id: 7, data_servico: '2026-12-21', quantidade: 6 },
      { servico_id: 7, data_servico: '2026-12-21', quantidade: 5 },
    ];
    assert.throws(() => validarPedidoReserva({ ...base, servicos: onze }, { hoje }), ErroDadosInvalidos);
    assert.throws(() => validarPedidoReserva({ ...base, servicos: [{ servico_id: 'x' }] }, { hoje }), ErroDadosInvalidos);
    assert.throws(() => validarPedidoReserva({ ...base, servicos: 'tudo' }, { hoje }), ErroDadosInvalidos);
    assert.throws(() => validarPedidoReserva({ ...base, num_hospedes: 0 }, { hoje }), ErroDadosInvalidos);
    assert.throws(() => validarPedidoReserva({ ...base, imovel_id: undefined }, { hoje }), ErroDadosInvalidos);
  });

  test('RN15: check-in no passado ou mais de 30 noites → período inválido', () => {
    assert.throws(() => validarPedidoReserva({ ...base, checkin: '2026-10-11' }, { hoje }), ErroPeriodoInvalido);
    assert.throws(() => validarPedidoReserva({ ...base, checkout: '2027-01-30' }, { hoje }), ErroPeriodoInvalido);
  });
});

describe('cancelamento (RN10)', () => {
  // 12/10/2026 às 10h em Brasília
  const agora = new Date('2026-10-12T10:00:00-03:00');
  const reserva = (checkin) => ({ data_checkin: checkin, valor_hospedagem: 750000 });
  const item = (id, data) => ({ id, data_servico: data, subtotal: 160000 });

  test('reserva que começa daqui a 10 dias: reembolso integral', () => {
    const reembolso = calcularReembolso({ reserva: reserva('2026-10-22'), itens: [item(1, '2026-10-23')], agora });
    assert.equal(reembolso.integral, true);
    assert.equal(reembolso.valorTotal, 910000);
  });

  test('começa daqui a 3 dias, serviço daqui a 4: só o serviço volta', () => {
    const reembolso = calcularReembolso({ reserva: reserva('2026-10-15'), itens: [item(1, '2026-10-16')], agora });
    assert.equal(reembolso.integral, false);
    assert.equal(reembolso.valorHospedagem, 0);
    assert.equal(reembolso.valorServicos, 160000);
    assert.deepEqual(reembolso.itens, [{ id: 1, reembolsado: true }]);
  });

  test('serviço a menos de 48h não volta; exatamente 7 dias antes ainda é integral', () => {
    // 14/10 00h fica a 38h de agora
    const pertoDemais = calcularReembolso({ reserva: reserva('2026-10-14'), itens: [item(1, '2026-10-14')], agora });
    assert.equal(pertoDemais.valorTotal, 0);

    const seteDias = calcularReembolso({ reserva: reserva('2026-10-19'), itens: [], agora: new Date('2026-10-12T00:00:00-03:00') });
    assert.equal(seteDias.integral, true);
  });
});
