import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router';
import Cabecalho from './Cabecalho.jsx';

// Numa troca de página o navegador não faz nada sozinho (é tudo a mesma página por baixo):
// volta ao topo e leva o foco ao conteúdo novo, para o teclado e o leitor de tela começarem dali.
// No "voltar" do navegador a posição da rolagem é mantida
function useFocoNaTrocaDePagina() {
  const { pathname } = useLocation();
  const tipoNavegacao = useNavigationType();
  const conteudo = useRef(null);
  const caminhoAnterior = useRef(pathname);

  useEffect(() => {
    if (caminhoAnterior.current === pathname) return;
    caminhoAnterior.current = pathname;
    if (tipoNavegacao !== 'POP') window.scrollTo(0, 0);
    conteudo.current?.focus({ preventScroll: true });
  }, [pathname, tipoNavegacao]);

  return conteudo;
}

export default function Layout() {
  const conteudo = useFocoNaTrocaDePagina();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-tinta focus:px-4 focus:py-2 focus:text-marfim"
      >
        Pular para o conteúdo
      </a>
      <Cabecalho />
      <main id="conteudo" ref={conteudo} tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <footer className="border-t border-linha py-8 text-center text-sm text-grafite">
        © {new Date().getFullYear()} Estadia Prime · Hospedagem de alto padrão com serviços exclusivos
      </footer>
    </div>
  );
}
