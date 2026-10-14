const { ErroAvaliacaoRepetida } = require('../dominio/erros');
const { colunasAvaliacao } = require('./sqlComum');

// Avaliações de imóveis e serviços (H7). As regras (RN11) ficam no domínio e no caso de uso
function criarRepositorioAvaliacoes(db) {
  const insercao = db.prepare(`
    INSERT INTO avaliacoes (reserva_id, autor_id, tipo_alvo, alvo_id, nota, comentario)
    VALUES (@reservaId, @autorId, @tipoAlvo, @alvoId, @nota, @comentario)
  `);
  const consultaPorId = db.prepare('SELECT id, tipo_alvo, alvo_id, nota, comentario, data FROM avaliacoes WHERE id = ?');

  const consultaDasReservas = db.prepare(`
    SELECT reserva_id, tipo_alvo, alvo_id, nota, comentario, data
      FROM avaliacoes
     WHERE autor_id = @autorId AND reserva_id IN (SELECT value FROM json_each(@ids))
     ORDER BY id
  `);

  const consultaDoAlvo = db.prepare(`
    SELECT av.id, av.nota, av.comentario, av.data, u.nome AS autor
      FROM avaliacoes av
      JOIN usuarios u ON u.id = av.autor_id
     WHERE av.tipo_alvo = @tipoAlvo AND av.alvo_id = @alvoId
     ORDER BY av.data DESC, av.id DESC
     LIMIT @limite OFFSET @deslocamento
  `);

  // `tipoAlvo` vem de TIPOS_ALVO (domínio), nunca do usuário: uma consulta pronta para cada tipo
  const consultasResumo = {
    imovel: db.prepare(`SELECT ${colunasAvaliacao('imovel', '@alvoId')}`),
    servico: db.prepare(`SELECT ${colunasAvaliacao('servico', '@alvoId')}`),
  };

  // A UNIQUE (reserva, autor, alvo) do banco garante a regra mesmo com dois envios ao mesmo tempo
  function inserir({ reservaId, autorId, tipoAlvo, alvoId, nota, comentario }) {
    try {
      const { lastInsertRowid } = insercao.run({ reservaId, autorId, tipoAlvo, alvoId, nota, comentario });
      return consultaPorId.get(lastInsertRowid);
    } catch (erro) {
      if (erro.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new ErroAvaliacaoRepetida();
      throw erro;
    }
  }

  // Map: id da reserva → avaliações que o autor já fez nela
  function feitasNasReservas(autorId, reservaIds) {
    const porReserva = new Map(reservaIds.map((id) => [id, []]));
    for (const { reserva_id, ...avaliacao } of consultaDasReservas.all({ autorId, ids: JSON.stringify(reservaIds) })) {
      porReserva.get(reserva_id).push(avaliacao);
    }
    return porReserva;
  }

  function listarDoAlvo({ tipoAlvo, alvoId }, { limite, deslocamento }) {
    return consultaDoAlvo.all({ tipoAlvo, alvoId, limite, deslocamento });
  }

  function resumoDoAlvo({ tipoAlvo, alvoId }) {
    return consultasResumo[tipoAlvo].get({ alvoId });
  }

  return { inserir, feitasNasReservas, listarDoAlvo, resumoDoAlvo };
}

module.exports = { criarRepositorioAvaliacoes };
