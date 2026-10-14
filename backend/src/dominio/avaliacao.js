const {
  ErroDadosInvalidos,
  ErroAvaliacaoAntesDoCheckout,
  ErroReservaNaoAvaliavel,
  ErroPrazoAvaliacaoEncerrado,
  ErroAlvoForaDaReserva,
} = require('./erros');
const { textoLongo, inteiroEntre } = require('./textos');

// RN11: avaliação só em reserva concluída, pelo próprio hóspede, até 14 dias depois do checkout
const PRAZO_AVALIACAO_DIAS = 14;
const COMENTARIO_TAMANHO_MAXIMO = 1000;
const AVALIACOES_POR_PAGINA = 10;
const PAGINA_MAXIMA = 10_000;
const TIPOS_ALVO = Object.freeze(['imovel', 'servico']);
const UM_DIA_MS = 86_400_000;

function somarDias(data, dias) {
  return new Date(Date.parse(`${data}T00:00:00Z`) + dias * UM_DIA_MS).toISOString().slice(0, 10);
}

// Último dia (inclusive) em que o hóspede ainda pode avaliar
function ultimoDiaParaAvaliar(dataCheckout) {
  return somarDias(dataCheckout, PRAZO_AVALIACAO_DIAS);
}

// Situação mostrada em "Minhas reservas". null = esta reserva nunca será avaliada (cancelada, pendente, expirada)
function situacaoDaAvaliacao(reserva, hoje) {
  if (reserva.status === 'confirmada') return 'aguardando_checkout';
  if (reserva.status !== 'concluida') return null;
  return hoje <= ultimoDiaParaAvaliar(reserva.data_checkout) ? 'liberada' : 'encerrada';
}

function exigirAvaliacaoLiberada(reserva, hoje) {
  const situacao = situacaoDaAvaliacao(reserva, hoje);
  if (situacao === 'aguardando_checkout') throw new ErroAvaliacaoAntesDoCheckout();
  if (situacao === 'encerrada') throw new ErroPrazoAvaliacaoEncerrado();
  if (situacao !== 'liberada') throw new ErroReservaNaoAvaliavel();
}

// O imóvel é o da reserva; o serviço precisa ter sido contratado nela
function exigirAlvoDaReserva(reserva, { tipoAlvo, alvoId }) {
  const pertence =
    tipoAlvo === 'imovel' ? reserva.imovel_id === alvoId : reserva.itens.some((item) => item.servico_id === alvoId);
  if (!pertence) throw new ErroAlvoForaDaReserva(tipoAlvo);
}

function validarAvaliacao(dados = {}) {
  const camposInvalidos = {};

  const tipoAlvo = dados.tipo_alvo;
  if (!TIPOS_ALVO.includes(tipoAlvo)) camposInvalidos.tipo_alvo = `Tipos aceitos: ${TIPOS_ALVO.join(', ')}`;

  const alvoId = inteiroEntre(dados.alvo_id, 1, Number.MAX_SAFE_INTEGER);
  if (alvoId === null) camposInvalidos.alvo_id = 'Informe o que está sendo avaliado';

  const nota = inteiroEntre(dados.nota, 1, 5);
  if (nota === null) camposInvalidos.nota = 'Dê uma nota de 1 a 5';

  if (dados.comentario !== undefined && dados.comentario !== null && typeof dados.comentario !== 'string') {
    camposInvalidos.comentario = 'O comentário precisa ser um texto';
  }
  const comentario = textoLongo(dados.comentario);
  if (comentario.length > COMENTARIO_TAMANHO_MAXIMO) {
    camposInvalidos.comentario = `O comentário pode ter no máximo ${COMENTARIO_TAMANHO_MAXIMO} caracteres`;
  }

  if (Object.keys(camposInvalidos).length > 0) throw new ErroDadosInvalidos(camposInvalidos);
  return { tipoAlvo, alvoId, nota, comentario: comentario || null };
}

function validarPaginaAvaliacoes(consulta = {}) {
  const texto = Array.isArray(consulta.pagina) ? consulta.pagina[0] : consulta.pagina;
  if (texto === undefined || texto === '') return 1;
  const pagina = inteiroEntre(texto, 1, PAGINA_MAXIMA);
  if (pagina === null) throw new ErroDadosInvalidos({ pagina: 'Página inválida' });
  return pagina;
}

// Privacidade: nas avaliações públicas aparece só o primeiro nome de quem escreveu
function primeiroNome(nomeCompleto) {
  return (nomeCompleto ?? '').trim().split(/\s+/)[0] || 'Hóspede';
}

module.exports = {
  PRAZO_AVALIACAO_DIAS,
  COMENTARIO_TAMANHO_MAXIMO,
  AVALIACOES_POR_PAGINA,
  TIPOS_ALVO,
  ultimoDiaParaAvaliar,
  situacaoDaAvaliacao,
  exigirAvaliacaoLiberada,
  exigirAlvoDaReserva,
  validarAvaliacao,
  validarPaginaAvaliacoes,
  primeiroNome,
};
