import { Link } from 'react-router';
import {
  CabecalhoPagina,
  ConteudoLista,
  InclusosReserva,
  ItensReserva,
  PeriodoReserva,
  SeloReserva,
  SituacaoRepasse,
  TituloParte,
} from '../../components/reservas/PartesReserva.jsx';
import { useDados } from '../../hooks/useDados.js';
import { useTituloPagina } from '../../hooks/useTituloPagina.js';
import { listarReservasRecebidas } from '../../services/reservas.js';
import { formatarMoeda, formatarTelefone } from '../../utils/formatacao.js';

// H2.4: reservas dos imóveis do anfitrião. Telefone do hóspede só com reserva confirmada (LGPD)
function CartaoReservaRecebida({ reserva }) {
  return (
    <li className="rounded-2xl border border-linha bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        {reserva.imovel.foto && <img src={reserva.imovel.foto} alt="" className="aspect-[4/3] w-full shrink-0 rounded-xl object-cover sm:w-36" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{reserva.imovel.titulo}</h2>
            <SeloReserva status={reserva.status} />
          </div>
          <p className="mt-1 text-sm">
            Hóspede: <span className="font-medium">{reserva.hospede.nome}</span>
            {reserva.hospede.telefone && <span className="text-grafite"> · {formatarTelefone(reserva.hospede.telefone)}</span>}
          </p>
          <div className="mt-2">
            <PeriodoReserva reserva={reserva} />
          </div>
          {reserva.inclusos.length > 0 && (
            <div className="mt-4">
              <TituloParte>Seus serviços inclusos</TituloParte>
              <InclusosReserva inclusos={reserva.inclusos} />
            </div>
          )}
          {reserva.itens.length > 0 && (
            <div className="mt-4">
              <TituloParte>Serviços premium contratados no imóvel</TituloParte>
              <ItensReserva itens={reserva.itens} />
            </div>
          )}
        </div>
        <dl className="shrink-0 space-y-1 text-sm sm:w-48 sm:text-right">
          <div>
            <dt className="text-grafite">Hospedagem</dt>
            <dd>{formatarMoeda(reserva.valor_hospedagem)}</dd>
          </div>
          {reserva.valor_inclusos > 0 && (
            <div>
              <dt className="text-grafite">Serviços inclusos</dt>
              <dd>{formatarMoeda(reserva.valor_inclusos)}</dd>
            </div>
          )}
          <div>
            <dt className="text-grafite">Você recebe</dt>
            <dd className="text-lg font-semibold">{formatarMoeda(reserva.repasse?.valor ?? reserva.repasse_anfitriao)}</dd>
            <dd>
              <SituacaoRepasse situacao={reserva.repasse?.situacao} previstoPara={reserva.repasse?.previsto_para} />
            </dd>
          </div>
        </dl>
      </div>
    </li>
  );
}

export default function ReservasRecebidas() {
  useTituloPagina('Reservas recebidas');
  const { dados: reservas, erro, carregando, recarregar } = useDados('reservas-recebidas', listarReservasRecebidas);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <CabecalhoPagina rotulo="Painel do anfitrião" titulo="Reservas">
        <Link to="/painel/imoveis" className="text-sm font-semibold underline underline-offset-4">
          Meus imóveis
        </Link>
      </CabecalhoPagina>
      <p className="mt-3 text-grafite">
        O valor da hospedagem e dos seus serviços inclusos, já descontada a comissão, é repassado 24 horas depois do check-in.
      </p>

      <div className="mt-8">
        <ConteudoLista
          carregando={carregando}
          erro={erro}
          recarregar={recarregar}
          vazio={reservas?.length === 0}
          tituloVazio="Nenhuma reserva ainda"
          textoVazio="Quando um hóspede reservar um dos seus imóveis, ela aparece aqui."
        >
          <ul className="flex flex-col gap-4">
            {(reservas ?? []).map((reserva) => (
              <CartaoReservaRecebida key={reserva.id} reserva={reserva} />
            ))}
          </ul>
        </ConteudoLista>
      </div>
    </div>
  );
}
