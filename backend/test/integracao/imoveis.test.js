// Cenários de "Cadastro de Imóvel" do SPEC.md §5, via HTTP real + SQLite em memória + pasta temporária
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { iniciarServidorTeste, criarNavegador } = require('../ajudantes/servidorTeste');
const { criarReserva } = require('../ajudantes/dadosBanco');

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const PDF = Buffer.from('%PDF-1.7\n1 0 obj');
const HTML_DISFARCADO = Buffer.from('<html><script>alert(1)</script></html>');

const DADOS_VILLA = {
  titulo: 'Villa Vista Mar',
  descricao: 'Piscina de borda infinita.',
  tipo_imovel: 'villa',
  endereco: 'Rua das Ondas, 10',
  cidade: 'búzios ',
  estado: 'rj',
  diaria: 2500,
  num_hospedes: 8,
  num_quartos: 4,
};

let servidor;
let contadorEmails = 0;

before(async () => {
  servidor = await iniciarServidorTeste();
});

after(async () => {
  await servidor.fechar();
  assert.deepEqual(servidor.errosRegistrados, [], 'nenhum erro 500 deveria ter acontecido');
});

async function entrarComo(tipo) {
  contadorEmails += 1;
  const navegador = criarNavegador(servidor.urlBase);
  const resposta = await navegador.post('/api/auth/cadastro', {
    nome: `Pessoa ${tipo}`,
    email: `${tipo}${contadorEmails}@x.com`,
    senha: 'senhaForte123',
    tipo,
  });
  navegador.id = resposta.corpo.usuario.id;
  return navegador;
}

async function cadastrarVilla(navegador, dados = {}) {
  const resposta = await navegador.post('/api/meus-imoveis', { ...DADOS_VILLA, ...dados });
  assert.equal(resposta.status, 201);
  return resposta.corpo.imovel;
}

function arquivosNaPasta() {
  return fs.readdirSync(servidor.pastaUploads);
}

describe('Cadastro de imóvel', () => {
  test('anfitrião cadastra: status "ativo", diária em centavos, cidade e estado padronizados', async () => {
    const ana = await entrarComo('anfitriao');
    const resposta = await ana.post('/api/meus-imoveis', DADOS_VILLA);

    assert.equal(resposta.status, 201);
    const { imovel } = resposta.corpo;
    assert.equal(imovel.status, 'ativo');
    assert.equal(imovel.preco_diaria, 250000);
    assert.equal(imovel.cidade, 'Búzios');
    assert.equal(imovel.estado, 'RJ');
    assert.equal(imovel.anfitriao_id, ana.id);
  });

  test('a diária também pode vir como texto pt-BR ("2.500,00")', async () => {
    const ana = await entrarComo('anfitriao');
    const imovel = await cadastrarVilla(ana, { diaria: '2.500,00' });
    assert.equal(imovel.preco_diaria, 250000);
  });

  test('dados inválidos → 400 com a mensagem de cada campo', async () => {
    const ana = await entrarComo('anfitriao');
    const resposta = await ana.post('/api/meus-imoveis', { ...DADOS_VILLA, tipo_imovel: 'castelo', diaria: -1, titulo: '' });

    assert.equal(resposta.status, 400);
    assert.equal(resposta.corpo.erro.codigo, 'DADOS_INVALIDOS');
    assert.deepEqual(Object.keys(resposta.corpo.erro.detalhes).sort(), ['diaria', 'tipo_imovel', 'titulo']);
  });

  test('hóspede ou prestador tentando cadastrar imóvel → 403; sem login → 401', async () => {
    for (const tipo of ['hospede', 'prestador']) {
      const navegador = await entrarComo(tipo);
      assert.equal((await navegador.post('/api/meus-imoveis', DADOS_VILLA)).status, 403);
    }
    const visitante = criarNavegador(servidor.urlBase);
    assert.equal((await visitante.post('/api/meus-imoveis', DADOS_VILLA)).status, 401);
    assert.equal((await visitante.get('/api/meus-imoveis')).status, 401);
  });

  test('editar imóvel de outro anfitrião → 404 (não revela que existe), e nada muda', async () => {
    const ana = await entrarComo('anfitriao');
    const bruno = await entrarComo('anfitriao');
    const villa = await cadastrarVilla(ana);

    const resposta = await bruno.put(`/api/meus-imoveis/${villa.id}`, { ...DADOS_VILLA, titulo: 'Invadido' });
    assert.equal(resposta.status, 404);
    assert.equal(resposta.corpo.erro.codigo, 'IMOVEL_NAO_ENCONTRADO');
    assert.equal((await bruno.get(`/api/meus-imoveis/${villa.id}`)).status, 404);
    assert.equal((await ana.get(`/api/meus-imoveis/${villa.id}`)).corpo.imovel.titulo, 'Villa Vista Mar');
  });

  test('id que não é número → 404', async () => {
    const ana = await entrarComo('anfitriao');
    assert.equal((await ana.get('/api/meus-imoveis/abc')).status, 404);
    assert.equal((await ana.get('/api/meus-imoveis/1e3')).status, 404);
  });

  test('anfitrião edita o próprio imóvel e vê só os seus na listagem', async () => {
    const ana = await entrarComo('anfitriao');
    const bruno = await entrarComo('anfitriao');
    const villa = await cadastrarVilla(ana);
    await cadastrarVilla(bruno, { titulo: 'Casa do Bruno' });

    const editado = await ana.put(`/api/meus-imoveis/${villa.id}`, { ...DADOS_VILLA, diaria: 3000 });
    assert.equal(editado.status, 200);
    assert.equal(editado.corpo.imovel.preco_diaria, 300000);

    const lista = await ana.get('/api/meus-imoveis');
    assert.deepEqual(lista.corpo.imoveis.map((imovel) => imovel.id), [villa.id]);
    assert.equal(lista.corpo.imoveis[0].total_fotos, 0);
  });
});

