import { Link } from 'react-router';
import ErroCarregamento from '../../components/ErroCarregamento.jsx';
import EstadoVazio from '../../components/EstadoVazio.jsx';
import { ListaCarregando } from '../../components/Esqueletos.jsx';
import Icone from '../../components/Icone.jsx';
import Avaliacao from '../../components/explorar/Avaliacao.jsx';
import SeloStatus from '../../components/painel/SeloStatus.jsx';
import FaixaRecebimento from '../../components/painel/FaixaRecebimento.jsx';
import { useDados } from '../../hooks/useDados.js';
import { useTituloPagina } from '../../hooks/useTituloPagina.js';
import { listarMeusImoveis } from '../../services/painel.js';
import { ROTULO_TIPO_IMOVEL } from '../../utils/perfis.js';
import { formatarMoeda } from '../../utils/formatacao.js';

// RN13: o anfitrião precisa saber por que um imóvel não aparece para os hóspedes
function motivoInvisivel(imovel) {
  if (imovel.status === 'inativo') return 'Desativado: não aparece na busca';
  if (imovel.total_fotos === 0) return 'Sem fotos: envie pelo menos uma para aparecer na busca';
  return null;
}

function LinhaImovel({ imovel }) {
  const motivo = motivoInvisivel(imovel);

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-linha bg-white p-4 sm:flex-row sm:items-center">
      <Link to={`/painel/imoveis/${imovel.id}`} className="shrink-0">
        {imovel.foto_capa ? (
          <img src={imovel.foto_capa} alt="" className="aspect-[4/3] w-full rounded-xl object-cover sm:w-40" />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-areia text-grafite sm:w-40">
            <Icone nome={imovel.tipo_imovel} tamanho={32} />
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">
            <Link to={`/painel/imoveis/${imovel.id}`} className="hover:underline">
              {imovel.titulo}
            </Link>
          </h2>
          <SeloStatus status={imovel.status} />
        </div>
        <p className="mt-1 text-sm text-grafite">
          {ROTULO_TIPO_IMOVEL[imovel.tipo_imovel]} em {imovel.cidade}, {imovel.estado} · até {imovel.num_hospedes} hóspedes
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
          <span>
            <span className="font-semibold">{formatarMoeda(imovel.preco_diaria)}</span>
            <span className="text-grafite"> / noite</span>
          </span>
          <span className="text-grafite">
            {imovel.total_fotos} {imovel.total_fotos === 1 ? 'foto' : 'fotos'}
          </span>
          <Avaliacao nota={imovel.nota_media} total={imovel.total_avaliacoes} mostrarTotal />
        </p>
        {motivo && <p className="mt-2 text-sm font-medium text-ouro-escuro">{motivo}</p>}
      </div>

      <div className="flex gap-2 sm:flex-col sm:items-stretch">
        <Link
          to={`/painel/imoveis/${imovel.id}`}
          className="rounded-full bg-tinta px-5 py-2 text-center text-sm font-medium text-marfim hover:bg-grafite"
        >
          Editar
        </Link>
        {!motivo && (
          <Link
            to={`/imoveis/${imovel.id}`}
            className="rounded-full border border-linha px-5 py-2 text-center text-sm font-medium hover:border-tinta"
          >
            Ver anúncio
          </Link>
        )}
      </div>
    </li>
  );
}

export default function MeusImoveis() {
  useTituloPagina('Meus imóveis');
  const { dados: imoveis, erro, carregando, recarregar } = useDados('meus-imoveis', listarMeusImoveis);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-ouro-escuro">Painel do anfitrião</p>
          <h1 className="mt-2 font-titulo text-4xl font-semibold sm:text-5xl">Meus imóveis</h1>
        </div>
        <Link
          to="/painel/imoveis/novo"
          className="inline-flex items-center gap-2 rounded-full bg-tinta px-5 py-3 font-medium text-marfim hover:bg-grafite"
        >
          <Icone nome="mais" tamanho={18} /> Cadastrar imóvel
        </Link>
      </div>
      <FaixaRecebimento oQueAparece="seus imóveis" />

      <div className="mt-10">
        {carregando ? (
          <ListaCarregando />
        ) : erro ? (
          <ErroCarregamento erro={erro} aoTentarDeNovo={recarregar} />
        ) : imoveis.length === 0 ? (
          <EstadoVazio icone="casa" titulo="Nenhum imóvel ainda" texto="Cadastre o primeiro: dados, diária e fotos. Em poucos minutos ele aparece na busca." />
        ) : (
          <ul className="flex flex-col gap-4">
            {imoveis.map((imovel) => (
              <LinhaImovel key={imovel.id} imovel={imovel} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
