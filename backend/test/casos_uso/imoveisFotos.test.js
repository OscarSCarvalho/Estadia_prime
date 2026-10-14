// Casos de uso de imóveis e fotos testados sem banco e sem disco (dublês em memória)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  criarAlterarStatusImovel,
  criarEditarImovel,
} = require('../../src/casos_uso/imoveisDoAnfitriao');
const { criarAdicionarFotos, criarRemoverFoto, criarReordenarFotos } = require('../../src/casos_uso/fotosDoImovel');
const {
  ErroImovelNaoEncontrado,
  ErroImovelComReservasFuturas,
  ErroLimiteFotos,
  ErroArquivoInvalido,
  ErroFotoNaoEncontrada,
  ErroDadosInvalidos,
} = require('../../src/dominio/erros');

const ANA = 1;
const BRUNO = 2;
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

function criarRepositorioImoveisFalso({ reservasFuturas = false } = {}) {
  const imovel = { id: 10, anfitriao_id: ANA, status: 'ativo' };
  return {
    datasConsultadas: [],
    buscarDoAnfitriao: (id, anfitriaoId) => (id === imovel.id && anfitriaoId === imovel.anfitriao_id ? imovel : null),
    atualizar: (id, anfitriaoId, dados) => (id === imovel.id && anfitriaoId === ANA ? { ...imovel, ...dados } : null),
    alterarStatus: (_id, _anfitriaoId, status) => ({ ...imovel, status }),
    possuiReservasFuturas(_id, hoje) {
      this.datasConsultadas.push(hoje);
      return reservasFuturas;
    },
  };
}

function criarRepositorioFotosFalso({ jaTem = 0, falharAoAdicionar = false } = {}) {
  let fotos = Array.from({ length: jaTem }, (_, posicao) => ({ id: posicao + 1, url_foto: `/uploads/antiga-${posicao}.jpg` }));
  return {
    contar: () => fotos.length,
    listar: () => fotos,
    adicionar(_imovelId, urls, limite) {
      if (falharAoAdicionar) throw new ErroLimiteFotos(limite);
      fotos = [...fotos, ...urls.map((url, posicao) => ({ id: 100 + posicao, url_foto: url }))];
      return fotos;
    },
    remover(fotoId) {
      const foto = fotos.find((item) => item.id === fotoId);
      fotos = fotos.filter((item) => item !== foto);
      return foto ?? null;
    },
    reordenar: (_imovelId, ids) => (ids.length === fotos.length ? ids.map((id) => ({ id })) : null),
  };
}

function criarArmazenamentoFalso() {
  let contador = 0;
  return {
    salvos: [],
    apagados: [],
    async salvar(_bytes, extensao) {
      contador += 1;
      const url = `/uploads/nova-${contador}.${extensao}`;
      this.salvos.push(url);
      return url;
    },
    async apagar(url) {
      this.apagados.push(url);
    },
  };
}

describe('alterar status do imóvel (H2.3, CB06)', () => {
  test('desativar com reserva futura → ErroImovelComReservasFuturas, usando o "hoje" de Brasília', () => {
    const repositorioImoveis = criarRepositorioImoveisFalso({ reservasFuturas: true });
    const alterarStatusImovel = criarAlterarStatusImovel({ repositorioImoveis, hoje: () => '2026-10-12' });

    assert.throws(() => alterarStatusImovel(ANA, 10, 'inativo'), ErroImovelComReservasFuturas);
    assert.deepEqual(repositorioImoveis.datasConsultadas, ['2026-10-12']);
  });

  test('ativar não consulta reservas; imóvel de outro anfitrião → não encontrado', () => {
    const repositorioImoveis = criarRepositorioImoveisFalso({ reservasFuturas: true });
    const alterarStatusImovel = criarAlterarStatusImovel({ repositorioImoveis, hoje: () => '2026-10-12' });

    assert.equal(alterarStatusImovel(ANA, 10, 'ativo').status, 'ativo');
    assert.deepEqual(repositorioImoveis.datasConsultadas, []);
    assert.throws(() => alterarStatusImovel(BRUNO, 10, 'ativo'), ErroImovelNaoEncontrado);
    assert.throws(() => alterarStatusImovel(ANA, 10, 'pausado'), ErroDadosInvalidos);
  });

  test('editar imóvel de outro anfitrião → não encontrado (não revela que existe)', () => {
    const editarImovel = criarEditarImovel({ repositorioImoveis: criarRepositorioImoveisFalso() });
    const dados = {
      titulo: 'Villa Vista Mar',
      tipo_imovel: 'villa',
      endereco: 'Rua das Ondas, 10',
      cidade: 'Búzios',
      estado: 'RJ',
      diaria: 2500,
      num_hospedes: 8,
      num_quartos: 4,
    };
    assert.throws(() => editarImovel(BRUNO, 10, dados), ErroImovelNaoEncontrado);
    assert.equal(editarImovel(ANA, 10, dados).preco_diaria, 250000);
  });
});

