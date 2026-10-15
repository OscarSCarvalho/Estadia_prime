import { Link, Navigate, useLocation } from 'react-router';
import { CarregandoSimples } from './Esqueletos.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { PERFIS } from '../utils/perfis.js';

// `perfil` (opcional): área de um perfil só, como os painéis do anfitrião e do prestador
export default function RotaProtegida({ perfil, children }) {
  const { usuario, carregando } = useAuth();
  const localizacao = useLocation();

  if (carregando) return <CarregandoSimples />;

  if (!usuario) {
    // A busca (?checkin=...) volta junto: quem entra pelo carrinho não perde as datas escolhidas
    return <Navigate to="/entrar" replace state={{ voltarPara: localizacao.pathname + localizacao.search }} />;
  }

  if (perfil && usuario.tipo !== perfil) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-titulo text-4xl font-semibold">Área de {PERFIS[perfil].titulo.toLowerCase()}</h1>
        <p className="mt-3 text-grafite">
          Sua conta é de <strong>{PERFIS[usuario.tipo].titulo.toLowerCase()}</strong>. Para usar esta área, entre com
          uma conta de {PERFIS[perfil].titulo.toLowerCase()}.
        </p>
        <Link to="/" className="mt-8 inline-block rounded-full bg-tinta px-6 py-3 font-medium text-marfim hover:bg-grafite">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return children;
}
