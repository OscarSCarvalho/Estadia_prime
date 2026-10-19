const { MAX_TENTATIVAS_REPASSE } = require('../dominio/repasse');

// RN09: uma linha por recebedor e reserva. O UNIQUE (reserva_id, usuario_id, tipo) e o
// INSERT OR IGNORE garantem que rodar a rotina de novo nunca cria um segundo repasse
function criarRepositorioRepasses(db) {
  const insercao = db.prepare(`
    INSERT OR IGNORE INTO repasses (reserva_id, usuario_id, tipo, valor)
    VALUES (@reservaId, @usuarioId, @tipo, @valor)
  `);
  // conta_pagamento_id = walletId da subconta Asaas do recebedor
  const consultaAEnviar = db.prepare(`
    SELECT rp.*, u.conta_pagamento_id AS wallet_id, u.recebimento_ativo
      FROM repasses rp
      JOIN usuarios u ON u.id = rp.usuario_id
     WHERE rp.reserva_id = @reservaId AND rp.status <> 'enviado' AND rp.tentativa < @maximo
     ORDER BY rp.id
  `);
  const consultaFaltando = db.prepare("SELECT COUNT(*) AS total FROM repasses WHERE reserva_id = ? AND status <> 'enviado'");
  const consultaEnviados = db.prepare("SELECT COUNT(*) AS total FROM repasses WHERE reserva_id = ? AND status = 'enviado'");
  const marcacaoEnviado = db.prepare(`
    UPDATE repasses SET status = 'enviado', id_externo = @idExterno, enviado_em = datetime('now'), ultimo_erro = NULL
     WHERE id = @id AND status <> 'enviado'
  `);
  const marcacaoFalha = db.prepare(`
    UPDATE repasses SET status = 'falhou', tentativa = tentativa + 1, ultimo_erro = @erro
     WHERE id = @id AND status <> 'enviado'
     RETURNING tentativa
  `);
  const consultaDoUsuario = db.prepare(`
    SELECT reserva_id, status, valor, enviado_em FROM repasses
     WHERE usuario_id = @usuarioId AND reserva_id IN (SELECT value FROM json_each(@ids))
  `);

  function criarPendentes(reservaId, linhas) {
    db.transaction(() => {
      for (const linha of linhas) insercao.run({ reservaId, ...linha });
    })();
  }

  function aEnviarDaReserva(reservaId) {
    return consultaAEnviar.all({ reservaId, maximo: MAX_TENTATIVAS_REPASSE });
  }

  // Faltando = ainda não enviados (inclui os que já esgotaram as tentativas)
  function faltandoNaReserva(reservaId) {
    return consultaFaltando.get(reservaId).total;
  }

  function algumEnviado(reservaId) {
    return consultaEnviados.get(reservaId).total > 0;
  }

  function marcarEnviado(id, idExterno) {
    return marcacaoEnviado.run({ id, idExterno }).changes === 1;
  }

  // Devolve o número de tentativas feitas até agora
  function marcarFalha(id, erro) {
    return marcacaoFalha.get({ id, erro: String(erro).slice(0, 500) })?.tentativa ?? null;
  }

  // Map: id da reserva → repasse deste usuário nela (para as telas do anfitrião e do prestador)
  function doUsuarioNasReservas(usuarioId, reservaIds) {
    const linhas = consultaDoUsuario.all({ usuarioId, ids: JSON.stringify(reservaIds) });
    return new Map(linhas.map((linha) => [linha.reserva_id, linha]));
  }

  return { criarPendentes, aEnviarDaReserva, faltandoNaReserva, algumEnviado, marcarEnviado, marcarFalha, doUsuarioNasReservas };
}

module.exports = { criarRepositorioRepasses };