describe('fotos do imóvel (H2.2)', () => {
  function montar(opcoesFotos) {
    const armazenamentoFotos = criarArmazenamentoFalso();
    const dependencias = {
      repositorioImoveis: criarRepositorioImoveisFalso(),
      repositorioFotos: criarRepositorioFotosFalso(opcoesFotos),
      armazenamentoFotos,
    };
    return {
      armazenamentoFotos,
      adicionarFotos: criarAdicionarFotos(dependencias),
      removerFoto: criarRemoverFoto(dependencias),
      reordenarFotos: criarReordenarFotos(dependencias),
    };
  }

  test('salva as fotos na ordem enviada, com a extensão vinda dos bytes', async () => {
    const { adicionarFotos, armazenamentoFotos } = montar();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fotos = await adicionarFotos(ANA, 10, [{ bytes: JPG }, { bytes: png }]);
    assert.deepEqual(fotos.map((foto) => foto.url_foto), ['/uploads/nova-1.jpg', '/uploads/nova-2.png']);
    assert.deepEqual(armazenamentoFotos.apagados, []);
  });

  test('um arquivo inválido no meio: nenhum arquivo vai para o disco', async () => {
    const { adicionarFotos, armazenamentoFotos } = montar();
    await assert.rejects(adicionarFotos(ANA, 10, [{ bytes: JPG }, { bytes: Buffer.from('%PDF') }]), ErroArquivoInvalido);
    assert.deepEqual(armazenamentoFotos.salvos, []);
  });

  test('imóvel com 10 fotos: a 11ª é recusada antes de gravar', async () => {
    const { adicionarFotos, armazenamentoFotos } = montar({ jaTem: 10 });
    await assert.rejects(adicionarFotos(ANA, 10, [{ bytes: JPG }]), { message: 'Limite de 10 fotos' });
    assert.deepEqual(armazenamentoFotos.salvos, []);
  });

  test('se o banco recusar (envio simultâneo), os arquivos gravados são apagados', async () => {
    const { adicionarFotos, armazenamentoFotos } = montar({ falharAoAdicionar: true });
    await assert.rejects(adicionarFotos(ANA, 10, [{ bytes: JPG }, { bytes: JPG }]), ErroLimiteFotos);
    assert.deepEqual(armazenamentoFotos.apagados, armazenamentoFotos.salvos);
    assert.equal(armazenamentoFotos.salvos.length, 2);
  });

  test('imóvel de outro anfitrião → não encontrado, sem gravar nada', async () => {
    const { adicionarFotos, armazenamentoFotos } = montar();
    await assert.rejects(adicionarFotos(BRUNO, 10, [{ bytes: JPG }]), ErroImovelNaoEncontrado);
    assert.deepEqual(armazenamentoFotos.salvos, []);
  });

  test('remover apaga o arquivo; foto de outro imóvel → não encontrada', async () => {
    const { removerFoto, armazenamentoFotos } = montar({ jaTem: 2 });
    const restantes = await removerFoto(ANA, 10, 1);
    assert.deepEqual(restantes.map((foto) => foto.id), [2]);
    assert.deepEqual(armazenamentoFotos.apagados, ['/uploads/antiga-0.jpg']);
    await assert.rejects(removerFoto(ANA, 10, 99), ErroFotoNaoEncontrada);
  });

  test('reordenar exige a lista completa de ids inteiros', () => {
    const { reordenarFotos } = montar({ jaTem: 2 });
    assert.deepEqual(reordenarFotos(ANA, 10, [2, 1]).map((foto) => foto.id), [2, 1]);
    assert.throws(() => reordenarFotos(ANA, 10, [2]), ErroDadosInvalidos);
    assert.throws(() => reordenarFotos(ANA, 10, ['2', '1']), ErroDadosInvalidos);
    assert.throws(() => reordenarFotos(ANA, 10, 'tudo'), ErroDadosInvalidos);
  });
});
