const bcrypt = require('bcryptjs');

function criarServicoSenhaBcrypt({ custo }) {
  let hashFicticio;

  function obterHashFicticio() {
    hashFicticio ??= bcrypt.hash('hash-ficticio-para-tempo-constante', custo);
    return hashFicticio;
  }

  async function gerarHash(senha) {
    return bcrypt.hash(senha, custo);
  }

  async function comparar(senha, hash) {
    if (!hash) {
      await bcrypt.compare(senha, await obterHashFicticio());
      return false;
    }
    return bcrypt.compare(senha, hash);
  }

  return { gerarHash, comparar };
}

module.exports = { criarServicoSenhaBcrypt };
