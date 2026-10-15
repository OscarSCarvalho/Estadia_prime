import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import CartaoFormulario from '../components/CartaoFormulario.jsx';
import CampoTexto from '../components/CampoTexto.jsx';
import CampoSenha from '../components/CampoSenha.jsx';
import Botao from '../components/Botao.jsx';
import Alerta from '../components/Alerta.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useTituloPagina } from '../hooks/useTituloPagina.js';
import { PERFIS, ORDEM_PERFIS } from '../utils/perfis.js';

const FORMULARIO_VAZIO = { nome: '', email: '', telefone: '', senha: '', tipo: 'hospede' };

// Quem chegou aqui tentando anunciar um imóvel já começa com o perfil de anfitrião marcado
const PERFIL_SUGERIDO_POR_DESTINO = { '/anunciar': 'anfitriao' };

function EscolhaPerfil({ valor, aoMudar, erro }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-tinta">Como você vai usar a Estadia Prime?</legend>
      <div className="mt-3 grid gap-3">
        {ORDEM_PERFIS.map((tipo) => {
          const selecionado = valor === tipo;
          return (
            <label
              key={tipo}
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ouro-escuro ${
                selecionado ? 'border-tinta bg-areia' : 'border-linha hover:border-grafite'
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={tipo}
                checked={selecionado}
                onChange={() => aoMudar(tipo)}
                className="mt-1 accent-tinta"
              />
              <span>
                <span className="block font-medium">{PERFIS[tipo].titulo}</span>
                <span className="block text-sm text-grafite">{PERFIS[tipo].descricao}</span>
              </span>
            </label>
          );
        })}
      </div>
      {erro && <p className="mt-2 text-sm text-erro">{erro}</p>}
    </fieldset>
  );
}

export default function Cadastro() {
  const { usuario, cadastrar } = useAuth();
  const navegar = useNavigate();
  const voltarPara = useLocation().state?.voltarPara;
  const destinoAposCadastro = voltarPara ?? '/minha-conta';
  useTituloPagina('Criar conta');

  const [formulario, setFormulario] = useState(() => ({
    ...FORMULARIO_VAZIO,
    tipo: PERFIL_SUGERIDO_POR_DESTINO[voltarPara] ?? FORMULARIO_VAZIO.tipo,
  }));
  const [errosCampos, setErrosCampos] = useState({});
  const [mensagemErro, setMensagemErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario && !enviando) return <Navigate to={destinoAposCadastro} replace />;

  function atualizar(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
    setErrosCampos((atuais) => ({ ...atuais, [campo]: undefined }));
  }

  async function aoEnviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setMensagemErro('');
    setErrosCampos({});
    try {
      await cadastrar(formulario);
      navegar(destinoAposCadastro, { replace: true });
    } catch (erro) {
      if (erro.codigo === 'DADOS_INVALIDOS') {
        setErrosCampos(erro.detalhes);
        setMensagemErro('Revise os campos destacados.');
      } else if (erro.codigo === 'EMAIL_JA_CADASTRADO') {
        setErrosCampos({ email: 'Este e-mail já tem conta. Que tal entrar?' });
      } else {
        setMensagemErro(erro.message);
      }
      setEnviando(false);
    }
  }

  return (
    <CartaoFormulario
      titulo="Criar conta"
      subtitulo="Leva menos de um minuto."
      rodape={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" state={{ voltarPara }} className="font-medium text-ouro-escuro underline-offset-4 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={aoEnviar} className="flex flex-col gap-5" noValidate>
        <Alerta>{mensagemErro}</Alerta>
        <EscolhaPerfil valor={formulario.tipo} aoMudar={(tipo) => atualizar('tipo', tipo)} erro={errosCampos.tipo} />
        <CampoTexto
          rotulo="Nome completo"
          autoComplete="name"
          required
          value={formulario.nome}
          onChange={(e) => atualizar('nome', e.target.value)}
          erro={errosCampos.nome}
        />
        <CampoTexto
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          required
          value={formulario.email}
          onChange={(e) => atualizar('email', e.target.value)}
          erro={errosCampos.email}
        />
        <CampoTexto
          rotulo="Telefone (opcional)"
          type="tel"
          autoComplete="tel"
          placeholder="(21) 99999-0000"
          value={formulario.telefone}
          onChange={(e) => atualizar('telefone', e.target.value)}
          erro={errosCampos.telefone}
        />
        <CampoSenha
          rotulo="Senha"
          autoComplete="new-password"
          required
          value={formulario.senha}
          onChange={(e) => atualizar('senha', e.target.value)}
          erro={errosCampos.senha}
          ajuda="Mínimo de 8 caracteres."
        />
        <Botao carregando={enviando} textoCarregando="Criando conta…">
          Criar conta
        </Botao>
      </form>
    </CartaoFormulario>
  );
}
