import { useCallback, useRef, useState } from 'react';
import Janela from '../components/Janela.jsx';

// Pergunta de confirmação no estilo do site, no lugar do window.confirm do navegador.
// Uso: `const [confirmar, janelaConfirmacao] = useConfirmacao();` + `{janelaConfirmacao}` na tela, e
// `if (!(await confirmar({ titulo, texto, rotuloConfirmar }))) return;`
export function useConfirmacao() {
  const referencia = useRef(null);
  const botaoCancelar = useRef(null);
  const resolver = useRef(null);
  const [pergunta, setPergunta] = useState({ titulo: '', texto: '', rotuloConfirmar: 'Confirmar' });

  const confirmar = useCallback((novaPergunta) => {
    setPergunta(novaPergunta);
    referencia.current.showModal();
    // O foco começa em "Cancelar": Enter por engano não apaga nada
    botaoCancelar.current.focus();
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function responder(resposta) {
    resolver.current?.(resposta);
    resolver.current = null;
    referencia.current.close();
  }

  const janela = (
    <Janela referencia={referencia} titulo={pergunta.titulo} rotuloFechar="Cancelar" largura="max-w-md" aoFechar={() => responder(false)}>
      <div className="px-6 py-6">
        <p className="text-grafite">{pergunta.texto}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={botaoCancelar}
            type="button"
            onClick={() => responder(false)}
            className="rounded-full border border-borda px-5 py-2.5 text-sm font-medium hover:border-tinta"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => responder(true)}
            className="rounded-full bg-erro px-5 py-2.5 text-sm font-medium text-white hover:bg-tinta"
          >
            {pergunta.rotuloConfirmar}
          </button>
        </div>
      </div>
    </Janela>
  );

  return [confirmar, janela];
}
