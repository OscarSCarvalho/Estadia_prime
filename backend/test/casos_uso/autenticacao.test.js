// Casos de uso testados sem banco: repositório e serviço de senha são falsos (dublês em memória)
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { criarCadastrarUsuario } = require('../../src/casos_uso/cadastrarUsuario');
const { criarAutenticarUsuario } = require('../../src/casos_uso/autenticarUsuario');
const { criarObterUsuario } = require('../../src/casos_uso/obterUsuario');
const { criarLimitadorTentativasMemoria } = require('../../src/adaptadores/limitadorTentativasMemoria');
const {
  ErroEmailJaCadastrado,
  ErroCredenciaisInvalidas,
  ErroMuitasTentativas,
  ErroUsuarioNaoEncontrado,
} = require('../../src/dominio/erros');

function criarRepositorioFalso() {
  const usuarios = [];
  return {
    usuarios,
    buscarPorEmail: (email) => usuarios.find((u) => u.email === email) ?? null,
    buscarPorId: (id) => usuarios.find((u) => u.id === id) ?? null,
    inserir(dados) {
      const usuario = { id: usuarios.length + 1, data_cadastro: '2026-10-11 12:00:00', ...dados };
      usuarios.push(usuario);
      return usuario;
    },
  };
}

const servicoSenhaFalso = {
  comparacoesSemHash: 0,
  gerarHash: async (senha) => `hash:${senha}`,
  async comparar(senha, hash) {
    if (!hash) {
      this.comparacoesSemHash += 1;
      return false;
    }
    return hash === `hash:${senha}`;
  },
};

const novoHospede = { nome: 'Hugo', email: 'Hugo@Teste.com', senha: 'senha12345', tipo: 'hospede' };

describe('cadastrarUsuario', () => {
  let repositorio;
  let cadastrarUsuario;

  beforeEach(() => {
    repositorio = criarRepositorioFalso();
    cadastrarUsuario = criarCadastrarUsuario({ repositorioUsuarios: repositorio, servicoSenha: servicoSenhaFalso });
  });

  test('grava o hash da senha, nunca a senha', async () => {
    const usuario = await cadastrarUsuario(novoHospede);
    assert.equal(usuario.email, 'hugo@teste.com');
    assert.equal(repositorio.usuarios[0].senha_hash, 'hash:senha12345');
    assert.equal('senha' in repositorio.usuarios[0], false);
    assert.equal('senha_hash' in usuario, false);
  });

  test('recusa e-mail já cadastrado, sem diferenciar maiúsculas', async () => {
    await cadastrarUsuario(novoHospede);
    await assert.rejects(cadastrarUsuario({ ...novoHospede, email: 'HUGO@teste.com' }), ErroEmailJaCadastrado);
  });
});

describe('autenticarUsuario', () => {
  let instante;
  let autenticarUsuario;

  beforeEach(async () => {
    instante = 0;
    const repositorio = criarRepositorioFalso();
    await criarCadastrarUsuario({ repositorioUsuarios: repositorio, servicoSenha: servicoSenhaFalso })(novoHospede);
    autenticarUsuario = criarAutenticarUsuario({
      repositorioUsuarios: repositorio,
      servicoSenha: servicoSenhaFalso,
      limitadorTentativas: criarLimitadorTentativasMemoria({ agora: () => instante }),
    });
  });

  const tentar = (senha, email = 'hugo@teste.com') => autenticarUsuario({ email, senha, origem: '1.2.3.4' });

  test('entra com e-mail em qualquer caixa e senha correta', async () => {
    const usuario = await tentar('senha12345', ' HUGO@teste.com ');
    assert.equal(usuario.nome, 'Hugo');
  });

  test('senha errada e e-mail inexistente dão o mesmo erro', async () => {
    await assert.rejects(tentar('errada123'), ErroCredenciaisInvalidas);
    await assert.rejects(tentar('senha12345', 'naoexiste@teste.com'), ErroCredenciaisInvalidas);
  });

  test('e-mail inexistente ainda passa pela comparação de senha (tempo constante)', async () => {
    const antes = servicoSenhaFalso.comparacoesSemHash;
    await assert.rejects(tentar('qualquer123', 'naoexiste@teste.com'));
    assert.equal(servicoSenhaFalso.comparacoesSemHash, antes + 1);
  });

  test('bloqueia após 5 erros em 15 minutos, mesmo com a senha certa', async () => {
    for (let i = 0; i < 5; i++) await assert.rejects(tentar('errada123'), ErroCredenciaisInvalidas);
    await assert.rejects(tentar('senha12345'), ErroMuitasTentativas);
  });

  test('libera depois que a janela de 15 minutos passa', async () => {
    for (let i = 0; i < 5; i++) await assert.rejects(tentar('errada123'));
    instante += 15 * 60 * 1000;
    assert.equal((await tentar('senha12345')).nome, 'Hugo');
  });

  test('login certo zera o contador de erros', async () => {
    for (let i = 0; i < 4; i++) await assert.rejects(tentar('errada123'));
    await tentar('senha12345');
    for (let i = 0; i < 4; i++) await assert.rejects(tentar('errada123'), ErroCredenciaisInvalidas);
  });

  test('senha que não é texto é tratada como errada', async () => {
    await assert.rejects(autenticarUsuario({ email: 'hugo@teste.com', senha: { $ne: '' }, origem: 'x' }), ErroCredenciaisInvalidas);
  });
});

describe('obterUsuario', () => {
  test('erro específico quando o usuário não existe', () => {
    const obterUsuario = criarObterUsuario({ repositorioUsuarios: criarRepositorioFalso() });
    assert.throws(() => obterUsuario(99), ErroUsuarioNaoEncontrado);
  });
});
