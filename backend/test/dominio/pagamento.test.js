// Etapa 4b: regras puras de documento, recebimento, pagamento e repasse (sem banco, sem gateway)
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { cpfValido, cnpjValido, normalizarCpfCnpj, exigirCpfCnpj, mascararCpfCnpj } = require('../../src/dominio/documento');
const { validarDadosRecebimento } = require('../../src/dominio/recebimento');
const {
  validarMetodoPagamento,
  exigirReservaPagavel,
  divergenciaDoPagamento,
  decidirPagamentoAprovado,
  taxaDoGateway,
} = require('../../src/dominio/pagamento');
const { calcularRepasses, momentoDoRepasse, repasseLiberado } = require('../../src/dominio/repasse');
const { calcularReserva } = require('../../src/dominio/precificacao');
const { ErroDadosInvalidos, ErroReservaNaoPagavel } = require('../../src/dominio/erros');

describe('CPF e CNPJ', () => {
  test('confere o dígito verificador', () => {
    assert.ok(cpfValido('52998224725'));
    assert.equal(cpfValido('52998224724'), false);
    assert.equal(cpfValido('11111111111'), false, 'todos iguais passam na conta, mas não existem');
    assert.ok(cnpjValido('11222333000181'));
    assert.equal(cnpjValido('11222333000182'), false);
    assert.equal(cnpjValido('00000000000000'), false);
  });

  test('aceita com pontuação e grava só os dígitos', () => {
    assert.equal(normalizarCpfCnpj('529.982.247-25'), '52998224725');
    assert.equal(normalizarCpfCnpj('11.222.333/0001-81'), '11222333000181');
    assert.equal(normalizarCpfCnpj('529.982.247-2'), null);
    assert.equal(normalizarCpfCnpj(52998224725), null, 'número perde zeros à esquerda: só texto');
    assert.throws(() => exigirCpfCnpj('123'), ErroDadosInvalidos);
  });

  test('a tela mostra o documento mascarado', () => {
    assert.equal(mascararCpfCnpj('52998224725'), '***.982.247-**');
    assert.equal(mascararCpfCnpj('11222333000181'), '**.222.333/0001-**');
    assert.equal(mascararCpfCnpj(null), null);
  });
});

describe('cadastro de recebimento (subconta Asaas)', () => {
  const pessoaFisica = {
    cpf_cnpj: '529.982.247-25',
    data_nascimento: '1985-04-12',
    telefone_celular: '(21) 99999-0000',
    renda_mensal: '15.000,00',
    cep: '28950-000',
    endereco: 'Rua das Ondas',
    numero: '10',
    bairro: 'Geribá',
  };

  test('pessoa física: normaliza tudo e converte a renda para centavos', () => {
    const dados = validarDadosRecebimento(pessoaFisica, { hoje: '2026-10-19' });
    assert.deepEqual(dados, {
      cpfCnpj: '52998224725',
      dataNascimento: '1985-04-12',
      tipoEmpresa: null,
      telefoneCelular: '21999990000',
      rendaMensal: 1500000,
      cep: '28950000',
      endereco: 'Rua das Ondas',
      numero: '10',
      complemento: null,
      bairro: 'Geribá',
    });
  });

  test('empresa: exige o tipo de empresa e dispensa a data de nascimento', () => {
    const empresa = { ...pessoaFisica, cpf_cnpj: '11.222.333/0001-81', data_nascimento: undefined };
    assert.throws(() => validarDadosRecebimento(empresa, { hoje: '2026-10-19' }), (erro) => 'tipo_empresa' in erro.detalhes);
    const dados = validarDadosRecebimento({ ...empresa, tipo_empresa: 'limitada' }, { hoje: '2026-10-19' });
    assert.equal(dados.tipoEmpresa, 'limitada');
    assert.equal(dados.dataNascimento, null);
  });

  test('menor de idade, celular sem DDD e CEP curto são recusados', () => {
    assert.throws(
      () => validarDadosRecebimento({ ...pessoaFisica, data_nascimento: '2010-10-20', telefone_celular: '99999-0000', cep: '2895' }, { hoje: '2026-10-19' }),
      (erro) => erro instanceof ErroDadosInvalidos && ['data_nascimento', 'telefone_celular', 'cep'].every((campo) => campo in erro.detalhes),
    );
    // Faz 18 anos exatamente hoje: pode
    assert.ok(validarDadosRecebimento({ ...pessoaFisica, data_nascimento: '2008-10-19' }, { hoje: '2026-10-19' }));
  });
});

