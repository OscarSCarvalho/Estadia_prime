import { Link } from 'react-router';

export default function Marca({ clara = false }) {
  return (
    <Link to="/" className="group inline-flex items-baseline gap-1" aria-label="Estadia Prime, página inicial">
      <span className={`font-titulo text-2xl font-semibold tracking-wide ${clara ? 'text-marfim' : 'text-tinta'}`}>
        Estadia
      </span>
      <span className="font-titulo text-2xl font-semibold italic text-ouro">Prime</span>
    </Link>
  );
}
