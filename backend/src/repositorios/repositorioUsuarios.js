const { ErroEmailJaCadastrado } = require('../dominio/erros');

function criarRepositorioUsuarios(db) {
  const consultaPorEmail = db.prepare('SELECT * FROM usuarios WHERE email = ?');
  const consultaPorId = db.prepare('SELECT * FROM usuarios WHERE id = ?');
  const insercao = db.prepare(`
    INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo)
    VALUES (@nome, @email, @senha_hash, @telefone, @tipo)
  `);

  function buscarPorEmail(email) {
    return consultaPorEmail.get(email) ?? null;
  }

  function buscarPorId(id) {
    return consultaPorId.get(id) ?? null;
  }

  function inserir({ nome, email, senha_hash, telefone, tipo }) {
    try {
      const { lastInsertRowid } = insercao.run({ nome, email, senha_hash, telefone, tipo });
      return buscarPorId(lastInsertRowid);
    } catch (erro) {
      if (erro.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new ErroEmailJaCadastrado();
      throw erro;
    }
  }

  return { buscarPorEmail, buscarPorId, inserir };
}

module.exports = { criarRepositorioUsuarios };
