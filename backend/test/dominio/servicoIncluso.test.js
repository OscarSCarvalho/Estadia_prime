// RN17–RN21: serviços inclusos do anfitrião, sem banco
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validarServicoIncluso, validarStatusIncluso, quantidadeDoIncluso } = require('../../src/dominio/servicoIncluso');
const { calcularReserva } = require('../../src/dominio/precificacao');
const { calcularReembolso } = require('../../src/dominio/cancelamento');
const { validarPedidoReserva } = require('../../src/dominio/reserva');
const { validarFiltrosBusca } = require('../../src/dominio/busca');
const { TIPOS_IMOVEL } = require('../../src/dominio/imovel');
const { ErroDadosInvalidos } = require('../../src/dominio/erros');

function camposComErro(funcao) {
  try {
    funcao();
  } catch (erro) {
    assert.ok(erro instanceof ErroDadosInvalidos);
    return Object.keys(erro.detalhes).sort();
  }
  assert.fail('deveria ter recusado');
}

describe('cadastro do serviço incluso (RN17)', () => {
  test('aceita nome, descrição opcional, preço em reais e unidade; devolve centavos', () => {
    assert.deepEqual(validarServicoIncluso({ nome: '  Café   da manhã ', preco: '85,50', unidade_preco: 'hospede' }), {
      nome: 'Café da manhã',
      descricao: null,
      preco: 8550,
      unidade_preco: 'hospede',
    });
    assert.equal(validarServicoIncluso({ nome: 'Lenha', descricao: 'Fardo de eucalipto', preco: 120, unidade_preco: 'estadia' }).descricao, 'Fardo de eucalipto');
  });

  test('limites: nome 3–60, descrição até 300, preço > 0, unidade da lista', () => {
    assert.deepEqual(camposComErro(() => validarServicoIncluso({ nome: 'ab', preco: 0, unidade_preco: 'diaria' })), ['nome', 'preco', 'unidade_preco']);
    assert.deepEqual(camposComErro(() => validarServicoIncluso({ nome: 'x'.repeat(61), descricao: 'y'.repeat(301), preco: '10', unidade_preco: 'noite' })), [
      'descricao',
      'nome',
    ]);
    assert.deepEqual(camposComErro(() => validarServicoIncluso({ nome: 'Caseiro', preco: -5, unidade_preco: 'noite' })), ['preco']);
    assert.equal(validarServicoIncluso({ nome: 'abc', descricao: 'y'.repeat(300), preco: '0,01', unidade_preco: 'noite' }).preco, 1);
  });

  test('status só ativo ou inativo', () => {
    assert.equal(validarStatusIncluso('inativo'), 'inativo');
    assert.throws(() => validarStatusIncluso('apagado'), ErroDadosInvalidos);
  });

  test('quantidade pela unidade: estadia = 1, noite = noites, hospede = nº de hóspedes', () => {
    const estadia = { noites: 3, numHospedes: 6 };
    assert.equal(quantidadeDoIncluso('estadia', estadia), 1);
    assert.equal(quantidadeDoIncluso('noite', estadia), 3);
    assert.equal(quantidadeDoIncluso('hospede', estadia), 6);
    assert.throws(() => quantidadeDoIncluso('hora', estadia), ErroDadosInvalidos);
  });

  test('"sitio" é um tipo de imóvel aceito', () => {
    assert.ok(TIPOS_IMOVEL.includes('sitio'));
  });
});

describe('precificação com inclusos (RN19)', () => {
  const comissoes = { comissaoHospedagemPct: 12, comissaoServicoPct: 15 };

  test('3 noites de R$ 2.500 + caseiro R$ 150/noite + café R$ 80/hóspede (6) + mordomo R$ 800 × 2', () => {
    const valores = calcularReserva({
      precoDiaria: 250000,
      noites: 3,
      inclusos: [
        { inclusoId: 1, precoUnitario: 15000, quantidade: 3 },
        { inclusoId: 2, precoUnitario: 8000, quantidade: 6 },
      ],
      itens: [{ servicoId: 9, precoUnitario: 80000, quantidade: 2 }],
      ...comissoes,
    });
    assert.equal(valores.valorHospedagem, 750000);
    assert.equal(valores.valorInclusos, 93000);
    assert.equal(valores.valorServicosPremium, 160000);
    assert.equal(valores.valorServicos, 253000, 'reservas.valor_servicos = inclusos + premium');
    assert.equal(valores.valorTotal, 1003000);
    // 12% de 7.500 + 12% de 930 + 15% de 1.600
    assert.equal(valores.valorComissao, 90000 + 11160 + 24000);
    assert.equal(valores.repasseAnfitriao, 660000 + 81840, 'o anfitrião recebe hospedagem + inclusos');
    assert.deepEqual(
      valores.inclusos.map(({ inclusoId, subtotal, valorComissao, repasse }) => ({ inclusoId, subtotal, valorComissao, repasse })),
      [
        { inclusoId: 1, subtotal: 45000, valorComissao: 5400, repasse: 39600 },
        { inclusoId: 2, subtotal: 48000, valorComissao: 5760, repasse: 42240 },
      ],
    );
  });

  test('sem inclusos o resultado é o de antes (exemplo do SPEC)', () => {
    const valores = calcularReserva({ precoDiaria: 250000, noites: 3, itens: [{ precoUnitario: 80000, quantidade: 2 }], ...comissoes });
    assert.equal(valores.valorInclusos, 0);
    assert.deepEqual(valores.inclusos, []);
    assert.equal(valores.valorTotal, 910000);
    assert.equal(valores.valorComissao, 114000);
    assert.equal(valores.repasseAnfitriao, 660000);
  });

  test('centavos ímpares: cada incluso arredonda o repasse para baixo e a soma sempre fecha no centavo', () => {
    for (const preco of [1, 333, 999, 12_345]) {
      for (const quantidade of [1, 3, 7]) {
        const valores = calcularReserva({
          precoDiaria: 33_333,
          noites: 3,
          inclusos: [{ precoUnitario: preco, quantidade }, { precoUnitario: preco + 1, quantidade: 1 }],
          itens: [{ precoUnitario: preco, quantidade }],
          ...comissoes,
        });
        const repassePrestadores = valores.itens.reduce((soma, item) => soma + item.repasse, 0);
        assert.equal(valores.valorComissao + valores.repasseAnfitriao + repassePrestadores, valores.valorTotal);
        for (const incluso of valores.inclusos) {
          assert.equal(incluso.valorComissao + incluso.repasse, incluso.subtotal);
          assert.ok(incluso.repasse <= (incluso.subtotal * 88) / 100);
        }
      }
    }
    const [incluso] = calcularReserva({ precoDiaria: 100, noites: 1, inclusos: [{ precoUnitario: 333, quantidade: 1 }], ...comissoes }).inclusos;
    assert.deepEqual({ comissao: incluso.valorComissao, repasse: incluso.repasse }, { comissao: 40, repasse: 293 });
  });
});

