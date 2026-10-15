import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import Icone from '../components/Icone.jsx';
import ErroCarregamento from '../components/ErroCarregamento.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import Janela from '../components/Janela.jsx';
import { ImovelCarregando } from '../components/Esqueletos.jsx';
import Avaliacao from '../components/explorar/Avaliacao.jsx';
import DialogoAvaliacoes from '../components/avaliacoes/DialogoAvaliacoes.jsx';
import ListaAvaliacoes from '../components/avaliacoes/ListaAvaliacoes.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useDados } from '../hooks/useDados.js';
import { useTituloPagina } from '../hooks/useTituloPagina.js';
import { obterImovel, verificarDisponibilidade } from '../services/catalogo.js';
import { ROTULO_TIPO_IMOVEL, ROTULO_TIPO_SERVICO, ROTULO_UNIDADE_PRECO } from '../utils/perfis.js';
import { problemaNaEstadia } from '../utils/carrinho.js';
import { calcularNoites, formatarMoeda, hojeIso } from '../utils/formatacao.js';

// Todas as fotos, grandes, uma embaixo da outra (a grade da página mostra só as 5 primeiras)
function TodasAsFotos({ fotos, titulo }) {
  const referencia = useRef(null);
  const [aberta, setAberta] = useState(false);

  function abrir() {
    setAberta(true);
    referencia.current.showModal();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-xl border border-tinta bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-areia"
      >
        <Icone nome="todos" tamanho={16} />
        Mostrar todas as fotos ({fotos.length})
      </button>
      <Janela referencia={referencia} titulo={titulo} rotuloFechar="Fechar fotos" largura="max-w-4xl" aoFechar={() => setAberta(false)}>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {aberta && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {fotos.map((url, posicao) => (
                <li key={url} className={posicao % 3 === 0 ? 'sm:col-span-2' : ''}>
                  <img src={url} alt={`${titulo}, foto ${posicao + 1} de ${fotos.length}`} loading="lazy" className="w-full rounded-xl object-cover" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Janela>
    </>
  );
}

function Galeria({ fotos, titulo }) {
  const [principal, ...demais] = fotos;
  const secundarias = demais.slice(0, 4);

  return (
    <>
      <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:hidden">
        {fotos.map((url, posicao) => (
          <img
            key={url}
            src={url}
            alt={`${titulo}, foto ${posicao + 1} de ${fotos.length}`}
            loading={posicao === 0 ? 'eager' : 'lazy'}
            className="aspect-[4/3] w-[85%] shrink-0 snap-center rounded-2xl object-cover"
          />
        ))}
      </div>

      <div className="relative hidden h-[26rem] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl md:grid lg:h-[30rem]">
        <img
          src={principal}
          alt={`${titulo}, foto principal`}
          className={`h-full w-full object-cover ${secundarias.length === 0 ? 'col-span-4' : 'col-span-2'} row-span-2`}
        />
        {secundarias.map((url, posicao) => {
          const ocupacao =
            secundarias.length === 1 ? 'col-span-2 row-span-2' : secundarias.length === 2 ? 'col-span-2' : '';
          return (
            <img key={url} src={url} alt={`${titulo}, foto ${posicao + 2}`} className={`h-full w-full object-cover ${ocupacao}`} />
          );
        })}
        {fotos.length > 1 && <TodasAsFotos fotos={fotos} titulo={titulo} />}
      </div>
    </>
  );
}

function ServicoDisponivel({ servico }) {
  return (
    <li className="flex gap-4 rounded-2xl border border-linha p-3">
      <img src={servico.foto} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 text-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <Icone nome={servico.tipo_servico} tamanho={16} className="text-ouro-escuro" />
          {ROTULO_TIPO_SERVICO[servico.tipo_servico]}
        </p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-grafite">
          <span className="truncate">{servico.prestador}</span>
          <span aria-hidden="true">·</span>
          <Avaliacao nota={servico.nota_media} />
          {servico.total_avaliacoes > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <DialogoAvaliacoes
                alvo={{ tipo: 'servico', id: servico.id }}
                titulo={`${ROTULO_TIPO_SERVICO[servico.tipo_servico]} · ${servico.prestador}`}
                total={servico.total_avaliacoes}
              />
            </>
          )}
        </p>
        <p className="mt-1">
          <span className="font-semibold">{formatarMoeda(servico.preco)}</span>
          <span className="text-grafite"> / {ROTULO_UNIDADE_PRECO[servico.unidade_preco]}</span>
        </p>
      </div>
    </li>
  );
}

function CartaoReserva({ imovel }) {
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const [aviso, setAviso] = useState(null);

  const checkin = parametros.get('checkin') ?? '';
  const checkout = parametros.get('checkout') ?? '';
  const hospedes = parametros.get('hospedes') ?? '1';
  const noites = calcularNoites(checkin, checkout);
  const chaveDisponibilidade = `${imovel.id}|${checkin}|${checkout}`;
  const { dados: disponivel } = useDados(chaveDisponibilidade, () =>
    verificarDisponibilidade(imovel.id, checkin, checkout),
  );
  const indisponivel = noites > 0 && disponivel === false;

  // As escolhas ficam na URL: se o login for pedido, a pessoa volta com as datas preenchidas (RN16)
  function atualizar(nome, valor) {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    if (nome === 'checkin' && checkout && checkout <= valor) novos.delete('checkout');
    setParametros(novos, { replace: true });
    setAviso(null);
  }

  const campo = 'w-full bg-transparent text-sm outline-none';
  const hoje = hojeIso();

  // Sem login, a rota do carrinho leva à tela /entrar e volta para cá com as mesmas datas (RN16)
  function reservar() {
    const problema = problemaNaEstadia({
      checkin,
      checkout,
      hospedes: Number(hospedes),
      capacidade: imovel.num_hospedes,
      hoje,
    });
    if (problema) {
      setAviso({ tipo: 'erro', texto: problema });
    } else if (usuario && usuario.tipo !== 'hospede') {
      setAviso({ tipo: 'erro', texto: 'Reservas são feitas com uma conta de hóspede.' });
    } else {
      navegar(`/imoveis/${imovel.id}/carrinho?${parametros}`);
    }
  }

  return (
    <div className="rounded-2xl border border-linha bg-white p-6 shadow-[0_6px_20px_rgba(28,27,31,0.10)]">
      <p className="flex items-baseline justify-between">
        <span>
          <span className="text-2xl font-semibold">{formatarMoeda(imovel.preco_diaria)}</span>
          <span className="text-grafite"> noite</span>
        </span>
        <Avaliacao nota={imovel.nota_media} total={imovel.total_avaliacoes} mostrarTotal className="text-sm" />
      </p>

      <div className="mt-5 overflow-hidden rounded-xl border border-borda">
        <div className="grid grid-cols-2">
          <label className="border-r border-borda px-3 py-2.5">
            <span className="block text-[10px] font-bold uppercase tracking-wide">Check-in</span>
            <input type="date" min={hoje} value={checkin} onChange={(e) => atualizar('checkin', e.target.value)} className={campo} />
          </label>
          <label className="px-3 py-2.5">
            <span className="block text-[10px] font-bold uppercase tracking-wide">Check-out</span>
            <input type="date" min={checkin || hoje} value={checkout} onChange={(e) => atualizar('checkout', e.target.value)} className={campo} />
          </label>
        </div>
        <label className="block border-t border-borda px-3 py-2.5">
          <span className="block text-[10px] font-bold uppercase tracking-wide">Hóspedes</span>
          <select value={hospedes} onChange={(e) => atualizar('hospedes', e.target.value)} className={campo}>
            {Array.from({ length: imovel.num_hospedes }, (_, i) => i + 1).map((quantidade) => (
              <option key={quantidade} value={quantidade}>
                {quantidade} {quantidade === 1 ? 'hóspede' : 'hóspedes'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={reservar}
        disabled={indisponivel}
        className="mt-4 w-full rounded-xl bg-tinta py-3.5 font-medium text-marfim transition-colors hover:bg-ouro-escuro disabled:cursor-not-allowed disabled:bg-grafite/40"
      >
        {indisponivel ? 'Indisponível nessas datas' : 'Reservar'}
      </button>

      {aviso && (
        <p role={aviso.tipo === 'erro' ? 'alert' : 'status'} className={`mt-3 text-sm ${aviso.tipo === 'erro' ? 'text-erro' : 'text-ouro-escuro'}`}>
          {aviso.texto}
        </p>
      )}

      {noites > 0 && !indisponivel && (
        <>
          <p className="mt-4 text-center text-sm text-grafite">Você ainda não será cobrado</p>
          <div className="mt-4 flex justify-between text-grafite">
            <span className="underline underline-offset-4">
              {formatarMoeda(imovel.preco_diaria)} x {noites} {noites === 1 ? 'noite' : 'noites'}
            </span>
            <span>{formatarMoeda(imovel.preco_diaria * noites)}</span>
          </div>
          <div className="mt-4 flex justify-between border-t border-linha pt-4 font-semibold">
            <span>Total da hospedagem</span>
            <span>{formatarMoeda(imovel.preco_diaria * noites)}</span>
          </div>
          <p className="mt-2 text-xs text-grafite">Na próxima tela você adiciona os serviços premium ao carrinho.</p>
        </>
      )}
    </div>
  );
}

export default function ImovelDetalhe() {
  const { id } = useParams();
  const { dados, erro, carregando, recarregar } = useDados(`imovel|${id}`, () => obterImovel(id));
  // Vindo da busca, volta para ela com os mesmos filtros (o card manda o endereço da busca)
  const voltarPara = useLocation().state?.busca ?? '/explorar';
  useTituloPagina(carregando ? 'Carregando' : (dados?.imovel.titulo ?? (erro ? 'Erro' : 'Imóvel não encontrado')));

  if (carregando) return <ImovelCarregando />;

  if (erro) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <ErroCarregamento erro={erro} aoTentarDeNovo={recarregar} />
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <EstadoVazio TagTitulo="h1" icone="casa" titulo="Imóvel não encontrado" texto="O anúncio pode ter sido desativado pelo anfitrião.">
          <Link to="/explorar" className="rounded-full bg-tinta px-6 py-3 text-sm font-medium text-marfim hover:bg-grafite">
            Ver outros imóveis
          </Link>
        </EstadoVazio>
      </div>
    );
  }

  const { imovel, servicos } = dados;

  return (
    <div className="bg-white">
      <article className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
        <Link to={voltarPara} className="inline-flex items-center gap-1 text-sm font-medium text-grafite hover:text-tinta">
          <Icone nome="anterior" tamanho={16} /> Voltar para a busca
        </Link>

        <h1 className="mt-4 font-titulo text-4xl font-semibold sm:text-5xl">{imovel.titulo}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
          <a href="#avaliacoes" className="hover:underline">
            <Avaliacao nota={imovel.nota_media} total={imovel.total_avaliacoes} mostrarTotal />
          </a>
          <span aria-hidden="true">·</span>
          <span className="font-medium underline underline-offset-4">
            {imovel.cidade}, {imovel.estado}
          </span>
        </p>

        <div className="mt-6">
          <Galeria fotos={imovel.fotos} titulo={imovel.titulo} />
        </div>

        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_24rem]">
          <div>
            <section className="border-b border-linha pb-8">
              <h2 className="text-xl font-semibold">
                {ROTULO_TIPO_IMOVEL[imovel.tipo_imovel]} inteira · Anfitrião: {imovel.anfitriao}
              </h2>
              <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-grafite">
                <span className="inline-flex items-center gap-1.5">
                  <Icone nome="hospedes" tamanho={18} /> até {imovel.num_hospedes} hóspedes
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icone nome="quartos" tamanho={18} /> {imovel.num_quartos} {imovel.num_quartos === 1 ? 'quarto' : 'quartos'}
                </span>
              </p>
            </section>

            {imovel.descricao && (
              <section className="border-b border-linha py-8">
                <h2 className="sr-only">Sobre o imóvel</h2>
                <p className="whitespace-pre-line leading-relaxed text-tinta/90">{imovel.descricao}</p>
              </section>
            )}

            <section className="border-b border-linha py-8" aria-labelledby="titulo-servicos-cidade">
              <h2 id="titulo-servicos-cidade" className="font-titulo text-3xl font-semibold">
                Serviços disponíveis em {imovel.cidade}
              </h2>
              <p className="mt-1 text-grafite">Contrate junto com a reserva, num único pagamento.</p>
              {servicos.length > 0 ? (
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {servicos.map((servico) => (
                    <ServicoDisponivel key={servico.id} servico={servico} />
                  ))}
                </ul>
              ) : (
                <p className="mt-6 text-grafite">Ainda não há prestadores nesta cidade.</p>
              )}
            </section>

            <section id="avaliacoes" className="scroll-mt-6 border-b border-linha py-8" aria-labelledby="titulo-avaliacoes">
              <h2 id="titulo-avaliacoes" className="font-titulo text-3xl font-semibold">
                Avaliações dos hóspedes
              </h2>
              <div className="mt-4">
                <ListaAvaliacoes
                  key={imovel.id}
                  alvo={{ tipo: 'imovel', id: imovel.id }}
                  duasColunas
                  textoVazio="Este imóvel é novo na Estadia Prime. As avaliações aparecem depois das primeiras estadias."
                />
              </div>
            </section>

            <section className="py-8">
              <h2 className="font-titulo text-3xl font-semibold">Localização</h2>
              <p className="mt-2 flex items-center gap-1.5 text-grafite">
                <Icone nome="local" tamanho={18} /> {imovel.cidade}, {imovel.estado}
              </p>
              <p className="mt-1 text-sm text-grafite">O endereço exato é enviado após a confirmação da reserva.</p>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <CartaoReserva imovel={imovel} />
          </aside>
        </div>
      </article>
    </div>
  );
}
