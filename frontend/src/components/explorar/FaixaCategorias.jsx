import Icone from '../Icone.jsx';

// categorias: [{ valor, rotulo }]; o ícone tem o mesmo nome do valor ('' = todos)
export default function FaixaCategorias({ categorias, ativa, aoEscolher, rotuloGrupo }) {
  const opcoes = [{ valor: '', rotulo: 'Todos' }, ...categorias];

  return (
    <div role="group" aria-label={rotuloGrupo} className="flex min-w-0 flex-1 gap-8 overflow-x-auto [scrollbar-width:none]">
      {opcoes.map(({ valor, rotulo }) => {
        const selecionada = valor === ativa;
        return (
          <button
            key={valor || 'todos'}
            type="button"
            onClick={() => aoEscolher(valor)}
            aria-pressed={selecionada}
            className={`flex shrink-0 flex-col items-center gap-2 border-b-2 pb-3 pt-1 text-xs font-medium transition-colors ${
              selecionada
                ? 'border-tinta text-tinta'
                : 'border-transparent text-grafite hover:border-linha hover:text-tinta'
            }`}
          >
            <Icone nome={valor || 'todos'} tamanho={24} />
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}