describe('pagamento', () => {
  const agora = new Date('2099-12-01T12:00:00Z');
  const pendente = { status: 'pendente', data_reserva: '2099-12-01 11:50:00' };
  const vencida = { status: 'pendente', data_reserva: '2099-12-01 11:00:00' };

  test('só Pix ou cartão', () => {
    assert.equal(validarMetodoPagamento('pix'), 'pix');
    assert.equal(validarMetodoPagamento('cartao'), 'cartao');
    assert.throws(() => validarMetodoPagamento('boleto'), ErroDadosInvalidos);
  });

  test('RN07: só se paga reserva pendente dentro dos 30 minutos', () => {
    assert.doesNotThrow(() => exigirReservaPagavel(pendente, agora));
    assert.throws(() => exigirReservaPagavel(vencida, agora), ErroReservaNaoPagavel);
    assert.throws(() => exigirReservaPagavel({ ...pendente, status: 'confirmada' }, agora), ErroReservaNaoPagavel);
  });

  test('RN08: o webhook precisa trazer a referência e o valor gravados', () => {
    const pagamento = { reserva_id: 7, valor_total: 910000 };
    assert.equal(divergenciaDoPagamento(pagamento, { referencia: '7', valor: 910000 }), null);
    assert.equal(divergenciaDoPagamento(pagamento, { referencia: '7', valor: 100 }), 'valor_divergente');
    assert.equal(divergenciaDoPagamento(pagamento, { referencia: '8', valor: 910000 }), 'referencia_divergente');
  });

  test('CB03: pagamento aprovado depois da expiração reativa se as datas estão livres; senão reembolsa', () => {
    const aberto = { status: 'pendente' };
    const decidir = (reserva, extra = {}) =>
      decidirPagamentoAprovado({ reserva, pagamento: aberto, outroPagamentoAprovado: false, datasLivres: true, agora, ...extra });
    assert.equal(decidir(pendente), 'confirmar');
    assert.equal(decidir(vencida), 'reativar');
    assert.equal(decidir({ ...vencida, status: 'cancelada' }), 'reativar');
    assert.equal(decidir(vencida, { datasLivres: false }), 'reembolsar');
    assert.equal(decidir(pendente, { outroPagamentoAprovado: true }), 'reembolsar', 'cobrança paga duas vezes');
    assert.equal(decidir(pendente, { pagamento: { status: 'aprovado' } }), 'ja_processado');
    assert.equal(decidir(pendente, { pagamento: { status: 'reembolsado' } }), 'ja_processado');
  });

  test('taxa do gateway = valor − líquido', () => {
    assert.equal(taxaDoGateway(910000, 909801), 199);
    assert.equal(taxaDoGateway(910000, null), null);
  });
});

