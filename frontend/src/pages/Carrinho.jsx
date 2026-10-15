import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import Icone from '../components/Icone.jsx';
import ErroCarregamento from '../components/ErroCarregamento.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import { ImovelCarregando } from '../components/Esqueletos.jsx';
import Avaliacao from '../components/explorar/Avaliacao.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useDados } from '../hooks/useDados.js';
import { useTituloPagina } from '../hooks/useTituloPagina.js';
import { listarServicosDaEstadia, obterImovel, verificarDisponibilidade } from '../services/catalogo.js';
import { chaveCarrinho, lerCarrinho, salvarCarrinho } from '../services/carrinhoSalvo.js';
import { criarReserva } from '../services/reservas.js';
import {
  QUANTIDADE_MAXIMA_SERVICO,
  adicionarItem,
  alterarQuantidade,
  calcularResumo,
  diasDaEstadia,
  manterItensValidos,
  problemaNaEstadia,
  removerItem,
} from '../utils/carrinho.js';
import { ROTULO_TIPO_IMOVEL, ROTULO_TIPO_SERVICO, ROTULO_UNIDADE_PRECO } from '../utils/perfis.js';
import { formatarDataCurta, formatarDiaDaSemana, formatarMoeda, hojeIso } from '../utils/formatacao.js';

const SOMBRA_CARTAO = 'shadow-[0_6px_20px_rgba(28,27,31,0.10)]';

function plural(quantidade, singular, pluralTexto) {
  return `${quantidade} ${quantidade === 1 ? singular : pluralTexto}`;
}

function rotuloQuantidade(unidadePreco) {
  return unidadePreco === 'hora' ? 'Horas' : 'Quantidade';
}

function SeletorQuantidade({ valor, aoMudar, rotulo }) {
  const botao =
    'grid h-8 w-8 place-items-center rounded-full border border-borda text-grafite transition-colors hover:border-tinta hover:text-tinta disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-borda';

  return (
    <div role="group" aria-label={rotulo} className="inline-flex items-center gap-3">
      <button type="button" onClick={() => aoMudar(valor - 1)} disabled={valor <= 1} aria-label={`Diminuir ${rotulo}`} className={botao}>
        <Icone nome="menos" tamanho={14} />
      </button>
      <span className="min-w-5 text-center tabular-nums">{valor}</span>
      <button
        type="button"
        onClick={() => aoMudar(valor + 1)}
        disabled={valor >= QUANTIDADE_MAXIMA_SERVICO}
        aria-label={`Aumentar ${rotulo}`}
        className={botao}
      >
        <Icone nome="mais" tamanho={14} />
      </button>
    </div>
  );
}

function Bloqueio({ icone = 'calendario', titulo, texto, link, rotuloLink }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24">
      <EstadoVazio TagTitulo="h1" icone={icone} titulo={titulo} texto={texto}>
        <Link to={link} className="rounded-full bg-tinta px-6 py-3 text-sm font-medium text-marfim hover:bg-grafite">
          {rotuloLink}
        </Link>
      </EstadoVazio>
    </div>
  );
}

