import { Link, useNavigate } from 'react-router';
import Marca from './Marca.jsx';
import { useAuth } from '../hooks/useAuth.js';

export default function Cabecalho() {
  const { usuario, carregando, sair } = useAuth();
  const navegar = useNavigate();
  // Visitante vê "Anunciar imóvel"; cada perfil logado vê as próprias áreas
  const linksDoPerfil = {
    hospede: [{ para: '/minhas-reservas', rotulo: 'Minhas reservas' }],
    anfitriao: [
      { para: '/painel/imoveis', rotulo: 'Meus imóveis' },
      { para: '/painel/reservas', rotulo: 'Reservas' },
    ],
    prestador: [
      { para: '/painel/servicos', rotulo: 'Meus serviços' },
      { para: '/painel/agenda', rotulo: 'Agenda' },
    ],
  }[usuario?.tipo] ?? (usuario ? [] : [{ para: '/anunciar', rotulo: 'Anunciar imóvel' }]);

  async function aoSair() {
    await sair();
    navegar('/');
  }

  return (
    <header className="border-b border-linha bg-marfim/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Marca />
        {!carregando && (
          <nav aria-label="Principal" className="flex items-center gap-1 text-sm sm:gap-3">
            <Link to="/explorar" className="rounded-full px-3 py-2 font-medium text-tinta hover:bg-areia">
              Explorar
            </Link>
            {linksDoPerfil.map(({ para, rotulo }) => (
              <Link
                key={para}
                to={para}
                className="hidden whitespace-nowrap rounded-full px-3 py-2 font-medium text-tinta hover:bg-areia md:inline-block"
              >
                {rotulo}
              </Link>
            ))}
            {usuario ? (
              <>
                <Link to="/minha-conta" className="whitespace-nowrap rounded-full px-3 py-2 font-medium text-tinta hover:bg-areia">
                  Olá, {usuario.nome.split(' ')[0]}
                </Link>
                <button
                  type="button"
                  onClick={aoSair}
                  className="rounded-full px-3 py-2 text-grafite hover:bg-areia hover:text-tinta"
                >
                  Sair
                </button>
              </>
            ) : (
              <Link to="/entrar" className="rounded-full bg-tinta px-5 py-2 font-medium text-marfim hover:bg-grafite">
                Entrar
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
