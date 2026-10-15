import { useId } from 'react';

export default function CampoAreaTexto({ rotulo, erro, ajuda, ...propsTextarea }) {
  const id = useId();
  const idDescricao = `${id}-descricao`;
  const temDescricao = Boolean(erro || ajuda);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-tinta">
        {rotulo}
      </label>
      <textarea
        id={id}
        rows={5}
        aria-invalid={erro ? 'true' : undefined}
        aria-describedby={temDescricao ? idDescricao : undefined}
        className={`w-full rounded-lg border bg-white px-4 py-3 text-tinta placeholder:text-grafite/85 focus:border-tinta focus:outline-none focus:ring-1 focus:ring-tinta ${
          erro ? 'border-erro' : 'border-borda'
        }`}
        {...propsTextarea}
      />
      {temDescricao && (
        <p id={idDescricao} className={`text-sm ${erro ? 'text-erro' : 'text-grafite'}`}>
          {erro || ajuda}
        </p>
      )}
    </div>
  );
}
