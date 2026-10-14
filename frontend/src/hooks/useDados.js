import { useCallback, useEffect, useState } from 'react';

// Carrega dados assíncronos e recarrega quando a `chave` muda.
// A chave deve representar todos os parâmetros usados por `carregar` (ex.: os filtros da URL).
// `recarregar()` repete a carga (ex.: botão "Tentar de novo" depois de um erro de conexão)
export function useDados(chave, carregar) {
  const [tentativa, setTentativa] = useState(0);
  const chaveCompleta = `${chave}#${tentativa}`;
  const [resultado, setResultado] = useState({ chave: null, dados: null, erro: null });

  useEffect(() => {
    let ativo = true;
    carregar().then(
      (dados) => ativo && setResultado({ chave: chaveCompleta, dados, erro: null }),
      (erro) => ativo && setResultado({ chave: chaveCompleta, dados: null, erro }),
    );
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave já identifica a carga
  }, [chaveCompleta]);

  const recarregar = useCallback(() => setTentativa((numero) => numero + 1), []);
  const atual = resultado.chave === chaveCompleta;
  return {
    dados: atual ? resultado.dados : null,
    erro: atual ? resultado.erro : null,
    carregando: !atual,
    recarregar,
  };
}
