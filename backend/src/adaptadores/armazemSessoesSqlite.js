const session = require('express-session');

const UM_DIA_MS = 24 * 60 * 60 * 1000;

class ArmazemSessoesSqlite extends session.Store {
  constructor(db, { intervaloLimpezaMs = 15 * 60 * 1000 } = {}) {
    super();
    this.consultaSessao = db.prepare('SELECT dados FROM sessoes WHERE sid = ? AND expira_em > ?');
    this.gravacaoSessao = db.prepare(`
      INSERT INTO sessoes (sid, dados, expira_em) VALUES (?, ?, ?)
      ON CONFLICT (sid) DO UPDATE SET dados = excluded.dados, expira_em = excluded.expira_em
    `);
    this.renovacaoSessao = db.prepare('UPDATE sessoes SET expira_em = ? WHERE sid = ?');
    this.remocaoSessao = db.prepare('DELETE FROM sessoes WHERE sid = ?');
    this.remocaoExpiradas = db.prepare('DELETE FROM sessoes WHERE expira_em <= ?');

    this.limpezaPeriodica = setInterval(() => this.limparExpiradas(), intervaloLimpezaMs);
    this.limpezaPeriodica.unref();
  }

  static calcularExpiracao(sessao) {
    const expiraEm = sessao?.cookie?.expires;
    return expiraEm ? new Date(expiraEm).getTime() : Date.now() + UM_DIA_MS;
  }

  get(sid, callback) {
    try {
      const linha = this.consultaSessao.get(sid, Date.now());
      callback(null, linha ? JSON.parse(linha.dados) : null);
    } catch (erro) {
      callback(erro);
    }
  }

  set(sid, sessao, callback) {
    try {
      this.gravacaoSessao.run(sid, JSON.stringify(sessao), ArmazemSessoesSqlite.calcularExpiracao(sessao));
      callback?.(null);
    } catch (erro) {
      callback?.(erro);
    }
  }

  touch(sid, sessao, callback) {
    try {
      this.renovacaoSessao.run(ArmazemSessoesSqlite.calcularExpiracao(sessao), sid);
      callback?.(null);
    } catch (erro) {
      callback?.(erro);
    }
  }

  destroy(sid, callback) {
    try {
      this.remocaoSessao.run(sid);
      callback?.(null);
    } catch (erro) {
      callback?.(erro);
    }
  }

  limparExpiradas() {
    return this.remocaoExpiradas.run(Date.now()).changes;
  }

  encerrar() {
    clearInterval(this.limpezaPeriodica);
  }
}

module.exports = { ArmazemSessoesSqlite };
