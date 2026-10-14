import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import Icone from '../../components/Icone.jsx';
import AvaliarEstadia from '../../components/avaliacoes/AvaliarEstadia.jsx';
import { CabecalhoPagina, ConteudoLista, ItensReserva, PeriodoReserva, SeloReserva } from '../../components/reservas/PartesReserva.jsx';
import { useDados } from '../../hooks/useDados.js';
import { desistirDaReserva, listarMinhasReservas } from '../../services/reservas.js';
import { formatarHora, formatarMoeda } from '../../utils/formatacao.js';

function AcoesPendente({ reserva, aoMudar }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function desistir() {
    if (!window.confirm('Desistir desta reserva? As datas e os serviços ficam livres para outras pessoas.')) return;
    setEnviando(true);
    setErro('');
    try {
      aoMudar(await desistirDaReserva(reserva.id));
    } catch (falha) {
      setErro(falha.message);
      setEnviando(false);
    }
  }

  return (
    <div className="mt-4 border-t border-linha pt-4">
      <p className="text-sm text-ouro-escuro">
        Datas e serviços guardados até <strong>{formatarHora(reserva.prazo_pagamento)}</strong>. Depois disso, a reserva expira.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          title="O pagamento online (cartão ou Pix) será ativado em breve"
          className="cursor-not-allowed rounded-full bg-tinta/40 px-5 py-2.5 text-sm font-medium text-marfim"
        >
          Pagar · em breve
        </button>
        <button
          type="button"
          onClick={desistir}
          disabled={enviando}
          className="rounded-full border border-linha px-5 py-2.5 text-sm font-medium hover:border-erro hover:text-erro disabled:cursor-wait disabled:opacity-60"
        >
          Desistir da reserva
        </button>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-erro">
          {erro}
        </p>
      )}
    </div>
  );
}

function CartaoReserva({ reserva, destacada, aoMudar }) {
  const { imovel } = reserva;
  return (
    <li className={`rounded-2xl border bg-white p-4 sm:p-6 ${destacada ? 'border-ouro ring-1 ring-ouro' : 'border-linha'}`}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link to={`/imoveis/${imovel.id}`} className="shrink-0">
          {imovel.foto ? (
            <img src={imovel.foto} alt="" className="aspect-[4/3] w-full rounded-xl object-cover sm:w-44" />
          ) : (
            <div className="aspect-[4/3] w-full rounded-xl bg-areia sm:w-44" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">
              <Link to={`/imoveis/${imovel.id}`} className="hover:underline">
                {imovel.titulo}
              </Link>
            </h2>
            <SeloReserva status={reserva.status} />
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-grafite">
            <Icone nome="local" tamanho={14} />
            {imovel.endereco ? `${imovel.endereco}, ${imovel.cidade}, ${imovel.estado}` : `${imovel.cidade}, ${imovel.estado}`}
          </p>
          <div className="mt-2">
            <PeriodoReserva reserva={reserva} />
          </div>
          <div className="mt-4">
            <ItensReserva itens={reserva.itens} />
          </div>
        </div>
      </div>

      <dl className="mt-4 space-y-1 border-t border-linha pt-4 text-sm sm:ml-auto sm:max-w-xs">
        <div className="flex justify-between">
          <dt className="text-grafite">Hospedagem</dt>
          <dd>{formatarMoeda(reserva.valor_hospedagem)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-grafite">Serviços</dt>
          <dd>{formatarMoeda(reserva.valor_servicos)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Total</dt>
          <dd>{formatarMoeda(reserva.valor_total)}</dd>
        </div>
      </dl>

      {reserva.status === 'pendente' && <AcoesPendente reserva={reserva} aoMudar={aoMudar} />}
      <AvaliarEstadia
        reserva={reserva}
        aoAvaliar={(nova) =>
          aoMudar({ ...reserva, avaliacao: { ...reserva.avaliacao, feitas: [...reserva.avaliacao.feitas, nova] } })
        }
      />
    </li>
  );
}

export default function MinhasReservas() {
  const reservaCriada = useLocation().state?.reservaCriada;
  const { dados, erro, carregando, recarregar } = useDados('minhas-reservas', listarMinhasReservas);
  // Reservas alteradas nesta tela (desistência) por cima da lista carregada
  const [alteradas, setAlteradas] = useState({});
  const reservas = (dados ?? []).map((reserva) => alteradas[reserva.id] ?? reserva);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <CabecalhoPagina rotulo="Hóspede" titulo="Minhas reservas" />

      {reservaCriada && (
        <p role="status" className="mt-8 rounded-xl border border-ouro/50 bg-ouro/10 px-4 py-3 text-sm">
          <strong>Reserva criada!</strong> As datas e os serviços ficam guardados por 30 minutos aguardando o pagamento. O
          pagamento online (cartão ou Pix) será ativado em breve.
        </p>
      )}

      <div className="mt-8" aria-live="polite" aria-busy={carregando}>
        <ConteudoLista
          carregando={carregando}
          erro={erro}
          recarregar={recarregar}
          vazio={reservas.length === 0}
          tituloVazio="Nenhuma reserva ainda"
          textoVazio="Escolha um imóvel, monte sua estadia com serviços premium e reserve."
        >
          <ul className="flex flex-col gap-4">
            {reservas.map((reserva) => (
              <CartaoReserva
                key={reserva.id}
                reserva={reserva}
                destacada={reserva.id === reservaCriada}
                aoMudar={(atualizada) => setAlteradas((atuais) => ({ ...atuais, [atualizada.id]: atualizada }))}
              />
            ))}
          </ul>
        </ConteudoLista>
        {!carregando && !erro && reservas.length === 0 && (
          <div className="mt-6 text-center">
            <Link to="/explorar" className="rounded-full bg-tinta px-6 py-3 font-medium text-marfim hover:bg-grafite">
              Explorar imóveis
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
