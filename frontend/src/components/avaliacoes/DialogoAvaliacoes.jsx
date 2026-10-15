import { useRef, useState } from 'react';
import Janela from '../Janela.jsx';
import ListaAvaliacoes from './ListaAvaliacoes.jsx';

// Botão "N avaliações" que abre os comentários de um serviço/prestador numa janela (H7.2)
export default function DialogoAvaliacoes({ alvo, titulo, total }) {
  const referencia = useRef(null);
  const [aberto, setAberto] = useState(false);

  function abrir() {
    setAberto(true);
    referencia.current.showModal();
  }

  return (
    <>
      <button type="button" onClick={abrir} className="font-medium text-tinta underline underline-offset-4 hover:text-ouro-escuro">
        {total} {total === 1 ? 'avaliação' : 'avaliações'}
      </button>

      <Janela referencia={referencia} titulo={titulo} rotuloFechar="Fechar avaliações" aoFechar={() => setAberto(false)}>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{aberto && <ListaAvaliacoes alvo={alvo} />}</div>
      </Janela>
    </>
  );
}
