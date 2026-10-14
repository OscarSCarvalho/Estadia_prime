const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  hojeEmBrasilia,
  ehDataValida,
  calcularNoites,
  validarPeriodo,
  periodosSeSobrepoem,
  dataDentroDaEstadia,
} = require('../../src/dominio/periodo');
const { ErroPeriodoInvalido } = require('../../src/dominio/erros');

const hoje = '2026-10-12';

function mensagemDoErro(periodo) {
  try {
    validarPeriodo({ hoje, ...periodo });
  } catch (erro) {
    assert.ok(erro instanceof ErroPeriodoInvalido);
    return erro.message;
  }
  assert.fail('deveria ter recusado o período');
}

test('CB13: "hoje" é o dia de Brasília, não o do servidor em UTC', () => {
  // 02:00 UTC de 13/10 ainda é 23:00 de 12/10 em Brasília
  assert.equal(hojeEmBrasilia(new Date('2026-10-13T02:00:00Z')), '2026-10-12');
  assert.equal(hojeEmBrasilia(new Date('2026-10-13T03:00:00Z')), '2026-10-13');
});

test('aceita só datas reais no formato AAAA-MM-DD', () => {
  assert.equal(ehDataValida('2026-12-20'), true);
  assert.equal(ehDataValida('2028-02-29'), true);
  for (const invalida of ['2026-02-30', '2027-02-29', '20/12/2026', '2026-1-5', '', null, 20261220]) {
    assert.equal(ehDataValida(invalida), false, `deveria recusar ${invalida}`);
  }
});

test('RN01: noites = checkout - checkin, inclusive na virada de mês e de ano', () => {
  assert.equal(calcularNoites('2026-12-20', '2026-12-23'), 3);
  assert.equal(calcularNoites('2026-12-30', '2027-01-02'), 3);
  assert.equal(calcularNoites('2027-02-27', '2027-03-01'), 2);
});

test('RN15 e CB12: check-in hoje é permitido, no passado não', () => {
  assert.deepEqual(validarPeriodo({ checkin: hoje, checkout: '2026-10-13', hoje }), {
    checkin: hoje,
    checkout: '2026-10-13',
    noites: 1,
  });
  assert.match(mensagemDoErro({ checkin: '2026-10-11', checkout: '2026-10-13' }), /passado/);
});

test('RN15: mínimo de 1 e máximo de 30 noites', () => {
  assert.match(mensagemDoErro({ checkin: '2026-12-20', checkout: '2026-12-20' }), /depois do check-in/);
  assert.match(mensagemDoErro({ checkin: '2026-12-20', checkout: '2026-12-19' }), /depois do check-in/);
  assert.equal(validarPeriodo({ hoje, checkin: '2026-12-01', checkout: '2026-12-31' }).noites, 30);
  assert.match(mensagemDoErro({ checkin: '2026-12-01', checkout: '2027-01-01' }), /30 noites/);
});

test('recusa datas mal formatadas', () => {
  assert.match(mensagemDoErro({ checkin: '20/12/2026', checkout: '2026-12-23' }), /AAAA-MM-DD/);
  assert.match(mensagemDoErro({ checkin: '2026-12-20' }), /AAAA-MM-DD/);
});

test('RN04: períodos que se sobrepõem; checkout pode ser o checkin de outra reserva', () => {
  const reserva = { checkin: '2026-12-20', checkout: '2026-12-23' };
  assert.equal(periodosSeSobrepoem(reserva, { checkin: '2026-12-21', checkout: '2026-12-24' }), true);
  assert.equal(periodosSeSobrepoem(reserva, { checkin: '2026-12-18', checkout: '2026-12-21' }), true);
  assert.equal(periodosSeSobrepoem(reserva, { checkin: '2026-12-15', checkout: '2026-12-30' }), true);
  assert.equal(periodosSeSobrepoem(reserva, { checkin: '2026-12-23', checkout: '2026-12-26' }), false);
  assert.equal(periodosSeSobrepoem(reserva, { checkin: '2026-12-17', checkout: '2026-12-20' }), false);
});

test('RN05: serviço pode ser do check-in ao check-out, inclusive', () => {
  const estadia = { checkin: '2026-12-20', checkout: '2026-12-23' };
  assert.equal(dataDentroDaEstadia('2026-12-20', estadia), true);
  assert.equal(dataDentroDaEstadia('2026-12-23', estadia), true);
  assert.equal(dataDentroDaEstadia('2026-12-25', estadia), false);
  assert.equal(dataDentroDaEstadia('2026-12-19', estadia), false);
});
