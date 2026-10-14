import { Link } from 'react-router';
import Avaliacao from './Avaliacao.jsx';
import Icone from '../Icone.jsx';
import { ROTULO_TIPO_SERVICO, ROTULO_UNIDADE_PRECO } from '../../utils/perfis.js';
import { formatarMoeda } from '../../utils/formatacao.js';

// Serviços são contratados junto com a estadia: o card leva aos imóveis da cidade que oferecem este serviço
export default function CardServico({ servico }) {
  const destino = `/explorar?${new URLSearchParams({ cidade: servico.cidade_atuacao, servicos: servico.tipo_servico })}`;

  return (
    <Link to={destino} className="group block rounded-2xl outline-offset-4">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-areia">
        <img
          src={servico.foto}
          alt={`${ROTULO_TIPO_SERVICO[servico.tipo_servico]}: ${servico.prestador}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold shadow-sm">
          <Icone nome={servico.tipo_servico} tamanho={14} className="text-ouro-escuro" />
          {ROTULO_TIPO_SERVICO[servico.tipo_servico]}
        </span>
      </div>

      <div className="mt-3 text-[15px]">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{servico.prestador}</h3>
          <Avaliacao nota={servico.nota_media} className="shrink-0 text-sm" />
        </div>
        <p className="flex items-center gap-1 text-grafite">
          <Icone nome="local" tamanho={14} />
          {servico.cidade_atuacao}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm text-grafite">{servico.descricao}</p>
        <p className="mt-1.5">
          <span className="text-grafite">A partir de </span>
          <span className="font-semibold">{formatarMoeda(servico.preco)}</span>
          <span className="text-grafite"> / {ROTULO_UNIDADE_PRECO[servico.unidade_preco]}</span>
        </p>
      </div>
    </Link>
  );
}
