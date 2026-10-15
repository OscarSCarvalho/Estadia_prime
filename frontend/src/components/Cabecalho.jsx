import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import Marca from './Marca.jsx';
import Icone from './Icone.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { PERFIS } from '../utils/perfis.js';

// Visitante vê "Anunciar imóvel"; cada perfil logado vê as próprias áreas
const LINKS_DO_PERFIL = {
  hospede: [{ para: '/minhas-reservas', rotulo: 'Minhas reservas' }],
  anfitriao: [
    { para: '/painel/imoveis', rotulo: 'Meus imóveis' },
    { para: '/painel/reservas', rotulo: 'Reservas' },
  ],
  prestador: [
    { para: '/painel/servicos', rotulo: 'Meus serviços' },
    { para: '/painel/agenda', rotulo: 'Agenda' },
  ],
};
const LINKS_VISITANTE = [{ para: '/anunciar', rotulo: 'Anunciar imóvel' }];

// Na página inicial o cabeçalho fica sobre a foto até a pessoa rolar a página
const ROLAGEM_PARA_FUNDO = 24;
function inscreverRolagem(avisar) {
  window.addEventListener('scroll', avisar, { passive: true });
  return () => window.removeEventListener('scroll', avisar);
}
const rolouAPagina = () => window.scrollY > ROLAGEM_PARA_FUNDO;

// Links do cabeçalho são botões com borda; o da página atual fica com a borda dourada
const estiloBotaoNav = (sobreFoto) => ({ isActive }) =>
  `whitespace-nowrap rounded-full border px-4 py-2 font-medium transition-colors ${
    sobreFoto
      ? `text-marfim hover:border-marfim hover:bg-white/10 ${isActive ? 'border-ouro' : 'border-marfim/50'}`
      : `text-tinta hover:border-tinta ${isActive ? 'border-ouro-escuro bg-white' : 'border-borda'}`
  }`;

const estiloItemMenu = ({ isActive }) =>
  `flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-areia ${isActive ? 'bg-areia/70' : ''}`;

function iniciais(nome) {
  return nome.trim().charAt(0).toUpperCase();
}

