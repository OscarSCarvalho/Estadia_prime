const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { identificarTipoFoto, validarFotos, TAMANHO_MAXIMO_FOTO_BYTES } = require('../../src/dominio/foto');
const { validarFiltrosBusca, validarFiltrosServicos } = require('../../src/dominio/busca');
const { ErroArquivoInvalido, ErroDadosInvalidos, ErroPeriodoInvalido } = require('../../src/dominio/erros');

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const hoje = '2026-10-12';

describe('fotos (CB15)', () => {
  test('identifica JPG, PNG e WEBP pelos bytes', () => {
    assert.equal(identificarTipoFoto(JPG), 'jpg');
    assert.equal(identificarTipoFoto(PNG), 'png');
    assert.equal(identificarTipoFoto(WEBP), 'webp');
  });

  test('recusa PDF, SVG, HTML disfarçado e arquivos curtos demais', () => {
    assert.equal(identificarTipoFoto(Buffer.from('%PDF-1.7')), null);
    assert.equal(identificarTipoFoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
    assert.equal(identificarTipoFoto(Buffer.from('<script>alert(1)</script>')), null);
    assert.equal(identificarTipoFoto(Buffer.from('RIFF0000AVI LIST')), null, 'RIFF que não é WEBP');
    assert.equal(identificarTipoFoto(Buffer.from([0xff, 0xd8])), null);
    assert.equal(identificarTipoFoto(Buffer.alloc(0)), null);
  });

  test('validarFotos devolve as extensões na ordem e aponta qual arquivo é inválido', () => {
    assert.deepEqual(validarFotos([{ bytes: PNG }, { bytes: JPG }]), ['png', 'jpg']);
    assert.throws(() => validarFotos([{ bytes: JPG }, { bytes: Buffer.from('%PDF') }]), {
      message: 'O arquivo 2 não é uma foto JPG, PNG ou WEBP',
    });
    assert.throws(() => validarFotos([]), ErroArquivoInvalido);
    assert.throws(() => validarFotos(undefined), ErroArquivoInvalido);
  });

  test('foto acima de 5 MB é recusada', () => {
    const grande = Buffer.alloc(TAMANHO_MAXIMO_FOTO_BYTES + 1);
    JPG.copy(grande);
    assert.throws(() => validarFotos([{ bytes: grande }]), { message: 'A foto passa de 5 MB' });
  });
});

describe('filtros da busca (H4.1)', () => {
  test('sem parâmetros: nenhum filtro e página 1', () => {
    assert.deepEqual(validarFiltrosBusca({}, { hoje }), {
      filtros: {
        cidade: null,
        tipo: null,
        hospedes: null,
        precoMin: null,
        precoMax: null,
        servicos: [],
        comInclusos: false,
        checkin: null,
        checkout: null,
      },
      pagina: 1,
    });
  });

  test('converte texto da URL: cidade padronizada, preço em centavos, lista de serviços', () => {
    const { filtros, pagina } = validarFiltrosBusca(
      {
        cidade: '  BÚZIOS ',
        tipo: 'villa',
        hospedes: '6',
        preco_min: '1.000',
        preco_max: '3000,50',
        servicos: 'mordomo, barman,mordomo',
        checkin: '2026-12-21',
        checkout: '2026-12-24',
        pagina: '2',
      },
      { hoje },
    );
    assert.deepEqual(filtros, {
      cidade: 'Búzios',
      tipo: 'villa',
      hospedes: 6,
      precoMin: 100000,
      precoMax: 300050,
      servicos: ['mordomo', 'barman'],
      comInclusos: false,
      checkin: '2026-12-21',
      checkout: '2026-12-24',
    });
    assert.equal(pagina, 2);
  });

  test('serviços repetidos na URL (?servicos=a&servicos=b) também valem', () => {
    const { filtros } = validarFiltrosBusca({ servicos: ['mordomo', 'barman'] }, { hoje });
    assert.deepEqual(filtros.servicos, ['mordomo', 'barman']);
  });

  test('valores inválidos voltam todos juntos, campo por campo', () => {
    assert.throws(
      () =>
        validarFiltrosBusca(
          { tipo: 'castelo', hospedes: '0', preco_min: 'abc', servicos: 'chef', pagina: '-1' },
          { hoje },
        ),
      (erro) => {
        assert.ok(erro instanceof ErroDadosInvalidos);
        assert.deepEqual(Object.keys(erro.detalhes).sort(), ['hospedes', 'pagina', 'preco_min', 'servicos', 'tipo']);
        return true;
      },
    );
  });

  test('diária mínima maior que a máxima é recusada', () => {
    assert.throws(() => validarFiltrosBusca({ preco_min: '3000', preco_max: '1000' }, { hoje }), ErroDadosInvalidos);
  });

  test('datas: só uma, no passado ou invertidas → período inválido', () => {
    assert.throws(() => validarFiltrosBusca({ checkin: '2026-12-21' }, { hoje }), ErroPeriodoInvalido);
    assert.throws(() => validarFiltrosBusca({ checkin: '2026-10-11', checkout: '2026-10-13' }, { hoje }), ErroPeriodoInvalido);
    assert.throws(() => validarFiltrosBusca({ checkin: '2026-12-24', checkout: '2026-12-21' }, { hoje }), ErroPeriodoInvalido);
  });

  test('filtros de serviços: cidade padronizada e tipo da lista', () => {
    assert.deepEqual(validarFiltrosServicos({ cidade: 'búzios', tipo: 'motorista' }), { cidade: 'Búzios', tipo: 'motorista' });
    assert.deepEqual(validarFiltrosServicos({}), { cidade: null, tipo: null });
    assert.throws(() => validarFiltrosServicos({ tipo: 'chef' }), ErroDadosInvalidos);
  });
});
