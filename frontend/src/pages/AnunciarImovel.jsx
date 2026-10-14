import { Link, Navigate } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';
import { PERFIS } from '../utils/perfis.js';

// "Anunciar imóvel" (cabeçalho e início): o anfitrião segue direto para o cadastro no painel
export default function AnunciarImovel() {
  const { usuario } = useAuth();

  if (usuario.tipo === 'anfitriao') return <Navigate to="/painel/imoveis/novo" replace />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-ouro-escuro">Anunciar imóvel</p>
      <h1 className="mt-2 font-titulo text-5xl font-semibold">Anúncios são feitos por anfitriões</h1>
      <p className="mt-4 text-grafite">
        Sua conta é de <strong>{PERFIS[usuario.tipo].titulo.toLowerCase()}</strong>. Para anunciar um imóvel, crie uma
        conta de anfitrião com outro e-mail.
      </p>
      <Link to="/" className="mt-8 inline-block rounded-full bg-tinta px-6 py-3 font-medium text-marfim hover:bg-grafite">
        Voltar aos imóveis
      </Link>
    </div>
  );
}
