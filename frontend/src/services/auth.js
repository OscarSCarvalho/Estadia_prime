import { api, ErroApi } from './api.js';

export async function cadastrar(dados) {
  const { usuario } = await api.post('/auth/cadastro', dados);
  return usuario;
}

export async function entrar(email, senha) {
  const { usuario } = await api.post('/auth/login', { email, senha });
  return usuario;
}

export async function sair() {
  await api.post('/auth/logout');
}

export async function obterUsuarioLogado() {
  try {
    const { usuario } = await api.get('/auth/eu');
    return usuario;
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 401) return null;
    throw erro;
  }
}
