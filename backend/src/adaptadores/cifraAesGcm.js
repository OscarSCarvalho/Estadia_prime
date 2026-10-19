const crypto = require('node:crypto');

// Guarda segredos no banco (a apiKey de cada subconta Asaas) cifrados com AES-256-GCM, só com node:crypto.
// Formato gravado: "v1.<iv>.<tag>.<dados>" em base64url. O GCM também detecta qualquer alteração (tag)
const VERSAO = 'v1';
const TAMANHO_IV = 12;

// CHAVE_CRIPTOGRAFIA: 32 bytes em hexadecimal (64 caracteres). Gerar com:
// node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
function lerChave(chaveHex) {
  if (typeof chaveHex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(chaveHex)) {
    throw new Error('CHAVE_CRIPTOGRAFIA precisa ter 64 caracteres hexadecimais (32 bytes)');
  }
  return Buffer.from(chaveHex, 'hex');
}

function criarCifraAesGcm(chaveHex) {
  const chave = lerChave(chaveHex);

  function cifrar(texto) {
    const iv = crypto.randomBytes(TAMANHO_IV);
    const cifrador = crypto.createCipheriv('aes-256-gcm', chave, iv);
    const dados = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
    return [VERSAO, iv, cifrador.getAuthTag(), dados].map((parte) => (typeof parte === 'string' ? parte : parte.toString('base64url'))).join('.');
  }

  function decifrar(gravado) {
    const [versao, iv, tag, dados] = String(gravado).split('.');
    if (versao !== VERSAO || !iv || !tag || dados === undefined) throw new Error('Segredo cifrado em formato desconhecido');
    const decifrador = crypto.createDecipheriv('aes-256-gcm', chave, Buffer.from(iv, 'base64url'));
    decifrador.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decifrador.update(Buffer.from(dados, 'base64url')), decifrador.final()]).toString('utf8');
  }

  return { cifrar, decifrar };
}

module.exports = { criarCifraAesGcm };
