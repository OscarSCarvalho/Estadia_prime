import { Link } from 'react-router';

// Monograma "EP" num círculo dourado + o nome, na fonte de logo (Cinzel).
// `clara`: sobre fundo escuro (foto da página inicial, tela de login)
export default function Marca({ clara = false }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-2 sm:gap-3" aria-label="Estadia Prime, página inicial">
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ouro pl-px font-logo text-[0.8rem] sm:h-10 sm:w-10 sm:text-[0.9rem] font-semibold tracking-[0.04em] transition-colors duration-300 group-hover:bg-ouro group-hover:text-tinta ${
          clara ? 'text-ouro' : 'text-ouro-escuro'
        }`}
      >
        EP
      </span>
      <span className="inline-flex items-baseline gap-1 font-logo text-[0.95rem] font-semibold tracking-[0.05em] sm:gap-2 sm:text-xl sm:tracking-[0.12em]">
        <span className={`transition-colors duration-300 ${clara ? 'text-marfim' : 'text-tinta'}`}>Estadia</span>
        <span className="text-ouro">Prime</span>
      </span>
    </Link>
  );
}