function ServicoParaAdicionar({ servico, dias, aoAdicionar }) {
  const diasLivres = dias.filter((opcao) => !servico.dias_indisponiveis.includes(opcao));
  const [diaEscolhido, setDia] = useState(diasLivres[0] ?? '');
  // Se o dia escolhido acabou de ficar ocupado (recusa da API), volta para o primeiro livre
  const dia = diasLivres.includes(diaEscolhido) ? diaEscolhido : (diasLivres[0] ?? '');
  const [quantidade, setQuantidade] = useState(1);
  const [adicionado, setAdicionado] = useState(false);
  const idCampoDia = `dia-servico-${servico.id}`;
  const rotulo = rotuloQuantidade(servico.unidade_preco);

  function adicionar() {
    aoAdicionar({ servico_id: servico.id, data_servico: dia, quantidade });
    setQuantidade(1);
    setAdicionado(true);
  }

  return (
    <li className="rounded-2xl border border-linha p-4 sm:p-5">
      <div className="flex gap-4">
        <img src={servico.foto} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold">
            <Icone nome={servico.tipo_servico} tamanho={16} className="text-ouro-escuro" />
            {ROTULO_TIPO_SERVICO[servico.tipo_servico]}
          </p>
          <p className="text-sm text-grafite">
            {servico.prestador} · <Avaliacao nota={servico.nota_media} total={servico.total_avaliacoes} mostrarTotal />
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-grafite">{servico.descricao}</p>
          <p className="mt-1 text-sm">
            <span className="font-semibold">{formatarMoeda(servico.preco)}</span>
            <span className="text-grafite"> / {ROTULO_UNIDADE_PRECO[servico.unidade_preco]}</span>
          </p>
        </div>
      </div>

      {diasLivres.length === 0 ? (
        <p className="mt-4 border-t border-linha pt-4 text-sm text-grafite">
          Este prestador já está contratado em todos os dias da sua estadia.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4 border-t border-linha pt-4">
          <div className="min-w-44 flex-1">
            <label htmlFor={idCampoDia} className="mb-1 block text-[10px] font-bold uppercase tracking-wide">
              Dia
            </label>
            <select
              id={idCampoDia}
              value={dia}
              onChange={(e) => {
                setDia(e.target.value);
                setAdicionado(false);
              }}
              className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm"
            >
              {dias.map((opcao) => {
                const ocupado = servico.dias_indisponiveis.includes(opcao);
                return (
                  <option key={opcao} value={opcao} disabled={ocupado}>
                    {formatarDiaDaSemana(opcao)}
                    {ocupado ? ' · indisponível' : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <span aria-hidden="true" className="mb-1 block text-[10px] font-bold uppercase tracking-wide">
              {rotulo}
            </span>
            <SeletorQuantidade
              valor={quantidade}
              rotulo={rotulo.toLowerCase()}
              aoMudar={(nova) => {
                setQuantidade(nova);
                setAdicionado(false);
              }}
            />
          </div>
          <button
            type="button"
            onClick={adicionar}
            className="rounded-xl bg-tinta px-4 py-2.5 text-sm font-medium text-marfim transition-colors hover:bg-ouro-escuro"
          >
            Adicionar · {formatarMoeda(servico.preco * quantidade)}
          </button>
        </div>
      )}

      <p role="status" className="mt-2 min-h-5 text-sm text-ouro-escuro">
        {adicionado && dia === diaEscolhido ? 'Adicionado ao carrinho.' : ''}
      </p>
    </li>
  );
}

function LinhaServico({ linha, aoMudarQuantidade, aoRemover }) {
  const { servico } = linha;
  const nome = `${ROTULO_TIPO_SERVICO[servico.tipo_servico]} em ${formatarDiaDaSemana(linha.data_servico)}`;

  return (
    <li className="text-sm">
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium">
            <Icone nome={servico.tipo_servico} tamanho={15} className="shrink-0 text-ouro-escuro" />
            {ROTULO_TIPO_SERVICO[servico.tipo_servico]}
            <span className="truncate font-normal text-grafite">· {servico.prestador}</span>
          </p>
          <p className="text-grafite">
            {formatarDiaDaSemana(linha.data_servico)} · {linha.quantidade} × {formatarMoeda(servico.preco)}
          </p>
        </div>
        <span className="font-medium">{formatarMoeda(linha.valor)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <SeletorQuantidade
          valor={linha.quantidade}
          rotulo={`${rotuloQuantidade(servico.unidade_preco).toLowerCase()} de ${nome}`}
          aoMudar={aoMudarQuantidade}
        />
        <button
          type="button"
          onClick={aoRemover}
          aria-label={`Remover ${nome}`}
          className="inline-flex items-center gap-1 text-grafite underline-offset-4 hover:text-erro hover:underline"
        >
          <Icone nome="lixeira" tamanho={15} /> Remover
        </button>
      </div>
    </li>
  );
}

function Resumo({
  imovel,
  checkin,
  checkout,
  hospedes,
  noites,
  resumo,
  linkImovel,
  enviando,
  aviso,
  aoConfirmar,
  aoMudarQuantidade,
  aoRemover,
}) {
  return (
    <div id="resumo" className={`scroll-mt-6 rounded-2xl border border-linha bg-white p-6 ${SOMBRA_CARTAO}`}>
      <div className="flex gap-4 border-b border-linha pb-5">
        <img src={imovel.fotos[0]} alt="" className="h-24 w-28 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0">
          <p className="text-xs text-grafite">
            {ROTULO_TIPO_IMOVEL[imovel.tipo_imovel]} em {imovel.cidade}, {imovel.estado}
          </p>
          <p className="font-semibold leading-snug">{imovel.titulo}</p>
          <Avaliacao nota={imovel.nota_media} total={imovel.total_avaliacoes} mostrarTotal className="mt-1 text-xs" />
        </div>
      </div>

      <section aria-labelledby="titulo-viagem" className="border-b border-linha py-5">
        <div className="flex items-baseline justify-between">
          <h2 id="titulo-viagem" className="font-semibold">
            Sua viagem
          </h2>
          <Link to={linkImovel} className="text-sm font-medium underline underline-offset-4 hover:text-ouro-escuro">
            Alterar
          </Link>
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-grafite">
          <Icone nome="calendario" tamanho={16} />
          {formatarDataCurta(checkin)} – {formatarDataCurta(checkout)} · {plural(noites, 'noite', 'noites')}
        </p>
        <p className="mt-1 flex items-center gap-2 text-sm text-grafite">
          <Icone nome="hospedes" tamanho={16} />
          {plural(hospedes, 'hóspede', 'hóspedes')}
        </p>
      </section>

      <section aria-labelledby="titulo-hospedagem" className="border-b border-linha py-5">
        <h2 id="titulo-hospedagem" className="font-semibold">
          Hospedagem
        </h2>
        <p className="mt-2 flex justify-between text-sm text-grafite">
          <span>
            {formatarMoeda(imovel.preco_diaria)} × {plural(noites, 'noite', 'noites')}
          </span>
          <span>{formatarMoeda(resumo.valorHospedagem)}</span>
        </p>
      </section>

      <section aria-labelledby="titulo-servicos-carrinho" className="border-b border-linha py-5">
        <h2 id="titulo-servicos-carrinho" className="font-semibold">
          Serviços premium
        </h2>
        {resumo.linhasServicos.length === 0 ? (
          <p className="mt-2 text-sm text-grafite">Nenhum serviço adicionado ainda.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {resumo.linhasServicos.map((linha) => (
              <LinhaServico
                key={`${linha.servico_id}|${linha.data_servico}`}
                linha={linha}
                aoMudarQuantidade={(quantidade) => aoMudarQuantidade(linha, quantidade)}
                aoRemover={() => aoRemover(linha)}
              />
            ))}
          </ul>
        )}
      </section>

      <dl className="space-y-2 pt-5 text-sm">
        <div className="flex justify-between">
          <dt className="text-grafite">Hospedagem</dt>
          <dd>{formatarMoeda(resumo.valorHospedagem)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-grafite">Serviços</dt>
          <dd>{formatarMoeda(resumo.valorServicos)}</dd>
        </div>
        <div className="flex justify-between border-t border-linha pt-3 text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatarMoeda(resumo.valorTotal)}</dd>
        </div>
      </dl>

      {aviso && (
        <div role="alert" className="mt-5 rounded-lg border border-erro/30 bg-erro-fundo px-4 py-3 text-sm text-erro">
          {aviso.texto}
          {aviso.link && (
            <>
              {' '}
              <Link to={aviso.link} className="font-medium underline underline-offset-4">
                {aviso.rotuloLink}
              </Link>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={aoConfirmar}
        disabled={enviando}
        aria-busy={enviando || undefined}
        className="mt-5 w-full rounded-xl bg-tinta py-3.5 font-medium text-marfim transition-colors hover:bg-ouro-escuro disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? 'Reservando…' : 'Confirmar reserva'}
      </button>
      <p className="mt-3 text-center text-sm text-grafite">
        Você ainda não será cobrado. As datas e os serviços ficam guardados por 30 minutos até o pagamento.
      </p>
    </div>
  );
}

// Mensagem para cada recusa da API ao confirmar. `item`: o serviço/dia que causou a recusa, se houver
function avisoDaRecusa(erro, { linkImovel, servicos }) {
  const item = erro.detalhes ?? {};
  const servico = servicos.find((opcao) => opcao.id === item.servico_id);
  const nomeServico = servico ? `${ROTULO_TIPO_SERVICO[servico.tipo_servico]} (${servico.prestador})` : 'Um serviço';
  switch (erro.codigo) {
    case 'IMOVEL_INDISPONIVEL':
      return { texto: 'Outra pessoa acabou de reservar parte dessas datas.', link: linkImovel, rotuloLink: 'Escolher outras datas' };
    case 'PRESTADOR_INDISPONIVEL':
      return {
        texto: `${nomeServico} acabou de ser contratado em ${formatarDiaDaSemana(item.data_servico)} por outra pessoa. Tiramos esse item do carrinho: escolha outro dia.`,
      };
    case 'SERVICO_INDISPONIVEL':
      return { texto: `${nomeServico} não está mais disponível. Tiramos esse serviço do carrinho.` };
    case 'NAO_AUTENTICADO':
      return { texto: 'Sua sessão terminou. Entre de novo para confirmar.', link: '/entrar', rotuloLink: 'Entrar' };
    default:
      return { texto: erro.message };
  }
}

function MontagemCarrinho({ chave, imovel, servicos: servicosCarregados, checkin, checkout, hospedes, linkImovel }) {
  const navegar = useNavigate();
  const dias = diasDaEstadia(checkin, checkout);
  const noites = dias.length - 1;
  // Recusas da API (prestador contratado por outra pessoa, serviço desativado) atualizam esta lista na hora
  const [servicos, setServicos] = useState(servicosCarregados);
  const [itens, setItens] = useState(() => manterItensValidos(lerCarrinho(chave), servicosCarregados, dias));
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const resumo = calcularResumo({ precoDiaria: imovel.preco_diaria, noites, itens, servicos });

  function atualizarItens(alterar) {
    const novos = alterar(itens);
    setItens(novos);
    salvarCarrinho(chave, novos);
    setAviso(null);
  }

  function tirarDoCarrinho(erro) {
    const { servico_id: servicoId, data_servico: dia } = erro.detalhes ?? {};
    if (erro.codigo === 'PRESTADOR_INDISPONIVEL') {
      setServicos((atuais) =>
        atuais.map((servico) =>
          servico.id === servicoId ? { ...servico, dias_indisponiveis: [...servico.dias_indisponiveis, dia] } : servico,
        ),
      );
      atualizarItens((atuais) => atuais.filter((item) => !(item.servico_id === servicoId && item.data_servico === dia)));
    } else if (erro.codigo === 'SERVICO_INDISPONIVEL') {
      setServicos((atuais) => atuais.filter((servico) => servico.id !== servicoId));
      atualizarItens((atuais) => atuais.filter((item) => item.servico_id !== servicoId));
    }
  }

  async function confirmarReserva() {
    setEnviando(true);
    setAviso(null);
    try {
      const reserva = await criarReserva({ imovelId: imovel.id, checkin, checkout, hospedes, itens });
      salvarCarrinho(chave, []);
      navegar('/minhas-reservas', { state: { reservaCriada: reserva.id } });
    } catch (erro) {
      tirarDoCarrinho(erro);
      setAviso(avisoDaRecusa(erro, { linkImovel, servicos }));
      setEnviando(false);
    }
  }

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:pb-20">
        <Link to={linkImovel} className="inline-flex items-center gap-1 text-sm font-medium text-grafite hover:text-tinta">
          <Icone nome="anterior" tamanho={16} /> Voltar ao imóvel
        </Link>
        <h1 className="mt-4 font-titulo text-4xl font-semibold sm:text-5xl">Monte sua estadia</h1>
        <p className="mt-2 text-grafite">Adicione serviços premium e confira o total antes de pagar.</p>

        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_26rem]">
          <section aria-labelledby="titulo-servicos-estadia">
            <h2 id="titulo-servicos-estadia" className="font-titulo text-3xl font-semibold">
              Serviços em {imovel.cidade}
            </h2>
            <p className="mt-1 text-grafite">
              Escolha o dia e a quantidade. O serviço pode ser no dia do check-in, do check-out ou entre eles.
            </p>
            {servicos.length > 0 ? (
              <ul className="mt-6 space-y-4">
                {servicos.map((servico) => (
                  <ServicoParaAdicionar
                    key={servico.id}
                    servico={servico}
                    dias={dias}
                    aoAdicionar={(item) => atualizarItens((atuais) => adicionarItem(atuais, item))}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-grafite">
                Ainda não há prestadores em {imovel.cidade}. Você pode seguir só com a hospedagem.
              </p>
            )}
          </section>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Resumo
              imovel={imovel}
              checkin={checkin}
              checkout={checkout}
              hospedes={hospedes}
              noites={noites}
              resumo={resumo}
              linkImovel={linkImovel}
              enviando={enviando}
              aviso={aviso}
              aoConfirmar={confirmarReserva}
              aoMudarQuantidade={(linha, quantidade) => atualizarItens((atuais) => alterarQuantidade(atuais, linha, quantidade))}
              aoRemover={(linha) => atualizarItens((atuais) => removerItem(atuais, linha))}
            />
          </aside>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 flex items-center justify-between gap-4 border-t border-linha bg-white px-4 py-3 lg:hidden">
        <div>
          <p className="font-semibold">{formatarMoeda(resumo.valorTotal)}</p>
          <p className="text-xs text-grafite">
            {plural(noites, 'noite', 'noites')} · {plural(resumo.linhasServicos.length, 'serviço', 'serviços')}
          </p>
        </div>
        <a href="#resumo" className="rounded-xl bg-tinta px-5 py-3 text-sm font-medium text-marfim">
          Ver resumo
        </a>
      </div>
    </div>
  );
}

export default function Carrinho() {
  const { id } = useParams();
  const [parametros] = useSearchParams();
  const { usuario } = useAuth();
  useTituloPagina('Monte sua estadia');

  const checkin = parametros.get('checkin') ?? '';
  const checkout = parametros.get('checkout') ?? '';
  const hospedes = Number(parametros.get('hospedes') ?? '1');
  const linkImovel = `/imoveis/${id}?${parametros}`;

  const { dados, erro, carregando, recarregar } = useDados(`carrinho|${id}|${checkin}|${checkout}`, async () => {
    const [detalhe, disponivel, servicos] = await Promise.all([
      obterImovel(id),
      verificarDisponibilidade(id, checkin, checkout),
      listarServicosDaEstadia(id, checkin, checkout),
    ]);
    return { detalhe, disponivel, servicos };
  });

  if (carregando) return <ImovelCarregando />;

  if (erro) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <ErroCarregamento erro={erro} aoTentarDeNovo={recarregar} />
      </div>
    );
  }

  if (!dados?.detalhe) {
    return <Bloqueio icone="casa" titulo="Imóvel não encontrado" link="/explorar" rotuloLink="Voltar para a busca" />;
  }

  const { imovel } = dados.detalhe;

  if (usuario.tipo !== 'hospede') {
    return (
      <Bloqueio
        icone="hospedes"
        titulo="Use uma conta de hóspede"
        texto="Reservas são feitas com uma conta de hóspede. Saia e entre com ela para montar o carrinho."
        link={linkImovel}
        rotuloLink="Voltar ao imóvel"
      />
    );
  }

  const problema = problemaNaEstadia({ checkin, checkout, hospedes, capacidade: imovel.num_hospedes, hoje: hojeIso() });
  if (problema) {
    return <Bloqueio titulo="Revise sua estadia" texto={problema} link={linkImovel} rotuloLink="Escolher as datas" />;
  }

  if (!dados.disponivel) {
    return (
      <Bloqueio
        titulo="Imóvel indisponível nessas datas"
        texto="Outra pessoa já reservou parte desse período. Escolha outras datas."
        link={linkImovel}
        rotuloLink="Escolher outras datas"
      />
    );
  }

  const chave = chaveCarrinho({ imovelId: imovel.id, checkin, checkout });
  return (
    <MontagemCarrinho
      key={chave}
      chave={chave}
      imovel={imovel}
      servicos={dados.servicos}
      checkin={checkin}
      checkout={checkout}
      hospedes={hospedes}
      linkImovel={linkImovel}
    />
  );
}
