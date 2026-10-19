import { useState } from 'react';
import { Link } from 'react-router';
import Icone from '../../components/Icone.jsx';
import AvaliarEstadia from '../../components/avaliacoes/AvaliarEstadia.jsx';
import {
  CabecalhoPagina,
  ConteudoLista,
  InclusosReserva,
  ItensReserva,
  PeriodoReserva,
  SeloReserva,
  TituloParte,
} from '../../components/reservas/PartesReserva.jsx';
import { useConfirmacao } from '../../hooks/useConfirmacao.jsx';
import { useDados } from '../../hooks/useDados.js';
import { useTituloPagina } from '../../hooks/useTituloPagina.js';
import { desistirDaReserva, listarMinhasReservas } from '../../services/reservas.js';
import { cancelarReserva, previaCancelamento } from '../../services/pagamentos.js';
import { formatarHora, formatarMoeda, formatarMoedaExata } from '../../utils/formatacao.js';

function AcoesPendente({ reserva, aoMudar }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmar, janelaConfirmacao] = useConfirmacao();

  async function desistir() {
    const confirmado = await confirmar({
      titulo: 'Desistir da reserva?',
      texto: 'As datas e os serviços ficam livres para outras pessoas. Essa ação não pode ser desfeita.',
      rotuloConfirmar: 'Desistir da reserva',
    });
    if (!confirmado) return;
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
        <Link
          to={`/reservas/${reserva.id}/pagamento`}
          className="rounded-full bg-tinta px-5 py-2.5 text-sm font-medium text-marfim hover:bg-grafite"
        >
          Pagar agora
        </Link>
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
      {janelaConfirmacao}
    </div>
  );
}

// Texto da confirmação com o valor que volta, calculado no backend pela mesma conta do cancelamento (RN10 + RN20)
function explicarReembolso(reembolso) {
  if (reembolso.valor_total === 0) {
    return 'Faltam menos de 7 dias para o check-in: pela política de cancelamento, nenhum valor será devolvido.';
  }
  if (reembolso.integral) {
    return `Você recebe de volta o valor integral: ${formatarMoedaExata(reembolso.valor_total)}.`;
  }
  return `Faltam menos de 7 dias para o check-in: a hospedagem e os serviços inclusos não são devolvidos. Você recebe de volta ${formatarMoedaExata(reembolso.valor_total)} dos serviços premium marcados para daqui a mais de 48 horas.`;
}

// H6.3: mostra ANTES quanto volta e só cancela depois da confirmação
function AcoesConfirmada({ reserva, aoCancelar }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmar, janelaConfirmacao] = useConfirmacao();

  async function cancelar() {
    setEnviando(true);
    setErro('');
    try {
      const previa = await previaCancelamento(reserva.id);
      if (!previa.pode_cancelar) {
        setErro(previa.motivo);
        return;
      }
      const confirmado = await confirmar({
        titulo: 'Cancelar a reserva?',
        texto: `${explicarReembolso(previa.reembolso)} As datas e os serviços ficam livres para outras pessoas. Essa ação não pode ser desfeita.`,
        rotuloConfirmar: 'Cancelar reserva',
        rotuloCancelar: 'Manter reserva',
      });
      if (!confirmado) return;
      const { reserva: cancelada, reembolso } = await cancelarReserva(reserva.id);
      aoCancelar(
        cancelada,
        reembolso.valor_total > 0
          ? `Reserva cancelada. O reembolso de ${formatarMoedaExata(reembolso.valor_total)} foi pedido ao Asaas e volta pelo mesmo meio de pagamento.`
          : 'Reserva cancelada.',
      );
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-4 border-t border-linha pt-4">
      <button
        type="button"
        onClick={cancelar}
        disabled={enviando}
        className="rounded-full border border-linha px-5 py-2.5 text-sm font-medium hover:border-erro hover:text-erro disabled:cursor-wait disabled:opacity-60"
      >
        {enviando ? 'Calculando…' : 'Cancelar reserva'}
      </button>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-erro">
          {erro}
        </p>
      )}
      {janelaConfirmacao}
    </div>
  );
}

function CartaoReserva({ reserva, aoMudar }) {
  const { imovel } = reserva;
  const [aviso, setAviso] = useState('');
  return (
    <li className="rounded-2xl border border-linha bg-white p-4 sm:p-6">
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
          {reserva.inclusos.length > 0 && (
            <div className="mt-4">
              <TituloParte>Serviços inclusos</TituloParte>
              <InclusosReserva inclusos={reserva.inclusos} />
            </div>
          )}
          <div className="mt-4">
            {reserva.inclusos.length > 0 && <TituloParte>Serviços premium</TituloParte>}
            <ItensReserva itens={reserva.itens} />
          </div>
        </div>
      </div>

      <dl className="mt-4 space-y-1 border-t border-linha pt-4 text-sm sm:ml-auto sm:max-w-xs">
        <div className="flex justify-between">
          <dt className="text-grafite">Hospedagem</dt>
          <dd>{formatarMoeda(reserva.valor_hospedagem)}</dd>
        </div>
        {reserva.valor_inclusos > 0 && (
          <div className="flex justify-between">
            <dt className="text-grafite">Serviços inclusos</dt>
            <dd>{formatarMoeda(reserva.valor_inclusos)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-grafite">Serviços premium</dt>
          <dd>{formatarMoeda(reserva.valor_servicos_premium)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Total</dt>
          <dd>{formatarMoeda(reserva.valor_total)}</dd>
        </div>
        {reserva.valor_reembolsado > 0 && (
          <div className="flex justify-between text-ouro-escuro">
            <dt>Reembolsado</dt>
            <dd>{formatarMoedaExata(reserva.valor_reembolsado)}</dd>
          </div>
        )}
      </dl>

      {reserva.status === 'pendente' && <AcoesPendente reserva={reserva} aoMudar={aoMudar} />}
      {reserva.pode_cancelar && (
        <AcoesConfirmada
          reserva={reserva}
          aoCancelar={(cancelada, mensagem) => {
            setAviso(mensagem);
            aoMudar(cancelada);
          }}
        />
      )}
      {aviso && (
        <p role="status" className="mt-4 border-t border-linha pt-4 text-sm text-ouro-escuro">
          {aviso}
        </p>
      )}
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
  useTituloPagina('Minhas reservas');
  const { dados, erro, carregando, recarregar } = useDados('minhas-reservas', listarMinhasReservas);
  // Reservas alteradas nesta tela (desistência) por cima da lista carregada
  const [alteradas, setAlteradas] = useState({});
  const reservas = (dados ?? []).map((reserva) => alteradas[reserva.id] ?? reserva);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <CabecalhoPagina rotulo="Hóspede" titulo="Minhas reservas" />

      <div className="mt-8">
        <ConteudoLista
          carregando={carregando}
          erro={erro}
          recarregar={recarregar}
          vazio={reservas.length === 0}
          tituloVazio="Nenhuma reserva ainda"
          textoVazio="Escolha um imóvel, monte sua estadia com serviços premium e reserve."
          acaoVazio={
            <Link to="/explorar" className="rounded-full bg-tinta px-6 py-3 text-sm font-medium text-marfim hover:bg-grafite">
              Explorar imóveis
            </Link>
          }
        >
          <ul className="flex flex-col gap-4">
            {reservas.map((reserva) => (
              <CartaoReserva
                key={reserva.id}
                reserva={reserva}
                aoMudar={(atualizada) => setAlteradas((atuais) => ({ ...atuais, [atualizada.id]: atualizada }))}
              />
            ))}
          </ul>
        </ConteudoLista>
      </div>
    </div>
  );
}
