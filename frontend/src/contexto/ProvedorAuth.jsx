import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContexto } from './AuthContexto.js';
import * as servicoAuth from '../services/auth.js';

export function ProvedorAuth({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    servicoAuth
      .obterUsuarioLogado()
      .then((usuarioLogado) => ativo && setUsuario(usuarioLogado))
      .catch(() => ativo && setUsuario(null))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  const entrar = useCallback(async (email, senha) => {
    const usuarioLogado = await servicoAuth.entrar(email, senha);
    setUsuario(usuarioLogado);
    return usuarioLogado;
  }, []);

  const cadastrar = useCallback(async (dados) => {
    const usuarioCriado = await servicoAuth.cadastrar(dados);
    setUsuario(usuarioCriado);
    return usuarioCriado;
  }, []);

  const sair = useCallback(async () => {
    await servicoAuth.sair();
    setUsuario(null);
  }, []);

  // Depois de mudar um dado da conta na API (ex.: o CPF), a tela usa o usuário devolvido por ela
  const atualizarUsuario = useCallback((usuarioAtualizado) => setUsuario(usuarioAtualizado), []);

  const valor = useMemo(
    () => ({ usuario, carregando, entrar, cadastrar, sair, atualizarUsuario }),
    [usuario, carregando, entrar, cadastrar, sair, atualizarUsuario],
  );

  return <AuthContexto.Provider value={valor}>{children}</AuthContexto.Provider>;
}
