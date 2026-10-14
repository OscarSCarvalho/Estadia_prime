// Falha ao buscar dados (servidor fora do ar, sem internet): explica e oferece tentar de novo
export default function ErroCarregamento({ erro, aoTentarDeNovo, className = '' }) {
  return (
    <div role="alert" className={`rounded-2xl border border-dashed border-linha px-6 py-16 text-center ${className}`}>
      <p className="font-titulo text-3xl font-semibold">Não foi possível carregar</p>
      <p className="mt-2 text-grafite">{erro?.message || 'Algo deu errado. Tente novamente.'}</p>
      <button
        type="button"
        onClick={aoTentarDeNovo}
        className="mt-6 rounded-xl border border-tinta px-6 py-3 text-sm font-medium hover:bg-tinta hover:text-marfim"
      >
        Tentar de novo
      </button>
    </div>
  );
}
