import { useId, useRef, useState } from 'react';
import Icone from '../Icone.jsx';
import ListaAvaliacoes from './ListaAvaliacoes.jsx';

// Botão "N avaliações" que abre os comentários de um serviço/prestador numa janela (H7.2)
export default function DialogoAvaliacoes({ alvo, titulo, total }) {
  const referencia = useRef(null);
  const idTitulo = useId();
  const [aberto, setAberto] = useState(false);

  function abrir() {
    setAberto(true);
    referencia.current.showModal();
  }

  function fechar() {
    referencia.current.close();
  }

  return (
    <>
      <button type="button" onClick={abrir} className="font-medium text-tinta underline underline-offset-4 hover:text-ouro-escuro">
        {total} {total === 1 ? 'avaliação' : 'avaliações'}
      </button>

      <dialog
        ref={referencia}
        onClose={() => setAberto(false)}
        onClick={(evento) => evento.target === referencia.current && fechar()}
        aria-labelledby={idTitulo}
        className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl bg-white p-0 text-tinta shadow-2xl backdrop:bg-tinta/50"
      >
        <div className="flex max-h-[85dvh] flex-col">
          <header className="relative border-b border-linha px-14 py-4 text-center">
            <h2 id={idTitulo} className="truncate font-semibold">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar avaliações"
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-2 hover:bg-areia"
            >
              <Icone nome="fechar" tamanho={18} />
            </button>
          </header>
          <div className="overflow-y-auto px-6 py-6">{aberto && <ListaAvaliacoes alvo={alvo} />}</div>
        </div>
      </dialog>
    </>
  );
}
