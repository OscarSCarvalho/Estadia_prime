import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import Icone from '../../components/Icone.jsx';
import Alerta from '../../components/Alerta.jsx';
import CampoTexto from '../../components/CampoTexto.jsx';
import ErroCarregamento from '../../components/ErroCarregamento.jsx';
import { CarregandoSimples } from '../../components/Esqueletos.jsx';
import { InclusosReserva, ItensReserva, PeriodoReserva, TituloParte } from '../../components/reservas/PartesReserva.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useTituloPagina } from '../../hooks/useTituloPagina.js';
import { atualizarDocumento, iniciarPagamento, obterSituacaoPagamento, simularPagamento } from '../../services/pagamentos.js';
import { formatarMoedaExata, mascararDocumentoDigitado } from '../../utils/formatacao.js';

const CONSULTA_A_CADA_MS = 5000;
const METODOS = [
  { valor: 'pix', rotulo: 'Pix', icone: 'pix' },
  { valor: 'cartao', rotulo: 'Cartão de crédito', icone: 'cartao' },
];

// RN07: a reserva fica guardada 30 minutos. Mostra mm:ss e avisa quando acabar
function ContagemRegressiva({ prazo, aoTerminar }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(relogio);
  }, []);
  const restanteMs = Math.max(0, Date.parse(prazo) - agora);
  useEffect(() => {
    if (restanteMs === 0) aoTerminar();
  }, [restanteMs, aoTerminar]);

  const minutos = String(Math.floor(restanteMs / 60000)).padStart(2, '0');
  const segundos = String(Math.floor((restanteMs % 60000) / 1000)).padStart(2, '0');
  const acabando = restanteMs < 5 * 60000;
  return (
    <p className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${acabando ? 'bg-erro-fundo text-erro' : 'bg-ouro/15 text-ouro-escuro'}`}>
      <Icone nome="relogio" tamanho={18} />
      Datas guardadas por mais <span className="font-semibold tabular-nums" aria-live="off">{minutos}:{segundos}</span>
    </p>
  );
}

// O Asaas exige CPF ou CNPJ de quem paga. Pedido uma vez; depois a conta mostra só mascarado
function FormularioCpf({ aoSalvar }) {
  const [documento, setDocumento] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function salvar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setErro('');
    try {
      aoSalvar(await atualizarDocumento(documento));
    } catch (falha) {
      setErro(falha.detalhes?.cpf_cnpj ?? falha.message);
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="rounded-2xl border border-linha bg-white p-5 sm:p-6">
      <h2 className="font-semibold">Informe seu CPF para pagar</h2>
      <p className="mt-1 text-sm text-grafite">
        O Asaas, nosso parceiro de pagamentos, exige o CPF (ou CNPJ) de quem paga. Ele fica guardado com segurança e aparece mascarado na sua conta.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <CampoTexto
            rotulo="CPF ou CNPJ"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={documento}
            onChange={(e) => setDocumento(mascararDocumentoDigitado(e.target.value))}
            erro={erro}
            required
          />
        </div>
        <button
          type="submit"
          disabled={enviando}
          className="rounded-full bg-tinta px-6 py-3 font-medium text-marfim hover:bg-grafite disabled:cursor-wait disabled:opacity-70 sm:mt-7"
        >
          {enviando ? 'Salvando…' : 'Continuar'}
        </button>
      </div>
    </form>
  );
}

function BotaoCopiar({ texto }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }
  return (
    <button
      type="button"
      onClick={copiar}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-tinta px-5 py-3 text-sm font-medium text-marfim hover:bg-grafite"
    >
      <Icone nome={copiado ? 'confirmado' : 'copiar'} tamanho={18} />
      {copiado ? 'Copiado!' : 'Copiar código'}
    </button>
  );
}

// Só com o gateway falso (desenvolvimento): o mesmo aviso que o Asaas mandaria ao receber
function SimularPagamento({ reservaId, aoSimular }) {
  const [enviando, setEnviando] = useState(false);
  async function simular() {
    setEnviando(true);
    try {
      await simularPagamento(reservaId);
    } finally {
      setEnviando(false);
      aoSimular();
    }
  }
  return (
    <div className="mt-5 rounded-xl border border-dashed border-ouro bg-ouro/10 p-4 text-sm">
      <p className="font-semibold">Ambiente de teste</p>
      <p className="mt-1 text-grafite">Nenhum dinheiro de verdade passa aqui. Use o botão para fazer de conta que o pagamento chegou.</p>
      <button
        type="button"
        onClick={simular}
        disabled={enviando}
        className="mt-3 rounded-full border border-tinta px-5 py-2.5 font-medium hover:bg-tinta hover:text-marfim disabled:cursor-wait disabled:opacity-60"
      >
        {enviando ? 'Simulando…' : 'Simular pagamento aprovado'}
      </button>
    </div>
  );
}

function PainelPix({ pagamento, reservaId, aoAtualizar }) {
  return (
    <div>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <img
          src={`data:image/png;base64,${pagamento.pix_qr_base64}`}
          alt="QR Code do Pix"
          className="size-52 shrink-0 rounded-xl border border-linha bg-white p-2 [image-rendering:pixelated]"
        />
        <ol className="space-y-2 text-sm text-grafite">
          <li>1. Abra o app do seu banco e escolha <strong className="text-tinta">Pix → Ler QR Code</strong>.</li>
          <li>2. Ou copie o código abaixo e use <strong className="text-tinta">Pix Copia e Cola</strong>.</li>
          <li>3. Confirme o valor de <strong className="text-tinta">{formatarMoedaExata(pagamento.valor)}</strong>. Esta página atualiza sozinha.</li>
        </ol>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <code className="block min-w-0 flex-1 truncate rounded-lg border border-linha bg-marfim px-3 py-3 text-xs">{pagamento.pix_copia_cola}</code>
        <BotaoCopiar texto={pagamento.pix_copia_cola} />
      </div>
      <p className="mt-4 inline-flex items-center gap-2 text-sm text-grafite" role="status">
        <span className="size-2 animate-pulse rounded-full bg-ouro" aria-hidden="true" />
        Aguardando o pagamento…
      </p>
      {pagamento.simulavel && <SimularPagamento reservaId={reservaId} aoSimular={aoAtualizar} />}
    </div>
  );
}

// O cartão é digitado na página segura do Asaas: o site nunca vê os dados do cartão (sem escopo PCI)
function PainelCartao({ pagamento, reservaId, aoAtualizar }) {
  const [abriu, setAbriu] = useState(false);
  return (
    <div>
      <p className="flex items-start gap-2 text-sm text-grafite">
        <Icone nome="cadeado" tamanho={18} className="mt-0.5 shrink-0 text-ouro-escuro" />
        Você paga à vista na página segura do Asaas, nosso parceiro de pagamentos. Os dados do cartão não passam pela Estadia Prime.
      </p>
      {pagamento.url_fatura && (
        <a
          href={pagamento.url_fatura}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setAbriu(true)}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-tinta px-6 py-3.5 font-medium text-marfim hover:bg-grafite"
        >
          <Icone nome="cartao" tamanho={18} /> Pagar {formatarMoedaExata(pagamento.valor)} com cartão
        </a>
      )}
      {abriu && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-grafite" role="status">
          <span className="size-2 animate-pulse rounded-full bg-ouro" aria-hidden="true" />
          Aguardando confirmação do pagamento… Ao terminar na página do Asaas, volte para esta aba.
        </p>
      )}
      {pagamento.simulavel && <SimularPagamento reservaId={reservaId} aoSimular={aoAtualizar} />}
    </div>
  );
}

function ResumoReserva({ reserva }) {
  const { imovel } = reserva;
  return (
    <aside className="h-fit rounded-2xl border border-linha bg-white p-5 sm:p-6 lg:sticky lg:top-24">
      <div className="flex gap-4">
        {imovel.foto && <img src={imovel.foto} alt="" className="size-20 shrink-0 rounded-xl object-cover" />}
        <div className="min-w-0">
          <p className="font-semibold">{imovel.titulo}</p>
          <p className="text-sm text-grafite">
            {imovel.cidade}, {imovel.estado}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <PeriodoReserva reserva={reserva} />
      </div>
      {reserva.inclusos.length > 0 && (
        <div className="mt-4">
          <TituloParte>Serviços inclusos</TituloParte>
          <InclusosReserva inclusos={reserva.inclusos} />
        </div>
      )}
      {reserva.itens.length > 0 && (
        <div className="mt-4">
          <TituloParte>Serviços premium</TituloParte>
          <ItensReserva itens={reserva.itens} />
        </div>
      )}
      <dl className="mt-4 space-y-1 border-t border-linha pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-grafite">Hospedagem</dt>
          <dd>{formatarMoedaExata(reserva.valor_hospedagem)}</dd>
        </div>
        {reserva.valor_inclusos > 0 && (
          <div className="flex justify-between">
            <dt className="text-grafite">Serviços inclusos</dt>
            <dd>{formatarMoedaExata(reserva.valor_inclusos)}</dd>
          </div>
        )}
        {reserva.valor_servicos_premium > 0 && (
          <div className="flex justify-between">
            <dt className="text-grafite">Serviços premium</dt>
            <dd>{formatarMoedaExata(reserva.valor_servicos_premium)}</dd>
          </div>
        )}
        <div className="flex justify-between pt-1 text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatarMoedaExata(reserva.valor_total)}</dd>
        </div>
      </dl>
    </aside>
  );
}

// RN08 + RN12: confirmada só pelo aviso do gateway; aí o endereço completo é liberado
function Confirmacao({ reserva }) {
  const { imovel } = reserva;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <Icone nome="confirmado" tamanho={56} className="mx-auto text-ouro-escuro" />
        <h1 className="mt-4 font-titulo text-4xl font-semibold sm:text-5xl">Pagamento confirmado</h1>
        <p className="mt-2 text-grafite">Sua estadia está reservada. Os anfitriões e prestadores já foram avisados.</p>
      </div>
      <div className="mt-8 rounded-2xl border border-ouro/60 bg-white p-5 sm:p-6">
        <p className="font-semibold">{imovel.titulo}</p>
        {imovel.endereco && (
          <p className="mt-1 flex items-start gap-1.5 text-sm">
            <Icone nome="local" tamanho={16} className="mt-0.5 shrink-0 text-ouro-escuro" />
            <span>
              {imovel.endereco}, {imovel.cidade}, {imovel.estado}
            </span>
          </p>
        )}
        <div className="mt-3">
          <PeriodoReserva reserva={reserva} />
        </div>
        <p className="mt-4 flex justify-between border-t border-linha pt-4 font-semibold">
          <span>Total pago</span>
          <span>{formatarMoedaExata(reserva.valor_total)}</span>
        </p>
      </div>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link to="/minhas-reservas" className="rounded-full bg-tinta px-6 py-3 font-medium text-marfim hover:bg-grafite">
          Ver minhas reservas
        </Link>
        <Link to={`/imoveis/${imovel.id}`} className="text-sm font-semibold underline underline-offset-4">
          Voltar ao imóvel
        </Link>
      </div>
    </div>
  );
}

function ReservaEncerrada({ reserva }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <Icone nome="relogio" tamanho={48} className="mx-auto text-grafite" />
      <h1 className="mt-4 font-titulo text-4xl font-semibold">O prazo para pagar terminou</h1>
      <p className="mt-3 text-grafite">
        As datas e os serviços foram liberados. Se você já pagou, o valor será devolvido automaticamente caso as datas tenham sido ocupadas.
      </p>
      <Link to={`/imoveis/${reserva.imovel.id}`} className="mt-8 inline-block rounded-full bg-tinta px-6 py-3 font-medium text-marfim hover:bg-grafite">
        Reservar de novo
      </Link>
    </div>
  );
}

export default function Pagamento() {
  const { id } = useParams();
  useTituloPagina('Pagamento');
  const { usuario, atualizarUsuario } = useAuth();
  const [situacao, setSituacao] = useState(null);
  const [erroCarga, setErroCarga] = useState(null);
  const [metodo, setMetodo] = useState('pix');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  const atualizar = useCallback(() => {
    obterSituacaoPagamento(id).then(
      (nova) => {
        setSituacao(nova);
        setErroCarga(null);
      },
      (falha) => setErroCarga(falha),
    );
  }, [id]);

  useEffect(atualizar, [atualizar]);

  // Enquanto aguarda: consulta a cada 5 s e também ao voltar para a aba (depois da fatura do cartão)
  const aguardando = situacao?.reserva.status === 'pendente';
  useEffect(() => {
    if (!aguardando) return undefined;
    const consulta = setInterval(atualizar, CONSULTA_A_CADA_MS);
    window.addEventListener('focus', atualizar);
    return () => {
      clearInterval(consulta);
      window.removeEventListener('focus', atualizar);
    };
  }, [aguardando, atualizar]);

  const pagamento = situacao?.pagamento?.status === 'pendente' ? situacao.pagamento : null;
  const metodoAtivo = pagamento?.metodo ?? metodo;

  async function gerar(novoMetodo) {
    setMetodo(novoMetodo);
    setGerando(true);
    setErro('');
    try {
      const novo = await iniciarPagamento(id, novoMetodo);
      setSituacao((atual) => ({ ...atual, pagamento: novo }));
    } catch (falha) {
      setErro(falha.message);
      atualizar();
    } finally {
      setGerando(false);
    }
  }

  if (erroCarga && !situacao) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErroCarregamento erro={erroCarga} aoTentarDeNovo={atualizar} />
      </div>
    );
  }
  if (!situacao) return <CarregandoSimples />;

  const { reserva } = situacao;
  if (reserva.status === 'confirmada' || reserva.status === 'concluida') return <Confirmacao reserva={reserva} />;
  if (reserva.status !== 'pendente') return <ReservaEncerrada reserva={reserva} />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
      <Link to="/minhas-reservas" className="inline-flex items-center gap-1 text-sm font-medium text-grafite hover:text-tinta">
        <Icone nome="anterior" tamanho={16} /> Minhas reservas
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-titulo text-4xl font-semibold sm:text-5xl">Pagamento</h1>
        <ContagemRegressiva prazo={reserva.prazo_pagamento} aoTerminar={atualizar} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {/* min-w-0: o código Pix (uma linha longa) não pode alargar a coluna no celular */}
        <section aria-labelledby="titulo-forma-pagamento" className="min-w-0">
          <h2 id="titulo-forma-pagamento" className="sr-only">
            Forma de pagamento
          </h2>
          {!usuario.cpf_cnpj ? (
            <FormularioCpf aoSalvar={atualizarUsuario} />
          ) : (
            <div className="rounded-2xl border border-linha bg-white">
              <div role="tablist" aria-label="Forma de pagamento" className="grid grid-cols-2 border-b border-linha">
                {METODOS.map((opcao) => (
                  <button
                    key={opcao.valor}
                    type="button"
                    role="tab"
                    aria-selected={metodoAtivo === opcao.valor}
                    onClick={() => setMetodo(opcao.valor)}
                    className={`flex items-center justify-center gap-2 px-3 py-4 text-sm font-semibold first:rounded-tl-2xl last:rounded-tr-2xl ${
                      metodoAtivo === opcao.valor ? 'border-b-2 border-tinta text-tinta' : 'text-grafite hover:bg-marfim'
                    }`}
                  >
                    <Icone nome={opcao.icone} tamanho={18} /> {opcao.rotulo}
                  </button>
                ))}
              </div>
              <div role="tabpanel" className="p-5 sm:p-6">
                <Alerta>{erro}</Alerta>
                {pagamento && pagamento.metodo === metodoAtivo ? (
                  metodoAtivo === 'pix' ? (
                    <PainelPix pagamento={pagamento} reservaId={id} aoAtualizar={atualizar} />
                  ) : (
                    <PainelCartao pagamento={pagamento} reservaId={id} aoAtualizar={atualizar} />
                  )
                ) : (
                  <div className={erro ? 'mt-4' : ''}>
                    <p className="text-sm text-grafite">
                      {metodoAtivo === 'pix'
                        ? 'Pague na hora com o app do seu banco. A confirmação chega em segundos.'
                        : 'Pague à vista com cartão de crédito, na página segura do Asaas.'}
                      {pagamento && ' A cobrança anterior será cancelada.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => gerar(metodoAtivo)}
                      disabled={gerando}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-tinta px-6 py-3.5 font-medium text-marfim hover:bg-grafite disabled:cursor-wait disabled:opacity-70"
                    >
                      <Icone nome={metodoAtivo === 'pix' ? 'pix' : 'cartao'} tamanho={18} />
                      {gerando ? 'Gerando cobrança…' : metodoAtivo === 'pix' ? 'Gerar Pix' : 'Pagar com cartão'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
        <ResumoReserva reserva={reserva} />
      </div>
    </div>
  );
}