describe('Fotos do imóvel', () => {
  test('3 fotos JPG são salvas na ordem enviada, com nome gerado no servidor', async () => {
    const ana = await entrarComo('anfitriao');
    const villa = await cadastrarVilla(ana);

    const resposta = await ana.enviarFotos(`/api/meus-imoveis/${villa.id}/fotos`, [
      { bytes: JPG, nome: 'sala.jpg' },
      { bytes: PNG, nome: 'piscina.png' },
      { bytes: JPG, nome: '../../../etc/passwd.jpg' },
    ]);

    assert.equal(resposta.status, 201);
    const { fotos } = resposta.corpo;
    assert.deepEqual(fotos.map((foto) => foto.ordem), [1, 2, 3]);
    for (const foto of fotos) {
      assert.match(foto.url_foto, /^\/uploads\/[0-9a-f-]{36}\.(jpg|png)$/);
      assert.ok(fs.existsSync(path.join(servidor.pastaUploads, path.basename(foto.url_foto))));
    }
    assert.match(fotos[1].url_foto, /\.png$/, 'extensão vem dos bytes, não do nome enviado');

    const meuImovel = await ana.get(`/api/meus-imoveis/${villa.id}`);
    assert.deepEqual(meuImovel.corpo.imovel.fotos.map((foto) => foto.id), fotos.map((foto) => foto.id));
  });

  test('a foto é servida em /uploads como imagem, sem permitir execução', async () => {
    const ana = await entrarComo('anfitriao');
    const villa = await cadastrarVilla(ana);
    const { corpo } = await ana.enviarFotos(`/api/meus-imoveis/${villa.id}/fotos`, [{ bytes: JPG }]);

    const resposta = await fetch(servidor.urlBase + corpo.fotos[0].url_foto);
    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers.get('content-type'), 'image/jpeg');
    assert.equal(resposta.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(resposta.headers.get('content-security-policy'), "default-src 'none'");
    assert.deepEqual(Buffer.from(await resposta.arrayBuffer()), JPG);
  });

  test('PDF, HTML com extensão .jpg ou foto acima de 5 MB → 400 e nada é salvo', async () => {
    const ana = await entrarComo('anfitriao');
    const villa = await cadastrarVilla(ana);
    const arquivosAntes = arquivosNaPasta();
    const grande = Buffer.alloc(5 * 1024 * 1024 + 1);
    JPG.copy(grande);

    for (const arquivos of [
      [{ bytes: PDF, nome: 'contrato.pdf' }],
      [{ bytes: JPG }, { bytes: HTML_DISFARCADO, nome: 'foto.jpg' }],
      [{ bytes: grande }],
    ]) {
      const resposta = await ana.enviarFotos(`/api/meus-imoveis/${villa.id}/fotos`, arquivos);
      assert.equal(resposta.status, 400);
      assert.equal(resposta.corpo.erro.codigo, 'ARQUIVO_INVALIDO');
    }

    assert.deepEqual(arquivosNaPasta(), arquivosAntes);
    assert.equal((await ana.get(`/api/meus-imoveis/${villa.id}`)).corpo.imovel.fotos.length, 0);
  });

  test('imóvel com 10 fotos: mais uma → 400 "Limite de 10 fotos"', async () => {
    const ana = await entrarComo('anfitriao');
    const villa = await cadastrarVilla(ana);
    const dezFotos = Array.from({ length: 10 }, () => ({ bytes: JPG }));
    assert.equal((await ana.enviarFotos(`/api/meus-imoveis/${villa.id}/fotos`, dezFotos)).status, 201);

    const resposta = await ana.enviarFotos(`/api/meus-imoveis/${villa.id}/fotos`, [{ bytes: JPG }]);
    assert.equal(resposta.status, 400);
    assert.equal(resposta.corpo.erro.codigo, 'LIMITE_FOTOS');
    assert.equal(resposta.corpo.erro.mensagem, 'Limite de 10 fotos');
  });

  test('11 fotos de uma vez → 400 "Limite de 10 fotos" e nada é salvo', async () => {
    const ana = await entrarComo('anfitriao');
    const villa = await cadastrarVilla(ana);
    const arquivosAntes = arquivosNaPasta();

    const onzeFotos = Array.from({ length: 11 }, () => ({ bytes: JPG }));
    const resposta = await ana.enviarFotos(`/api/meus-imoveis/${villa.id}/fotos`, onzeFotos);
    assert.equal(resposta.status, 400);
    assert.equal(resposta.corpo.erro.mensagem, 'Limite de 10 fotos');
    assert.deepEqual(arquivosNaPasta(), arquivosAntes);
  });

  test('sem arquivo, campo com outro nome ou foto em imóvel de outro anfitrião', async () => {
    const ana = await entrarComo('anfitriao');
    const bruno = await entrarComo('anfitriao');
    const villa = await cadastrarVilla(ana);
    const caminho = `/api/meus-imoveis/${villa.id}/fotos`;

    const semArquivo = await ana.post(caminho, {});
    assert.equal(semArquivo.status, 400);
    assert.equal(semArquivo.corpo.erro.mensagem, 'Envie pelo menos uma foto');

    assert.equal((await ana.enviarFotos(caminho, [{ bytes: JPG }], 'imagem')).status, 400);
    assert.equal((await bruno.enviarFotos(caminho, [{ bytes: JPG }])).status, 404);
  });

  test('reordenar muda a capa; remover apaga o arquivo do disco', async () => {
    const ana = await entrarComo('anfitriao');
    const bruno = await entrarComo('anfitriao');
    const villa = await cadastrarVilla(ana);
    const { corpo } = await ana.enviarFotos(`/api/meus-imoveis/${villa.id}/fotos`, [{ bytes: JPG }, { bytes: JPG }, { bytes: JPG }]);
    const [a, b, c] = corpo.fotos;

    const reordenado = await ana.put(`/api/meus-imoveis/${villa.id}/fotos/ordem`, { fotos: [c.id, a.id, b.id] });
    assert.equal(reordenado.status, 200);
    assert.deepEqual(reordenado.corpo.fotos.map((foto) => foto.id), [c.id, a.id, b.id]);
    assert.equal((await ana.get('/api/meus-imoveis')).corpo.imoveis[0].foto_capa, c.url_foto);

    const incompleto = await ana.put(`/api/meus-imoveis/${villa.id}/fotos/ordem`, { fotos: [c.id] });
    assert.equal(incompleto.status, 400);

    assert.equal((await bruno.delete(`/api/meus-imoveis/${villa.id}/fotos/${a.id}`)).status, 404);
    const removido = await ana.delete(`/api/meus-imoveis/${villa.id}/fotos/${a.id}`);
    assert.equal(removido.status, 200);
    assert.deepEqual(removido.corpo.fotos.map((foto) => foto.id), [c.id, b.id]);
    assert.equal(fs.existsSync(path.join(servidor.pastaUploads, path.basename(a.url_foto))), false);

    const deNovo = await ana.delete(`/api/meus-imoveis/${villa.id}/fotos/${a.id}`);
    assert.equal(deNovo.status, 404);
    assert.equal(deNovo.corpo.erro.codigo, 'FOTO_NAO_ENCONTRADA');
  });
});

