import { useId } from 'react';

// `opcoes`: [{ valor, rotulo }]
export default function CampoSelecao({ rotulo, erro, ajuda, opcoes, ...propsSelect }) {
  const id = useId();
  const idDescricao = `${id}-descricao`;
  const temDescricao = Boolean(erro || ajuda);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-tinta">
        {rotulo}
      </label>
      <select
        id={id}
        aria-invalid={erro ? 'true' : undefined}
        aria-describedby={temDescricao ? idDescricao : undefined}
        className={`w-full rounded-lg border bg-white px-4 py-3 text-tinta focus:border-tinta focus:outline-none focus:ring-1 focus:ring-tinta ${
          erro ? 'border-erro' : 'border-borda'
        }`}
        {...propsSelect}
      >
        {opcoes.map(({ valor, rotulo: texto }) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
      {temDescricao && (
        <p id={idDescricao} className={`text-sm ${erro ? 'text-erro' : 'text-grafite'}`}>
          {erro || ajuda}
        </p>
      )}
    </div>
  );
}
