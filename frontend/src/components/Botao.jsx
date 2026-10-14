export default function Botao({ carregando = false, textoCarregando, children, className = '', ...props }) {
  return (
    <button
      type="submit"
      disabled={carregando}
      aria-busy={carregando || undefined}
      className={`w-full rounded-full bg-tinta px-6 py-3.5 font-medium text-marfim transition-colors hover:bg-grafite disabled:cursor-wait disabled:opacity-70 ${className}`}
      {...props}
    >
      {carregando ? textoCarregando : children}
    </button>
  );
}
