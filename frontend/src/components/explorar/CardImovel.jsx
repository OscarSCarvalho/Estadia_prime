import { Link, useLocation } from 'react-router';
import CarrosselFotos from './CarrosselFotos.jsx';
import Avaliacao from './Avaliacao.jsx';
import Icone from '../Icone.jsx';
import { ROTULO_TIPO_IMOVEL, ROTULO_TIPO_SERVICO } from '../../utils/perfis.js';
import { calcularNoites, formatarMoeda } from '../../utils/formatacao.js';

const NOTA_DESTAQUE_PRIME = 4.95;

// `periodo` (checkin, checkout, hospedes) segue para a página do imóvel e já preenche a reserva.
// O link do card é o título (o leitor de tela ouve um nome curto); a área de texto inteira é clicável
export default function CardImovel({ imovel, periodo = {} }) {
  const { pathname, search } = useLocation();
  const noites = calcularNoites(periodo.checkin, periodo.checkout);
  const parametros = new URLSearchParams(
    Object.entries(periodo).filter(([, valor]) => valor),
  ).toString();
  const destino = `/imoveis/${imovel.id}${parametros ? `?${parametros}` : ''}`;
  // Vindo da busca, o "Voltar" da página do imóvel volta para ela com os mesmos filtros
  const estadoDestino = pathname === '/explorar' ? { busca: pathname + search } : undefined;

  return (
    <article className="group rounded-2xl has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-ouro-escuro">
      <CarrosselFotos
        fotos={imovel.fotos}
        descricao={`Foto de ${imovel.titulo}`}
        selo={imovel.nota_media >= NOTA_DESTAQUE_PRIME ? 'Destaque Prime' : null}
        destino={destino}
        estadoDestino={estadoDestino}
      />

      <div className="relative mt-3 text-[15px]">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">
            <Link to={destino} state={estadoDestino} className="after:absolute after:inset-0 focus-visible:outline-none">
              {ROTULO_TIPO_IMOVEL[imovel.tipo_imovel]} em {imovel.cidade}, {imovel.estado}
            </Link>
          </h3>
          <Avaliacao nota={imovel.nota_media} className="shrink-0 text-sm" />
        </div>
        <p className="truncate text-grafite">{imovel.titulo}</p>
        <p className="text-grafite">
          {imovel.num_hospedes} hóspedes · {imovel.num_quartos} {imovel.num_quartos === 1 ? 'quarto' : 'quartos'}
        </p>

        {imovel.servicos_disponiveis.length > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-ouro-escuro">
            {imovel.servicos_disponiveis.map((tipo) => (
              <Icone key={tipo} nome={tipo} tamanho={16} rotulo={ROTULO_TIPO_SERVICO[tipo]} />
            ))}
            <span className="text-xs font-medium">
              {imovel.servicos_disponiveis.length} {imovel.servicos_disponiveis.length === 1 ? 'serviço' : 'serviços'}
            </span>
          </p>
        )}

        <p className="mt-1.5">
          {noites > 0 ? (
            <>
              <span className="font-semibold">{formatarMoeda(imovel.preco_diaria * noites)}</span>{' '}
              <span className="text-grafite">por {noites} {noites === 1 ? 'noite' : 'noites'}</span>
            </>
          ) : (
            <>
              <span className="font-semibold">{formatarMoeda(imovel.preco_diaria)}</span>{' '}
              <span className="text-grafite">noite</span>
            </>
          )}
        </p>
      </div>
    </article>
  );
}
