// Cenários de "Cadastro e Login" do SPEC.md §5, via HTTP real + SQLite em memória
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidorTeste, criarNavegador } = require('../ajudantes/servidorTeste');

let servidor;

before(async () => {
  servidor = await iniciarServidorTeste();
});

after(async () => {
  await servidor.fechar();
  assert.deepEqual(servidor.errosRegistrados, [], 'nenhum erro 500 deveria ter acontecido');
});

let contadorEmails = 0;
function novoCadastro(dados = {}) {
  contadorEmails += 1;
  return {
    nome: 'Ana Anfitriã',
    email: `ana${contadorEmails}@x.com`,
    senha: 'senhaForte123',
    tipo: 'anfitriao',
    ...dados,
  };
}

describe('Cadastro', () => {
  test('cadastro com sucesso já deixa logado com cookie httpOnly', async () => {
    const navegador = criarNavegador(servidor.urlBase);
    const resposta = await navegador.post('/api/auth/cadastro', novoCadastro({ email: 'ana@x.com' }));

    assert.equal(resposta.status, 201);
    assert.equal(resposta.corpo.usuario.email, 'ana@x.com');
    assert.equal(resposta.corpo.usuario.tipo, 'anfitriao');
    assert.equal('senha_hash' in resposta.corpo.usuario, false);

    const cookie = resposta.setCookie[0];
    assert.match(cookie, /^estadia\.sid=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    const eu = await navegador.get('/api/auth/eu');
    assert.equal(eu.status, 200);
    assert.equal(eu.corpo.usuario.email, 'ana@x.com');
  });

  test('senha é guardada como hash bcrypt', () => {
    const { senha_hash } = servidor.db.prepare("SELECT senha_hash FROM usuarios WHERE email = 'ana@x.com'").get();
    assert.match(senha_hash, /^\$2[aby]\$/);
  });

  test('e-mail já cadastrado (com outra caixa) → 409', async () => {
    const resposta = await criarNavegador(servidor.urlBase).post('/api/auth/cadastro', novoCadastro({ email: 'ANA@x.com' }));
    assert.equal(resposta.status, 409);
    assert.equal(resposta.corpo.erro.codigo, 'EMAIL_JA_CADASTRADO');
    assert.equal(resposta.corpo.erro.mensagem, 'E-mail já cadastrado');
  });

  test('dados inválidos → 400 com os campos problemáticos', async () => {
    const resposta = await criarNavegador(servidor.urlBase).post('/api/auth/cadastro', { email: 'x', tipo: 'admin' });
    assert.equal(resposta.status, 400);
    assert.equal(resposta.corpo.erro.codigo, 'DADOS_INVALIDOS');
    assert.ok(resposta.corpo.erro.detalhes.tipo);
    assert.ok(resposta.corpo.erro.detalhes.senha);
  });

  test('JSON malformado → 400 sem erro interno', async () => {
    const resposta = await criarNavegador(servidor.urlBase).post('/api/auth/cadastro', undefined, { corpoBruto: '{nome:' });
    assert.equal(resposta.status, 400);
    assert.equal(resposta.corpo.erro.codigo, 'JSON_INVALIDO');
  });

  test('corpo vazio → 400', async () => {
    const resposta = await criarNavegador(servidor.urlBase).post('/api/auth/cadastro');
    assert.equal(resposta.status, 400);
  });

  test('os três perfis podem se cadastrar', async () => {
    for (const tipo of ['hospede', 'anfitriao', 'prestador']) {
      const resposta = await criarNavegador(servidor.urlBase).post('/api/auth/cadastro', novoCadastro({ tipo }));
      assert.equal(resposta.status, 201);
      assert.equal(resposta.corpo.usuario.tipo, tipo);
    }
  });
});

describe('Login e sessão', () => {
  const credenciais = { email: 'hugo@x.com', senha: 'senhaDoHugo1' };

  before(async () => {
    await criarNavegador(servidor.urlBase).post('/api/auth/cadastro', novoCadastro({ ...credenciais, nome: 'Hugo', tipo: 'hospede' }));
  });

  test('login com sucesso devolve o usuário e cria a sessão', async () => {
    const navegador = criarNavegador(servidor.urlBase);
    const resposta = await navegador.post('/api/auth/login', { ...credenciais, email: 'HUGO@x.com' });
    assert.equal(resposta.status, 200);
    assert.equal(resposta.corpo.usuario.nome, 'Hugo');
    assert.equal((await navegador.get('/api/auth/eu')).status, 200);
  });

  test('senha errada e e-mail inexistente → mesma resposta 401', async () => {
    const senhaErrada = await criarNavegador(servidor.urlBase).post('/api/auth/login', { ...credenciais, senha: 'errada000' });
    const emailInexistente = await criarNavegador(servidor.urlBase).post('/api/auth/login', { email: 'ninguem@x.com', senha: 'errada000' });
    assert.equal(senhaErrada.status, 401);
    assert.deepEqual(senhaErrada.corpo, emailInexistente.corpo);
    assert.equal(senhaErrada.corpo.erro.mensagem, 'E-mail ou senha inválidos');
  });

  test('sessão dura 7 dias', async () => {
    const resposta = await criarNavegador(servidor.urlBase).post('/api/auth/login', credenciais);
    const expiraEm = new Date(/Expires=([^;]+)/i.exec(resposta.setCookie[0])[1]).getTime();
    const seteDias = 7 * 24 * 60 * 60 * 1000;
    assert.ok(Math.abs(expiraEm - Date.now() - seteDias) < 60_000);
  });

  test('login gera um novo ID de sessão (anti session fixation)', async () => {
    const navegador = criarNavegador(servidor.urlBase);
    await navegador.post('/api/auth/login', credenciais);
    const cookieAntes = navegador.cookie;
    await navegador.post('/api/auth/login', credenciais);
    assert.notEqual(navegador.cookie, cookieAntes);
  });

  test('logout destrói a sessão no servidor (cookie antigo deixa de valer)', async () => {
    const navegador = criarNavegador(servidor.urlBase);
    await navegador.post('/api/auth/login', credenciais);
    const cookieRoubado = navegador.cookie;

    const saida = await navegador.post('/api/auth/logout');
    assert.equal(saida.status, 204);
    assert.equal((await navegador.get('/api/auth/eu')).status, 401);

    navegador.cookie = cookieRoubado;
    assert.equal((await navegador.get('/api/auth/eu')).status, 401);
  });

  test('visitante sem login → 401 em /eu', async () => {
    const resposta = await criarNavegador(servidor.urlBase).get('/api/auth/eu');
    assert.equal(resposta.status, 401);
    assert.equal(resposta.corpo.erro.codigo, 'NAO_AUTENTICADO');
  });

  test('cookie adulterado é ignorado', async () => {
    const navegador = criarNavegador(servidor.urlBase);
    navegador.cookie = 'estadia.sid=s%3Afalso.assinaturafalsa';
    assert.equal((await navegador.get('/api/auth/eu')).status, 401);
  });
});

describe('Limite de tentativas', () => {
  test('5 erros em 15 minutos → 429 com Retry-After, mesmo com a senha certa', async () => {
    const credenciais = { email: 'paulo@x.com', senha: 'senhaDoPaulo1' };
    await criarNavegador(servidor.urlBase).post('/api/auth/cadastro', novoCadastro({ ...credenciais, tipo: 'prestador' }));

    for (let i = 0; i < 5; i++) {
      const resposta = await criarNavegador(servidor.urlBase).post('/api/auth/login', { ...credenciais, senha: 'errada000' });
      assert.equal(resposta.status, 401);
    }

    const bloqueada = await criarNavegador(servidor.urlBase).post('/api/auth/login', credenciais);
    assert.equal(bloqueada.status, 429);
    assert.equal(bloqueada.corpo.erro.codigo, 'MUITAS_TENTATIVAS');
    assert.ok(Number(bloqueada.cabecalhos.get('retry-after')) > 0);
  });
});

describe('Infraestrutura HTTP', () => {
  test('saúde da API', async () => {
    const resposta = await criarNavegador(servidor.urlBase).get('/api/saude');
    assert.equal(resposta.status, 200);
    assert.deepEqual(resposta.corpo, { ok: true });
  });

  test('rota inexistente → 404 em JSON', async () => {
    const resposta = await criarNavegador(servidor.urlBase).get('/api/nao-existe');
    assert.equal(resposta.status, 404);
    assert.equal(resposta.corpo.erro.codigo, 'ROTA_NAO_ENCONTRADA');
  });

  test('cabeçalhos de segurança e sem X-Powered-By', async () => {
    const resposta = await criarNavegador(servidor.urlBase).get('/api/saude');
    assert.equal(resposta.cabecalhos.get('x-content-type-options'), 'nosniff');
    assert.equal(resposta.cabecalhos.get('x-frame-options'), 'DENY');
    assert.equal(resposta.cabecalhos.get('cache-control'), 'no-store');
    assert.equal(resposta.cabecalhos.get('x-powered-by'), null);
  });

  test('visitante não cria sessão à toa (sem cookie)', async () => {
    const resposta = await criarNavegador(servidor.urlBase).get('/api/saude');
    assert.equal(resposta.setCookie.length, 0);
  });
});
