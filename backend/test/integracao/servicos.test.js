// Cenários de "Cadastro de Serviço" do SPEC.md §5, via HTTP real + SQLite em memória
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidorTeste, criarNavegador } = require('../ajudantes/servidorTeste');

const MOTORISTA = { tipo_servico: 'motorista', descricao: 'Blindado, bilíngue.', preco: 900, unidade_preco: 'diaria', cidade_atuacao: 'Búzios' };

let servidor;
let contadorEmails = 0;

before(async () => {
  servidor = await iniciarServidorTeste();
});

after(async () => {
  await servidor.fechar();
  assert.deepEqual(servidor.errosRegistrados, [], 'nenhum erro 500 deveria ter acontecido');
});

// `recebimentoAtivo` simula o cadastro no Stripe concluído (RN13), que só chega na Etapa 4b
async function entrarComo(tipo, { recebimentoAtivo = true } = {}) {
  contadorEmails += 1;
  const navegador = criarNavegador(servidor.urlBase);
  const resposta = await navegador.post('/api/auth/cadastro', {
    nome: `Prestador ${contadorEmails}`,
    email: `servico${contadorEmails}@x.com`,
    senha: 'senhaForte123',
    tipo,
  });
  navegador.id = resposta.corpo.usuario.id;
  servidor.db.prepare('UPDATE usuarios SET recebimento_ativo = ? WHERE id = ?').run(recebimentoAtivo ? 1 : 0, navegador.id);
  return navegador;
}

async function servicosPublicos(consulta = '') {
  const resposta = await criarNavegador(servidor.urlBase).get(`/api/servicos${consulta}`);
  assert.equal(resposta.status, 200);
  return resposta.corpo.servicos;
}

test('prestador cadastra "motorista", R$ 900,00 por diária em Búzios: criado como "ativo"', async () => {
  const paulo = await entrarComo('prestador');
  const resposta = await paulo.post('/api/meus-servicos', MOTORISTA);

  assert.equal(resposta.status, 201);
  assert.equal(resposta.corpo.servico.status, 'ativo');
  assert.equal(resposta.corpo.servico.preco, 90000);
  assert.equal(resposta.corpo.servico.prestador_id, paulo.id);
});

test('tipo "chef" fora da lista → 400 listando os tipos aceitos', async () => {
  const paulo = await entrarComo('prestador');
  const resposta = await paulo.post('/api/meus-servicos', { ...MOTORISTA, tipo_servico: 'chef' });

  assert.equal(resposta.status, 400);
  assert.equal(
    resposta.corpo.erro.detalhes.tipo_servico,
    'Tipos aceitos: mordomo, copeiro, empregado, motorista, barman, eventos',
  );
});

test('anfitrião ou hóspede não cadastram serviço (403); visitante recebe 401', async () => {
  for (const tipo of ['anfitriao', 'hospede']) {
    const navegador = await entrarComo(tipo);
    assert.equal((await navegador.post('/api/meus-servicos', MOTORISTA)).status, 403);
  }
  assert.equal((await criarNavegador(servidor.urlBase).post('/api/meus-servicos', MOTORISTA)).status, 401);
});

test('editar ou desativar serviço de outro prestador → 404', async () => {
  const paulo = await entrarComo('prestador');
  const carlos = await entrarComo('prestador');
  const { corpo } = await paulo.post('/api/meus-servicos', MOTORISTA);

  assert.equal((await carlos.put(`/api/meus-servicos/${corpo.servico.id}`, { ...MOTORISTA, preco: 1 })).status, 404);
  assert.equal((await carlos.patch(`/api/meus-servicos/${corpo.servico.id}/status`, { status: 'inativo' })).status, 404);
  assert.equal((await carlos.put('/api/meus-servicos/xyz', MOTORISTA)).status, 404);
  assert.deepEqual((await carlos.get('/api/meus-servicos')).corpo.servicos, []);
});

test('CB05: desativado some da lista pública, mas continua no painel do prestador', async () => {
  const paulo = await entrarComo('prestador');
  const { corpo } = await paulo.post('/api/meus-servicos', { ...MOTORISTA, cidade_atuacao: 'paraty' });
  const id = corpo.servico.id;
  assert.ok((await servicosPublicos('?cidade=Paraty')).some((servico) => servico.id === id));

  const desativado = await paulo.patch(`/api/meus-servicos/${id}/status`, { status: 'inativo' });
  assert.equal(desativado.corpo.servico.status, 'inativo');
  assert.equal((await servicosPublicos('?cidade=Paraty')).some((servico) => servico.id === id), false);
  assert.equal((await paulo.get('/api/meus-servicos')).corpo.servicos[0].status, 'inativo');
});

test('editar o próprio serviço muda preço e cidade (padronizada)', async () => {
  const paulo = await entrarComo('prestador');
  const { corpo } = await paulo.post('/api/meus-servicos', MOTORISTA);
  const editado = await paulo.put(`/api/meus-servicos/${corpo.servico.id}`, {
    ...MOTORISTA,
    preco: '1.200,50',
    cidade_atuacao: '  ANGRA DOS REIS ',
  });
  assert.equal(editado.status, 200);
  assert.equal(editado.corpo.servico.preco, 120050);
  assert.equal(editado.corpo.servico.cidade_atuacao, 'Angra dos Reis');
});

test('lista pública (sem login): filtra por cidade e tipo, mostra o nome e esconde quem não tem recebimento', async () => {
  const visivel = await entrarComo('prestador');
  const semRecebimento = await entrarComo('prestador', { recebimentoAtivo: false });
  await visivel.post('/api/meus-servicos', { ...MOTORISTA, tipo_servico: 'barman', cidade_atuacao: 'Itaipava' });
  await semRecebimento.post('/api/meus-servicos', { ...MOTORISTA, tipo_servico: 'barman', cidade_atuacao: 'Itaipava' });

  const servicos = await servicosPublicos('?cidade=itaipava&tipo=barman');
  assert.equal(servicos.length, 1);
  assert.equal(servicos[0].prestador, `Prestador ${contadorEmails - 1}`);
  assert.equal('prestador_id' in servicos[0], false);

  const invalido = await criarNavegador(servidor.urlBase).get('/api/servicos?tipo=chef');
  assert.equal(invalido.status, 400);
});
