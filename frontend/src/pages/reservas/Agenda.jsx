import { Link } from 'react-router';
import Icone from '../../components/Icone.jsx';
import { CabecalhoPagina, ConteudoLista, SeloReserva } from '../../components/reservas/PartesReserva.jsx';
import { useDados } from '../../hooks/useDados.js';
import { useTituloPagina } from '../../hooks/useTituloPagina.js';
import { obterAgenda } from '../../services/reservas.js';
import { ROTULO_TIPO_SERVICO, descreverQuantidade } from '../../utils/perfis.js';
import { formatarDataComAno, formatarDiaDaSemana, formatarMoeda, formatarTelefone } from '../../utils/formatacao.js';

// A API já devolve em ordem de data: agrupa os serviços do mesmo dia
function agruparPorDia(agenda) {
  const grupos = new Map();
  for (const item of agenda) {
    if (!grupos.has(item.data_servico)) grupos.set(item.data_servico, []);
    grupos.get(item.data_servico).push(item);
  }
  return [...grupos];
}

// H3.3. Endereço do imóvel e telefone do hóspede só com reserva confirmada (RN12, LGPD)
function ItemAgenda({ item }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-linha bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="inline-flex items-center gap-1.5 font-semibold">
            <Icone nome={item.tipo_servico} tamanho={18} className="text-ouro-escuro" />
            {ROTULO_TIPO_SERVICO[item.tipo_servico]} · {descreverQuantidade(item.quantidade, item.unidade_preco)}
          </h3>
          <SeloReserva status={item.reserva.status} />
        </div>
        <p className="mt-1 text-sm">
          {item.imovel.titulo}
          <span className="text-grafite">
            {' '}
            · {item.imovel.endereco ? `${item.imovel.endereco}, ` : ''}
            {item.imovel.cidade}, {item.imovel.estado}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-grafite">
          Hóspede: {item.hospede.nome}
          {item.hospede.telefone && ` · ${formatarTelefone(item.hospede.telefone)}`} · estadia de{' '}
          {formatarDataComAno(item.reserva.data_checkin)} a {formatarDataComAno(item.reserva.data_checkout)}
        </p>
      </div>
      <dl className="shrink-0 text-sm sm:text-right">
        <dt className="text-grafite">Você recebe</dt>
        <dd className="text-lg font-semibold">{formatarMoeda(item.repasse)}</dd>
      </dl>
    </li>
  );
}

export default function Agenda() {
  useTituloPagina('Minha agenda');
  const { dados: agenda, erro, carregando, recarregar } = useDados('agenda', obterAgenda);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <CabecalhoPagina rotulo="Painel do prestador" titulo="Minha agenda">
        <Link to="/painel/servicos" className="text-sm font-semibold underline underline-offset-4">
          Meus serviços
        </Link>
      </CabecalhoPagina>
      <p className="mt-3 text-grafite">
        O endereço e o telefone do hóspede aparecem quando a reserva é confirmada. O valor, já descontada a comissão, é
        repassado 24 horas depois do check-in.
      </p>

      <div className="mt-8">
        <ConteudoLista
          carregando={carregando}
          erro={erro}
          recarregar={recarregar}
          vazio={agenda?.length === 0}
          tituloVazio="Agenda livre"
          textoVazio="Quando um hóspede contratar um dos seus serviços, o dia aparece aqui."
        >
          <div className="space-y-8">
            {agruparPorDia(agenda ?? []).map(([dia, itens]) => (
              <section key={dia} aria-labelledby={`dia-${dia}`}>
                <h2 id={`dia-${dia}`} className="mb-3 font-titulo text-2xl font-semibold capitalize">
                  {formatarDiaDaSemana(dia)} <span className="text-grafite">{dia.slice(0, 4)}</span>
                </h2>
                <ul className="space-y-3">
                  {itens.map((item) => (
                    <ItemAgenda key={item.id} item={item} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </ConteudoLista>
      </div>
    </div>
  );
}
