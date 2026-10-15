import { useId } from 'react';
import Icone from './Icone.jsx';

// Janela modal sobre a página (<dialog> nativo: prende o foco, fecha com Esc e devolve o foco ao botão que abriu).
// Quem usa abre com `referencia.current.showModal()`. `aoFechar` roda em qualquer fechamento (X, Esc, clique fora).
// `children` ocupa o espaço abaixo do cabeçalho: para rolar, use `min-h-0 flex-1 overflow-y-auto`
export default function Janela({ referencia, titulo, rotuloFechar = 'Fechar', aoFechar, largura = 'max-w-xl', children }) {
  const idTitulo = useId();

  function fechar() {
    referencia.current.close();
  }

  return (
    <dialog
      ref={referencia}
      onClose={aoFechar}
      onClick={(evento) => evento.target === referencia.current && fechar()}
      aria-labelledby={idTitulo}
      className={`m-auto w-[calc(100%-2rem)] ${largura} rounded-2xl bg-white p-0 text-tinta shadow-2xl backdrop:bg-tinta/60 backdrop:backdrop-blur-[2px]`}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <header className="relative shrink-0 border-b border-linha px-14 py-4 text-center">
          <h2 id={idTitulo} className="truncate font-semibold">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={fechar}
            aria-label={rotuloFechar}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-2 hover:bg-areia"
          >
            <Icone nome="fechar" tamanho={18} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
