import { useEffect } from 'react';

const NOME_DO_SITE = 'Estadia Prime';

// Título da aba do navegador: é o primeiro texto que o leitor de tela lê ao trocar de página (WCAG 2.4.2)
export function useTituloPagina(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${NOME_DO_SITE}` : NOME_DO_SITE;
    return () => {
      document.title = NOME_DO_SITE;
    };
  }, [titulo]);
}
