import EstadoVazio from './EstadoVazio.jsx';

// Falha ao buscar dados (servidor fora do ar, sem internet): explica e oferece tentar de novo
export default function ErroCarregamento({ erro, aoTentarDeNovo, className = '' }) {
  return (
    <EstadoVazio
      role="alert"
      icone="alerta"
      titulo="Não foi possível carregar"
      texto={erro?.message || 'Algo deu errado. Tente novamente.'}
      className={className}
    >
      <button
        type="button"
        onClick={aoTentarDeNovo}
        className="rounded-full border border-tinta px-6 py-3 text-sm font-medium hover:bg-tinta hover:text-marfim"
      >
        Tentar de novo
      </button>
    </EstadoVazio>
  );
}