describe('cancelamento com inclusos (RN20)', () => {
  const agora = new Date('2026-10-12T10:00:00-03:00');
  const reserva = (checkin) => ({ data_checkin: checkin, valor_hospedagem: 750000 });
  const inclusos = [{ id: 1, subtotal: 45000 }, { id: 2, subtotal: 48000 }];

  test('até 7 dias antes: hospedagem, inclusos e serviços voltam', () => {
    const reembolso = calcularReembolso({ reserva: reserva('2026-10-22'), itens: [{ id: 5, data_servico: '2026-10-23', subtotal: 160000 }], inclusos, agora });
    assert.equal(reembolso.valorInclusos, 93000);
    assert.equal(reembolso.valorTotal, 750000 + 93000 + 160000);
    assert.deepEqual(reembolso.inclusos, [{ id: 1, reembolsado: true }, { id: 2, reembolsado: true }]);
  });

  test('menos de 7 dias: inclusos seguem a hospedagem e não voltam, mesmo com o serviço premium voltando', () => {
    const reembolso = calcularReembolso({ reserva: reserva('2026-10-15'), itens: [{ id: 5, data_servico: '2026-10-16', subtotal: 160000 }], inclusos, agora });
    assert.equal(reembolso.integral, false);
    assert.equal(reembolso.valorHospedagem, 0);
    assert.equal(reembolso.valorInclusos, 0);
    assert.equal(reembolso.valorServicos, 160000);
    assert.deepEqual(reembolso.inclusos, [{ id: 1, reembolsado: false }, { id: 2, reembolsado: false }]);
  });

  test('sem a lista de inclusos o cálculo continua como antes', () => {
    const reembolso = calcularReembolso({ reserva: reserva('2026-10-22'), itens: [], agora });
    assert.deepEqual(reembolso.inclusos, []);
    assert.equal(reembolso.valorTotal, 750000);
  });
});

describe('pedido de reserva com inclusos (RN18)', () => {
  const base = { imovel_id: 1, checkin: '2026-12-20', checkout: '2026-12-23', num_hospedes: 6 };
  const hoje = '2026-10-12';

  test('lista de ids mantidos, sem repetição; sem a lista = nenhum incluso', () => {
    assert.deepEqual(validarPedidoReserva({ ...base, inclusos: [3, '4', 3] }, { hoje }).inclusos, [3, 4]);
    assert.deepEqual(validarPedidoReserva(base, { hoje }).inclusos, []);
    assert.deepEqual(validarPedidoReserva({ ...base, inclusos: [] }, { hoje }).inclusos, []);
  });

  test('lista quebrada ou grande demais → dados inválidos', () => {
    assert.deepEqual(camposComErro(() => validarPedidoReserva({ ...base, inclusos: 'todos' }, { hoje })), ['inclusos']);
    assert.deepEqual(camposComErro(() => validarPedidoReserva({ ...base, inclusos: [1, 0] }, { hoje })), ['inclusos']);
    assert.deepEqual(camposComErro(() => validarPedidoReserva({ ...base, inclusos: [{ id: 1 }] }, { hoje })), ['inclusos']);
    const dezesseis = Array.from({ length: 16 }, (_, posicao) => posicao + 1);
    assert.deepEqual(camposComErro(() => validarPedidoReserva({ ...base, inclusos: dezesseis }, { hoje })), ['inclusos']);
  });
});

describe('filtro com_inclusos da busca', () => {
  const hoje = '2026-10-12';
  test('1/true liga, vazio/0/false desliga, outro valor é recusado', () => {
    assert.equal(validarFiltrosBusca({ com_inclusos: '1' }, { hoje }).filtros.comInclusos, true);
    assert.equal(validarFiltrosBusca({ com_inclusos: 'true' }, { hoje }).filtros.comInclusos, true);
    assert.equal(validarFiltrosBusca({}, { hoje }).filtros.comInclusos, false);
    assert.equal(validarFiltrosBusca({ com_inclusos: '0' }, { hoje }).filtros.comInclusos, false);
    assert.deepEqual(camposComErro(() => validarFiltrosBusca({ com_inclusos: 'constructor' }, { hoje })), ['com_inclusos']);
    assert.equal(validarFiltrosBusca({ tipo: 'sitio' }, { hoje }).filtros.tipo, 'sitio');
  });
});
