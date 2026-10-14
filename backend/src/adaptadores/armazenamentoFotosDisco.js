const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PREFIXO_URL = '/uploads';
// Só nomes gerados aqui: impede apagar qualquer outro arquivo a partir de uma URL do banco
const NOME_GERADO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

// CB15: o nome do arquivo é gerado no servidor; o nome enviado pelo usuário nunca chega ao disco
function criarArmazenamentoFotosDisco({ pasta }) {
  fs.mkdirSync(pasta, { recursive: true });

  async function salvar(bytes, extensao) {
    const nome = `${randomUUID()}.${extensao}`;
    await fs.promises.writeFile(path.join(pasta, nome), bytes, { flag: 'wx' });
    return `${PREFIXO_URL}/${nome}`;
  }

  // Arquivo que já não existe não é erro: o objetivo (não ter o arquivo) já foi atingido
  async function apagar(url) {
    const nome = url.startsWith(`${PREFIXO_URL}/`) ? url.slice(PREFIXO_URL.length + 1) : '';
    if (!NOME_GERADO.test(nome)) return;
    await fs.promises.rm(path.join(pasta, nome), { force: true });
  }

  return { pasta, prefixoUrl: PREFIXO_URL, salvar, apagar };
}

module.exports = { criarArmazenamentoFotosDisco };
