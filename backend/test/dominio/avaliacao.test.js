const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  situacaoDaAvaliacao,
  ultimoDiaParaAvaliar,
  exigirAvaliacaoLiberada,
  exigirAlvoDaReserva,
  validarAvaliacao,
  validarPaginaAvaliacoes,
  primeiroNome,
} = require('../../src/dominio/avaliacao');
const {
  ErroDadosInvalidos,
  ErroAvaliacaoAntesDoCheckout,
  ErroReservaNaoAvaliavel,
  ErroPrazoAvaliacaoEncerrado,
  ErroAlvoForaDaReserva,
} = require('../../src/dominio/erros');

const hoje = '2026-10-13';
const reserva = (dados) => ({ status: 'concluida', data_checkout: '2026-10-12', imovel_id: 7, itens: [], ...dados });

test('RN11: o prazo vai até 14 dias depois do checkout, inclusive, atravessando o fim do mês', () => {
  assert.equal(ultimoDiaParaAvaliar('2026-10-12'), '2026-10-26');
  assert.equal(ultimoDiaParaAvaliar('2026-12-25'), '2027-01-08');
});

test('situação da avaliação conforme o status da reserva e o prazo', () => {
  assert.equal(situacaoDaAvaliacao(reserva({ status: 'confirmada' }), hoje), 'aguardando_checkout');
  assert.equal(situacaoDaAvaliacao(reserva(), hoje), 'liberada');
  assert.equal(situacaoDaAvaliacao(reserva({ data_checkout: '2026-09-29' }), hoje), 'liberada', '14 dias: último dia');
  assert.equal(situacaoDaAvaliacao(reserva({ data_checkout: '2026-09-28' }), hoje), 'encerrada', '15 dias');
  assert.equal(situacaoDaAvaliacao(reserva({ status: 'cancelada' }), hoje), null);
  assert.equal(situacaoDaAvaliacao(reserva({ status: 'pendente' }), hoje), null);
});

test('cada situação que não libera tem o seu erro', () => {
  assert.throws(() => exigirAvaliacaoLiberada(reserva({ status: 'confirmada' }), hoje), ErroAvaliacaoAntesDoCheckout);
  assert.throws(() => exigirAvaliacaoLiberada(reserva({ data_checkout: '2026-09-28' }), hoje), ErroPrazoAvaliacaoEncerrado);
  assert.throws(() => exigirAvaliacaoLiberada(reserva({ status: 'cancelada' }), hoje), ErroReservaNaoAvaliavel);
  assert.doesNotThrow(() => exigirAvaliacaoLiberada(reserva(), hoje));
});

test('só o imóvel da reserva e os serviços contratados nela podem ser avaliados', () => {
  const comMordomo = reserva({ itens: [{ servico_id: 3 }, { servico_id: 3 }] });
  assert.doesNotThrow(() => exigirAlvoDaReserva(comMordomo, { tipoAlvo: 'imovel', alvoId: 7 }));
  assert.doesNotThrow(() => exigirAlvoDaReserva(comMordomo, { tipoAlvo: 'servico', alvoId: 3 }));
  assert.throws(() => exigirAlvoDaReserva(comMordomo, { tipoAlvo: 'imovel', alvoId: 8 }), ErroAlvoForaDaReserva);
  assert.throws(() => exigirAlvoDaReserva(comMordomo, { tipoAlvo: 'servico', alvoId: 7 }), /não foi contratado/);
});

test('valida nota de 1 a 5, tipo do alvo e comentário opcional', () => {
  assert.deepEqual(validarAvaliacao({ tipo_alvo: 'imovel', alvo_id: 7, nota: '5', comentario: '  Impecável  ' }), {
    tipoAlvo: 'imovel',
    alvoId: 7,
    nota: 5,
    comentario: 'Impecável',
  });
  assert.equal(validarAvaliacao({ tipo_alvo: 'servico', alvo_id: 3, nota: 4, comentario: '   ' }).comentario, null);

  try {
    validarAvaliacao({ tipo_alvo: 'usuario', alvo_id: 0, nota: 4.5, comentario: 'x'.repeat(1001) });
    assert.fail('deveria recusar');
  } catch (erro) {
    assert.ok(erro instanceof ErroDadosInvalidos);
    assert.deepEqual(Object.keys(erro.detalhes).sort(), ['alvo_id', 'comentario', 'nota', 'tipo_alvo']);
  }
  assert.throws(() => validarAvaliacao({ tipo_alvo: 'imovel', alvo_id: 1, nota: 6 }), ErroDadosInvalidos);
  assert.throws(() => validarAvaliacao({ tipo_alvo: 'imovel', alvo_id: 1, nota: 5, comentario: 123 }), ErroDadosInvalidos);
});

test('página das avaliações e primeiro nome do autor', () => {
  assert.equal(validarPaginaAvaliacoes({}), 1);
  assert.equal(validarPaginaAvaliacoes({ pagina: '3' }), 3);
  assert.throws(() => validarPaginaAvaliacoes({ pagina: '0' }), ErroDadosInvalidos);
  assert.equal(primeiroNome('  Hugo   Lima '), 'Hugo');
  assert.equal(primeiroNome(''), 'Hóspede');
});