describe('repasses (RN09)', () => {
  // SPEC "Repasse (split)": Villa R$ 2.500 × 3 noites + mordomo R$ 800 × 2
  const valores = calcularReserva({
    precoDiaria: 250000,
    noites: 3,
    itens: [{ servicoId: 1, precoUnitario: 80000, quantidade: 2 }],
    comissaoHospedagemPct: 12,
    comissaoServicoPct: 15,
  });
  const reserva = { valor_hospedagem: valores.valorHospedagem, valor_comissao: valores.valorComissao, hospedagem_reembolsada: 0 };
  const itens = valores.itens.map((item) => ({ prestador_id: 20, subtotal: item.subtotal, valor_comissao: item.valorComissao, reembolsado: 0 }));

  test('SPEC: anfitrião R$ 6.600, mordomo R$ 1.360 e a plataforma fica com R$ 1.140', () => {
    const repasses = calcularRepasses({ reserva, anfitriaoId: 10, itens });
    assert.deepEqual(repasses, [
      { usuarioId: 10, tipo: 'anfitriao', valor: 660000 },
      { usuarioId: 20, tipo: 'prestador', valor: 136000 },
    ]);
    const somaRepasses = repasses.reduce((soma, repasse) => soma + repasse.valor, 0);
    assert.equal(somaRepasses + reserva.valor_comissao, valores.valorTotal, 'repasses + comissão = total');
  });

  test('a soma dos repasses + comissão fecha no centavo com inclusos e vários prestadores (valores ímpares)', () => {
    const calculado = calcularReserva({
      precoDiaria: 123457,
      noites: 3,
      itens: [
        { servicoId: 1, precoUnitario: 33333, quantidade: 3, prestadorId: 20 },
        { servicoId: 2, precoUnitario: 9999, quantidade: 1, prestadorId: 21 },
        { servicoId: 3, precoUnitario: 10001, quantidade: 2, prestadorId: 20 },
      ],
      inclusos: [{ precoUnitario: 15001, quantidade: 3 }, { precoUnitario: 7777, quantidade: 6 }],
      comissaoHospedagemPct: 12,
      comissaoServicoPct: 15,
    });
    const repasses = calcularRepasses({
      reserva: { valor_hospedagem: calculado.valorHospedagem, valor_comissao: calculado.valorComissao, hospedagem_reembolsada: 0 },
      anfitriaoId: 10,
      itens: calculado.itens.map((item) => ({ prestador_id: item.prestadorId, subtotal: item.subtotal, valor_comissao: item.valorComissao, reembolsado: 0 })),
      inclusos: calculado.inclusos.map((incluso) => ({ subtotal: incluso.subtotal, valor_comissao: incluso.valorComissao, reembolsado: 0 })),
    });
    assert.equal(repasses.length, 3, 'anfitrião + 2 prestadores (o 20 recebe os dois itens numa transferência só)');
    assert.equal(repasses[0].valor, calculado.repasseAnfitriao, 'mesmo valor mostrado ao anfitrião na reserva');
    assert.equal(repasses.reduce((soma, repasse) => soma + repasse.valor, 0) + calculado.valorComissao, calculado.valorTotal);
  });

  test('o que foi reembolsado no cancelamento não é repassado', () => {
    const cancelada = calcularRepasses({
      reserva,
      anfitriaoId: 10,
      itens: itens.map((item) => ({ ...item, reembolsado: 1 })),
    });
    assert.deepEqual(cancelada, [{ usuarioId: 10, tipo: 'anfitriao', valor: 660000 }], 'RN10 com menos de 7 dias: hospedagem fica');
    assert.deepEqual(
      calcularRepasses({ reserva: { ...reserva, hospedagem_reembolsada: 1 }, anfitriaoId: 10, itens: itens.map((item) => ({ ...item, reembolsado: 1 })) }),
      [],
      'reembolso integral: nada a repassar',
    );
  });

  test('libera 24h depois do check-in (15h de Brasília)', () => {
    assert.equal(momentoDoRepasse('2099-12-20').toISOString(), '2099-12-21T18:00:00.000Z');
    assert.equal(repasseLiberado({ data_checkin: '2099-12-20' }, new Date('2099-12-21T17:59:59Z')), false);
    assert.equal(repasseLiberado({ data_checkin: '2099-12-20' }, new Date('2099-12-21T18:00:00Z')), true);
  });
});