// Botão com ☰ e a bolinha da inicial; abre um cartão com a conta e os atalhos.
// Fecha ao escolher, com Esc, ao clicar fora ou ao trocar de página.
// Para o visitante só existe no celular (no computador os links já estão à mostra)
function MenuConta({ links, usuario, aoSair, sobreFoto }) {
  const [aberto, setAberto] = useState(false);
  const { pathname } = useLocation();
  const [caminhoAberto, setCaminhoAberto] = useState(pathname);
  const area = useRef(null);
  const botao = useRef(null);

  if (aberto && caminhoAberto !== pathname) {
    setAberto(false);
  }

  useEffect(() => {
    if (!aberto) return undefined;
    function aoClicarFora(evento) {
      if (!area.current.contains(evento.target)) setAberto(false);
    }
    document.addEventListener('pointerdown', aoClicarFora);
    return () => document.removeEventListener('pointerdown', aoClicarFora);
  }, [aberto]);

  function alternar() {
    setCaminhoAberto(pathname);
    setAberto((atual) => !atual);
  }

  function aoTeclar(evento) {
    if (evento.key === 'Escape' && aberto) {
      setAberto(false);
      botao.current.focus();
    }
  }

  const fechar = () => setAberto(false);

  return (
    <div ref={area} onKeyDown={aoTeclar} className={`relative ${usuario ? '' : 'md:hidden'}`}>
      <button
        ref={botao}
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        aria-controls="menu-conta"
        aria-label={usuario ? `Menu da conta de ${usuario.nome.split(' ')[0]}` : 'Menu'}
        className={`flex h-11 items-center gap-2.5 rounded-full border pl-3.5 transition-colors ${usuario ? 'pr-1.5' : 'pr-3.5'} ${
          sobreFoto
            ? 'border-marfim/40 text-marfim hover:border-marfim hover:bg-white/10'
            : 'border-linha bg-white text-tinta shadow-sm hover:border-tinta hover:shadow-md'
        }`}
      >
        <Icone nome={aberto ? 'fechar' : 'menu'} tamanho={18} />
        {usuario && (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-tinta font-titulo text-lg font-semibold text-ouro ring-1 ring-ouro/60"
          >
            {iniciais(usuario.nome)}
          </span>
        )}
      </button>

      <nav
        id="menu-conta"
        aria-label={usuario ? 'Sua conta' : 'Menu'}
        hidden={!aberto}
        className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-linha bg-white py-2 text-tinta shadow-[0_12px_32px_rgba(28,27,31,0.16)]"
      >
        {usuario && (
          <div className="flex items-center gap-3 border-b border-linha px-5 pb-4 pt-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tinta font-titulo text-xl font-semibold text-ouro ring-1 ring-ouro/60"
            >
              {iniciais(usuario.nome)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{usuario.nome}</p>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-ouro-escuro">{PERFIS[usuario.tipo].titulo}</p>
            </div>
          </div>
        )}
        <ul className="py-1">
          {/* "Explorar" já aparece no cabeçalho do computador */}
          <li className="md:hidden">
            <NavLink to="/explorar" onClick={fechar} className={estiloItemMenu}>
              Explorar
            </NavLink>
          </li>
          {links.map(({ para, rotulo }) => (
            <li key={para} className={usuario ? '' : 'md:hidden'}>
              <NavLink to={para} onClick={fechar} className={estiloItemMenu}>
                {rotulo}
              </NavLink>
            </li>
          ))}
          {usuario && (
            <li>
              <NavLink to="/minha-conta" onClick={fechar} className={estiloItemMenu}>
                Minha conta
              </NavLink>
            </li>
          )}
        </ul>
        {usuario && (
          <div className="border-t border-linha pt-1">
            <button type="button" onClick={aoSair} className="w-full px-5 py-3 text-left text-sm font-medium text-grafite hover:bg-areia hover:text-tinta">
              Sair
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}

export default function Cabecalho() {
  const { usuario, carregando, sair } = useAuth();
  const navegar = useNavigate();
  const naInicio = useLocation().pathname === '/';
  const rolou = useSyncExternalStore(inscreverRolagem, rolouAPagina);
  const sobreFoto = naInicio && !rolou;
  const links = usuario ? (LINKS_DO_PERFIL[usuario.tipo] ?? []) : LINKS_VISITANTE;

  async function aoSair() {
    await sair();
    navegar('/');
  }

  return (
    <header
      className={`z-30 border-b transition-colors duration-300 ${naInicio ? 'fixed inset-x-0 top-0' : 'relative'} ${
        sobreFoto ? 'border-transparent bg-transparent' : 'border-linha bg-marfim/95 backdrop-blur'
      }`}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Marca clara={sobreFoto} />
        {/* Enquanto confere o login, guarda o espaço para o cabeçalho não pular */}
        {carregando ? (
          <span aria-hidden="true" className="h-11 w-24" />
        ) : (
          <div className="flex items-center gap-2 sm:gap-3">
            <nav aria-label="Principal" className="hidden items-center gap-2 text-sm md:flex lg:gap-3">
              <NavLink to="/explorar" className={estiloBotaoNav(sobreFoto)}>
                Explorar
              </NavLink>
              {links.map(({ para, rotulo }) => (
                <NavLink key={para} to={para} className={estiloBotaoNav(sobreFoto)}>
                  {rotulo}
                </NavLink>
              ))}
            </nav>
            {!usuario && (
              <Link
                to="/entrar"
                className={`rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                  sobreFoto ? 'bg-marfim text-tinta hover:bg-ouro' : 'bg-tinta text-marfim hover:bg-grafite'
                }`}
              >
                Entrar
              </Link>
            )}
            <MenuConta links={links} usuario={usuario} aoSair={aoSair} sobreFoto={sobreFoto} />
          </div>
        )}
      </div>
    </header>
  );
}
