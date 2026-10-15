// Formas cinza no lugar do conteúdo enquanto ele carrega. O leitor de tela ouve só "Carregando…"
function Carregando({ texto = 'Carregando…', className = '', children }) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{texto}</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        {children}
      </div>
    </div>
  );
}

// Grade de cards (busca, destaques). `formato`: proporção da foto, ex.: 'aspect-[20/19]'
export function GradeCarregando({ formato = 'aspect-[20/19]', quantidade = 8, colunas = 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' }) {
  return (
    <Carregando>
      <div className={`grid gap-x-6 gap-y-10 ${colunas}`}>
        {Array.from({ length: quantidade }, (_, i) => (
          <div key={i}>
            <div className={`${formato} rounded-2xl bg-areia`} />
            <div className="mt-3 h-4 w-3/4 rounded bg-areia" />
            <div className="mt-2 h-4 w-1/2 rounded bg-areia" />
          </div>
        ))}
      </div>
    </Carregando>
  );
}

// Lista de cartões com foto à esquerda (reservas, painéis)
export function ListaCarregando({ quantidade = 3 }) {
  return (
    <Carregando>
      <div className="flex flex-col gap-4">
        {Array.from({ length: quantidade }, (_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-2xl border border-linha bg-white p-4 sm:flex-row">
            <div className="aspect-[4/3] w-full shrink-0 rounded-xl bg-areia sm:w-40" />
            <div className="flex-1 space-y-3 py-1">
              <div className="h-5 w-2/3 rounded bg-areia" />
              <div className="h-4 w-1/2 rounded bg-areia" />
              <div className="h-4 w-1/3 rounded bg-areia" />
            </div>
          </div>
        ))}
      </div>
    </Carregando>
  );
}

// Página de um imóvel: título, galeria e o cartão de reserva ao lado
export function ImovelCarregando() {
  return (
    <Carregando texto="Carregando o imóvel…" className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
      <div className="h-4 w-32 rounded bg-areia" />
      <div className="mt-5 h-10 w-2/3 rounded bg-areia" />
      <div className="mt-3 h-4 w-48 rounded bg-areia" />
      <div className="mt-6 aspect-[4/3] rounded-2xl bg-areia md:aspect-auto md:h-[26rem] lg:h-[30rem]" />
      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-3">
          <div className="h-6 w-1/2 rounded bg-areia" />
          <div className="h-4 w-1/3 rounded bg-areia" />
          <div className="mt-8 h-4 w-full rounded bg-areia" />
          <div className="h-4 w-full rounded bg-areia" />
          <div className="h-4 w-4/5 rounded bg-areia" />
        </div>
        <div className="h-72 rounded-2xl bg-areia" />
      </div>
    </Carregando>
  );
}

// Formulário/painel de uma tela só (ex.: edição do imóvel)
export function PainelCarregando() {
  return (
    <Carregando className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="h-4 w-28 rounded bg-areia" />
      <div className="mt-5 h-12 w-1/2 rounded bg-areia" />
      <div className="mt-10 h-64 rounded-2xl bg-areia" />
      <div className="mt-8 h-96 rounded-2xl bg-areia" />
    </Carregando>
  );
}

// Espera curta sem forma definida (ex.: conferindo o login)
export function CarregandoSimples({ className = 'py-24' }) {
  return (
    <div role="status" className={`flex justify-center ${className}`}>
      <span
        aria-hidden="true"
        className="h-8 w-8 rounded-full border-2 border-linha border-t-ouro-escuro motion-safe:animate-spin"
      />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
