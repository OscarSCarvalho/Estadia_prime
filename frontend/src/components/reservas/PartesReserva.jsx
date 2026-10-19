import Icone from '../Icone.jsx';
import ErroCarregamento from '../ErroCarregamento.jsx';
import EstadoVazio from '../EstadoVazio.jsx';
import { ListaCarregando } from '../Esqueletos.jsx';
import { STATUS_RESERVA, ROTULO_TIPO_SERVICO, descreverCobrancaIncluso, descreverQuantidade } from '../../utils/perfis.js';
import { formatarDataComAno, formatarDiaDaSemana, formatarMoeda } from '../../utils/formatacao.js';

export function SeloReserva({ status }) {
  const { rotulo, classes } = STATUS_RESERVA[status] ?? STATUS_RESERVA.cancelada;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}>{rotulo}</span>;
}

export function PeriodoReserva({ reserva }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-grafite">
      <span className="inline-flex items-center gap-1.5">
        <Icone nome="calendario" tamanho={16} />
        {formatarDataComAno(reserva.data_checkin)} – {formatarDataComAno(reserva.data_checkout)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Icone nome="hospedes" tamanho={16} />
        {reserva.num_hospedes} {reserva.num_hospedes === 1 ? 'hóspede' : 'hóspedes'}
      </span>
    </p>
  );
}

// Serviços contratados na reserva, com dia, prestador e valor
export function ItensReserva({ itens }) {
  if (itens.length === 0) return <p className="text-sm text-grafite">Sem serviços premium.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {itens.map((item) => (
        <li key={item.id} className="flex justify-between gap-3">
          <span className="min-w-0">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Icone nome={item.tipo_servico} tamanho={15} className="text-ouro-escuro" />
              {ROTULO_TIPO_SERVICO[item.tipo_servico]}
            </span>
            <span className="text-grafite">
              {' '}
              · {item.prestador} · {formatarDiaDaSemana(item.data_servico)} · {descreverQuantidade(item.quantidade, item.unidade_preco)}
            </span>
          </span>
          <span className="shrink-0">{formatarMoeda(item.subtotal)}</span>
        </li>
      ))}
    </ul>
  );
}

// RN18: inclusos do anfitrião que o hóspede manteve, com nome e preço congelados na reserva
export function InclusosReserva({ inclusos }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {inclusos.map((incluso) => (
        <li key={incluso.id} className="flex justify-between gap-3">
          <span className="min-w-0">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Icone nome="incluso" tamanho={15} className="text-ouro-escuro" />
              {incluso.nome}
            </span>
            <span className="text-grafite">
              {' '}
              · {descreverCobrancaIncluso(incluso.unidade_preco, incluso.quantidade, formatarMoeda(incluso.preco_contratado))}
            </span>
          </span>
          <span className="shrink-0">{formatarMoeda(incluso.subtotal)}</span>
        </li>
      ))}
    </ul>
  );
}

export function TituloParte({ children }) {
  return <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-grafite">{children}</p>;
}

// Carregando / erro / vazio / lista: o mesmo esqueleto nas três telas de reservas.
// `acaoVazio`: botão ou link opcional dentro da caixa de lista vazia
export function ConteudoLista({ carregando, erro, recarregar, vazio, tituloVazio, textoVazio, acaoVazio, children }) {
  if (carregando) return <ListaCarregando />;
  if (erro) return <ErroCarregamento erro={erro} aoTentarDeNovo={recarregar} />;
  if (vazio) {
    return (
      <EstadoVazio icone="calendario" titulo={tituloVazio} texto={textoVazio}>
        {acaoVazio}
      </EstadoVazio>
    );
  }
  return children;
}

export function CabecalhoPagina({ rotulo, titulo, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-ouro-escuro">{rotulo}</p>
        <h1 className="mt-2 font-titulo text-4xl font-semibold sm:text-5xl">{titulo}</h1>
      </div>
      {children}
    </div>
  );
}
