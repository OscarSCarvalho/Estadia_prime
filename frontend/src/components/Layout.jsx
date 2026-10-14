import { Outlet } from 'react-router';
import Cabecalho from './Cabecalho.jsx';

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-tinta focus:px-4 focus:py-2 focus:text-marfim"
      >
        Pular para o conteúdo
      </a>
      <Cabecalho />
      <main id="conteudo" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-linha py-8 text-center text-sm text-grafite">
        © {new Date().getFullYear()} Estadia Prime · Hospedagem de alto padrão com serviços exclusivos
      </footer>
    </div>
  );
}
