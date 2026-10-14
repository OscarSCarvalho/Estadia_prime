import { Link } from 'react-router';

export default function NaoEncontrada() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-titulo text-7xl font-semibold text-ouro">404</p>
      <h1 className="mt-4 font-titulo text-3xl font-semibold">Página não encontrada</h1>
      <p className="mt-3 text-grafite">O endereço pode ter mudado ou não existe.</p>
      <Link to="/" className="mt-8 inline-block rounded-full bg-tinta px-6 py-3 font-medium text-marfim hover:bg-grafite">
        Voltar ao início
      </Link>
    </div>
  );
}
