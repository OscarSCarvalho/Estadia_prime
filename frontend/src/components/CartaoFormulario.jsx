export default function CartaoFormulario({ titulo, subtitulo, children, rodape }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-2xl border border-linha bg-white p-6 shadow-sm sm:p-10">
        <h1 className="font-titulo text-4xl font-semibold">{titulo}</h1>
        {subtitulo && <p className="mt-2 text-grafite">{subtitulo}</p>}
        <div className="mt-8">{children}</div>
      </div>
      {rodape && <div className="mt-6 text-center text-sm text-grafite">{rodape}</div>}
    </div>
  );
}
