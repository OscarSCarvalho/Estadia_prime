import { useState } from 'react';
import CampoTexto from './CampoTexto.jsx';
import CampoSenha from './CampoSenha.jsx';
import Botao from './Botao.jsx';
import Alerta from './Alerta.jsx';
import { useAuth } from '../hooks/useAuth.js';

export default function FormularioLogin({ aoEntrar }) {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState('');

  async function aoEnviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setMensagemErro('');
    try {
      const usuario = await entrar(email, senha);
      aoEntrar(usuario);
    } catch (erro) {
      setMensagemErro(erro.message);
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-5" noValidate>
      <Alerta>{mensagemErro}</Alerta>
      <CampoTexto
        rotulo="E-mail"
        type="email"
        autoComplete="email"
        placeholder="voce@email.com"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <CampoSenha
        rotulo="Senha"
        autoComplete="current-password"
        required
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
      />
      <Botao carregando={enviando} textoCarregando="Entrando…">
        Entrar
      </Botao>
    </form>
  );
}
