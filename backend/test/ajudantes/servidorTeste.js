const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { abrirBanco } = require('../../src/db/database');
const { criarApp } = require('../../src/app');

const configTeste = {
  emProducao: false,
  porta: 0,
  segredoSessao: 'segredo-de-teste',
  custoHashSenha: 4,
  comissaoHospedagemPct: 12,
  comissaoServicoPct: 15,
  gatewayPagamento: 'falso',
  asaasWebhookToken: 'token-do-webhook-de-teste',
  chaveCriptografia: 'ab'.repeat(32),
  urlPublicaSite: 'http://localhost:5173',
};

async function iniciarServidorTeste(configExtra = {}) {
  const db = abrirBanco(':memory:');
  const pastaUploads = fs.mkdtempSync(path.join(os.tmpdir(), 'estadia-uploads-'));
  const errosRegistrados = [];
  const { app, encerrar, gateway, rotinas } = criarApp({
    db,
    config: { ...configTeste, pastaUploads, ...configExtra },
    registrarErro: (e) => errosRegistrados.push(e),
  });
  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const urlBase = `http://127.0.0.1:${servidor.address().port}`;

  async function fechar() {
    await new Promise((resolve) => servidor.close(resolve));
    encerrar();
    db.close();
    fs.rmSync(pastaUploads, { recursive: true, force: true });
  }

  // `gateway`: o gatewayFalso (simula pagamentos e falhas); `rotinas`: passos da rotina de 15 min
  return { db, urlBase, pastaUploads, errosRegistrados, gateway, rotinas, fechar };
}

// Simula um navegador: guarda o cookie de sessão entre as requisições
function criarNavegador(urlBase) {
  let cookie = null;

  // `formulario` (FormData) vai como multipart; o fetch define o content-type com o boundary
  async function requisitar(metodo, caminho, corpo, { corpoBruto, formulario } = {}) {
    const cabecalhos = {};
    if (cookie) cabecalhos.cookie = cookie;
    if (corpo !== undefined || corpoBruto !== undefined) cabecalhos['content-type'] = 'application/json';

    const resposta = await fetch(urlBase + caminho, {
      method: metodo,
      headers: cabecalhos,
      body: formulario ?? corpoBruto ?? (corpo === undefined ? undefined : JSON.stringify(corpo)),
    });

    const setCookie = resposta.headers.getSetCookie();
    if (setCookie.length > 0) {
      const [parNomeValor] = setCookie[0].split(';');
      cookie = parNomeValor.endsWith('=') ? null : parNomeValor;
    }

    const texto = await resposta.text();
    return {
      status: resposta.status,
      cabecalhos: resposta.headers,
      setCookie,
      corpo: texto ? JSON.parse(texto) : null,
    };
  }

  return {
    get: (caminho) => requisitar('GET', caminho),
    post: (caminho, corpo, opcoes) => requisitar('POST', caminho, corpo, opcoes),
    put: (caminho, corpo) => requisitar('PUT', caminho, corpo),
    patch: (caminho, corpo) => requisitar('PATCH', caminho, corpo),
    // Webhook do gateway: sem cookie, com o token no cabeçalho asaas-access-token (null = sem token)
    async webhook(corpo, token = 'token-do-webhook-de-teste') {
      const resposta = await fetch(`${urlBase}/api/webhooks/asaas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token && { 'asaas-access-token': token }) },
        body: JSON.stringify(corpo),
      });
      return { status: resposta.status, corpo: await resposta.json() };
    },
    delete: (caminho) => requisitar('DELETE', caminho),
    // arquivos: [{ bytes, nome }] no campo 'fotos'
    enviarFotos(caminho, arquivos, campo = 'fotos') {
      const formulario = new FormData();
      for (const { bytes, nome = 'foto.jpg' } of arquivos) formulario.append(campo, new Blob([bytes]), nome);
      return requisitar('POST', caminho, undefined, { formulario });
    },
    get cookie() {
      return cookie;
    },
    set cookie(valor) {
      cookie = valor;
    },
  };
}

module.exports = { iniciarServidorTeste, criarNavegador };
