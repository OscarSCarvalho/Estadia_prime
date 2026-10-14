import Icone from '../Icone.jsx';
import { formatarNota } from '../../utils/formatacao.js';

// Sem nenhuma avaliação ainda (nota null), mostra "Novo" em vez de uma nota inventada
export default function Avaliacao({ nota, total, mostrarTotal = false, className = '' }) {
  if (nota === null || nota === undefined) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <Icone nome="estrela" tamanho={13} className="text-tinta" />
        <span>Novo</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Icone nome="estrela" tamanho={13} preenchido className="text-tinta" />
      <span aria-hidden="true">{formatarNota(nota)}</span>
      {mostrarTotal && <span aria-hidden="true" className="text-grafite">({total})</span>}
      <span className="sr-only">
        Nota {formatarNota(nota)} de 5{mostrarTotal ? `, ${total} avaliações` : ''}
      </span>
    </span>
  );
}
