export default function SeloStatus({ status }) {
  const ativo = status === 'ativo';
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        ativo ? 'bg-ouro/25 text-ouro-escuro' : 'bg-areia text-grafite'
      }`}
    >
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}
