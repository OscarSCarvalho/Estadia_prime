import { useId, useState } from 'react';
import Icone from '../Icone.jsx';
import CampoAreaTexto from '../CampoAreaTexto.jsx';
import { Estrelas, SeletorNota } from './Estrelas.jsx';
import { avaliar } from '../../services/avaliacoes.js';
import { ROTULO_TIPO_SERVICO } from '../../utils/perfis.js';
import { formatarDataComAno } from '../../utils/formatacao.js';

const COMENTARIO_MAXIMO = 1000;

// O imóvel e cada serviço contratado (o mesmo serviço em dias diferentes é avaliado uma vez só)
function alvosDaReserva(reserva) {
  const servicos = new Map();
  for (const item of reserva.itens) {
    if (!servicos.has(item.servico_id)) {
      servicos.set(item.servico_id, {
        tipo: 'servico',
        id: item.servico_id,
        icone: item.tipo_servico,
        titulo: ROTULO_TIPO_SERVICO[item.tipo_servico],
        subtitulo: item.prestador,
      });
    }
  }
  const imovel = { tipo: 'imovel', id: reserva.imovel.id, icone: reserva.imovel.tipo_imovel, titulo: reserva.imovel.titulo, subtitulo: 'Imóvel' };
  return [imovel, ...servicos.values()];
}

function FormularioAvaliacao({ reservaId, alvo, aoAvaliar, aoCancelar }) {
  const idFormulario = useId();
  const [nota, setNota] = useState(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar(evento) {
    evento.preventDefault();
    if (!nota) {
      setErro('Escolha de 1 a 5 estrelas.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      aoAvaliar(await avaliar(reservaId, { alvo, nota, comentario }));
    } catch (falha) {
      setErro(falha.message);
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-3 space-y-4 rounded-xl bg-marfim p-4">
      <SeletorNota nome={`nota-${idFormulario}`} nota={nota} aoEscolher={setNota} />
      <CampoAreaTexto
        rotulo="Comentário (opcional)"
        rows={3}
        maxLength={COMENTARIO_MAXIMO}
        value={comentario}
        onChange={(evento) => setComentario(evento.target.value)}
        placeholder="O que tornou a experiência especial? O que poderia melhorar?"
        ajuda={`${comentario.length}/${COMENTARIO_MAXIMO} caracteres. Aparece com o seu primeiro nome.`}
      />
      {erro && (
        <p role="alert" className="text-sm text-erro">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-full bg-tinta px-5 py-2.5 text-sm font-medium text-marfim hover:bg-grafite disabled:cursor-wait disabled:opacity-60"
        >
          {enviando ? 'Enviando…' : 'Enviar avaliação'}
        </button>
        <button type="button" onClick={aoCancelar} className="rounded-full px-5 py-2.5 text-sm font-medium hover:bg-areia">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function AlvoAvaliavel({ reservaId, alvo, feita, liberada, aoAvaliar }) {
  const [aberto, setAberto] = useState(false);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <Icone nome={alvo.icone} tamanho={18} className="shrink-0 text-ouro-escuro" />
          <span className="min-w-0">
            <span className="font-medium">{alvo.titulo}</span>
            <span className="text-grafite"> · {alvo.subtitulo}</span>
          </span>
        </p>
        {feita ? (
          <Estrelas nota={feita.nota} />
        ) : (
          liberada &&
          !aberto && (
            <button
              type="button"
              onClick={() => setAberto(true)}
              className="rounded-full border border-tinta px-4 py-1.5 text-sm font-medium hover:bg-tinta hover:text-marfim"
            >
              Avaliar
            </button>
          )
        )}
      </div>
      {feita?.comentario && <p className="mt-1.5 whitespace-pre-line pl-7 text-sm text-grafite">“{feita.comentario}”</p>}
      {!feita && aberto && (
        <FormularioAvaliacao reservaId={reservaId} alvo={alvo} aoAvaliar={aoAvaliar} aoCancelar={() => setAberto(false)} />
      )}
    </li>
  );
}

// H7.1 em "Minhas reservas". `reserva.avaliacao` vem da API: { situacao, ultimo_dia, feitas }
export default function AvaliarEstadia({ reserva, aoAvaliar }) {
  const { avaliacao } = reserva;
  if (!avaliacao) return null;

  if (avaliacao.situacao === 'aguardando_checkout') {
    return (
      <p className="mt-4 flex items-center gap-2 border-t border-linha pt-4 text-sm text-grafite">
        <Icone nome="estrela" tamanho={16} className="shrink-0" />
        Depois do check-out você poderá avaliar o imóvel e os serviços, até {formatarDataComAno(avaliacao.ultimo_dia)}.
      </p>
    );
  }

  const liberada = avaliacao.situacao === 'liberada';
  const alvos = alvosDaReserva(reserva);
  const feitaDe = (alvo) => avaliacao.feitas.find((feita) => feita.tipo_alvo === alvo.tipo && feita.alvo_id === alvo.id);
  const faltam = alvos.filter((alvo) => !feitaDe(alvo)).length;
  if (!liberada && faltam === alvos.length) {
    return (
      <p className="mt-4 border-t border-linha pt-4 text-sm text-grafite">
        O prazo para avaliar esta estadia terminou em {formatarDataComAno(avaliacao.ultimo_dia)}.
      </p>
    );
  }

  return (
    <section className="mt-4 border-t border-linha pt-4" aria-label="Avaliação da estadia">
      <h3 className="font-titulo text-2xl font-semibold">{faltam === 0 ? 'Obrigado pela avaliação' : 'Como foi a sua estadia?'}</h3>
      <p className="text-sm text-grafite">
        {liberada && faltam > 0
          ? `Avalie até ${formatarDataComAno(avaliacao.ultimo_dia)}. Sua opinião ajuda outros hóspedes.`
          : 'Suas avaliações já aparecem para outros hóspedes.'}
      </p>
      <ul className="mt-1 divide-y divide-linha">
        {alvos.map((alvo) => (
          <AlvoAvaliavel
            key={`${alvo.tipo}-${alvo.id}`}
            reservaId={reserva.id}
            alvo={alvo}
            feita={feitaDe(alvo)}
            liberada={liberada}
            aoAvaliar={aoAvaliar}
          />
        ))}
      </ul>
    </section>
  );
}
