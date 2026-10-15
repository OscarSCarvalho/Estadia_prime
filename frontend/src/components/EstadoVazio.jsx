import Icone from './Icone.jsx';

// Caixa de "nada por aqui" (lista vazia, busca sem resultado, falha ao carregar), igual em todo o site.
// `children`: botões ou links de ação, opcionais. `TagTitulo`: 'h1' quando a caixa é a página inteira
export default function EstadoVazio({ icone, titulo, texto, role, TagTitulo = 'p', className = '', children }) {
  return (
    <div role={role} className={`rounded-2xl border border-dashed border-linha bg-white/60 px-6 py-14 text-center sm:py-16 ${className}`}>
      {icone && (
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-areia text-ouro-escuro">
          <Icone nome={icone} tamanho={26} />
        </span>
      )}
      <TagTitulo className="font-titulo text-3xl font-semibold">{titulo}</TagTitulo>
      {texto && <p className="mx-auto mt-2 max-w-md text-grafite">{texto}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