describe('Ativar e desativar imóvel', () => {
  test('CB06: desativar com reserva futura → 409 "Imóvel tem reservas futuras"', async () => {
    const ana = await entrarComo('anfitriao');
    const hugo = await entrarComo('hospede');
    const villa = await cadastrarVilla(ana);
    criarReserva(servidor.db, { hospedeId: hugo.id, imovelId: villa.id, checkin: '2099-01-10', checkout: '2099-01-15' });

    const resposta = await ana.patch(`/api/meus-imoveis/${villa.id}/status`, { status: 'inativo' });
    assert.equal(resposta.status, 409);
    assert.equal(resposta.corpo.erro.mensagem, 'Imóvel tem reservas futuras');
  });

  test('H2.3: sem reservas futuras, desativa e reativa sem apagar', async () => {
    const ana = await entrarComo('anfitriao');
    const villa = await cadastrarVilla(ana);

    const desativado = await ana.patch(`/api/meus-imoveis/${villa.id}/status`, { status: 'inativo' });
    assert.equal(desativado.status, 200);
    assert.equal(desativado.corpo.imovel.status, 'inativo');

    const reativado = await ana.patch(`/api/meus-imoveis/${villa.id}/status`, { status: 'ativo' });
    assert.equal(reativado.corpo.imovel.status, 'ativo');

    const invalido = await ana.patch(`/api/meus-imoveis/${villa.id}/status`, { status: 'apagado' });
    assert.equal(invalido.status, 400);
  });
});
