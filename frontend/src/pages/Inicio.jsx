import { Link } from 'react-router';
import CardImovel from '../components/explorar/CardImovel.jsx';
import ErroCarregamento from '../components/ErroCarregamento.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import { GradeCarregando } from '../components/Esqueletos.jsx';
import { useDados } from '../hooks/useDados.js';
import { useTituloPagina } from '../hooks/useTituloPagina.js';
import { buscarImoveis } from '../services/catalogo.js';
import { SERVICOS_PREMIUM } from '../utils/perfis.js';

const QUANTIDADE_DESTAQUES = 4;

const PASSOS = [
  { numero: '01', titulo: 'Escolha a casa', texto: 'Navegue à vontade pelos imóveis, fotos e serviços. Não precisa de conta.' },
  { numero: '02', titulo: 'Monte sua estadia', texto: 'Acrescente mordomo, motorista, barman e outros serviços nos dias que quiser.' },
  { numero: '03', titulo: 'Reserve e pague uma vez', texto: 'Na hora de reservar, você entra na sua conta e paga tudo num único pagamento.' },
];

function Destaque() {
  return (
    <section className="relative isolate overflow-hidden text-marfim">
      <img
        src="/imagens/casa-luxo.jpg"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-tinta/90 via-tinta/65 to-tinta/25" />
      {/* Escurece o alto da foto: o cabeçalho transparente fica legível sobre ela */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-tinta/70 to-transparent" />

      {/* O cabeçalho (4,5rem) fica por cima da foto: o texto desce o mesmo tanto */}
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-[10.5rem] sm:px-6 sm:pb-32 sm:pt-[12.5rem]">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-ouro sm:text-sm">Hospedagem de alto padrão</p>
        <h1 className="mt-4 max-w-2xl font-titulo text-5xl font-semibold leading-[1.05] sm:text-6xl">
          A casa perfeita. <span className="italic text-ouro">O serviço impecável.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-marfim/85">
          Imóveis exclusivos com mordomo, motorista, barman e muito mais, contratados junto com a sua estadia.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/explorar" className="rounded-full bg-ouro px-6 py-3.5 font-medium text-tinta hover:bg-marfim">
            Explorar imóveis
          </Link>
          <Link
            to="/anunciar"
            className="rounded-full border border-marfim/40 px-6 py-3.5 font-medium text-marfim hover:border-marfim"
          >
            Anunciar meu imóvel
          </Link>
        </div>
      </div>
    </section>
  );
}

function Imoveis() {
  // A busca já vem ordenada pela nota média (sem avaliação por último)
  const { dados: imoveis, erro, carregando, recarregar } = useDados('destaques', async () => {
    const { imoveis: melhores } = await buscarImoveis();
    return melhores.slice(0, QUANTIDADE_DESTAQUES);
  });

  return (
    <section id="imoveis" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="titulo-imoveis">
      <div className="flex items-end justify-between gap-4">
        <h2 id="titulo-imoveis" className="font-titulo text-4xl font-semibold">
          Imóveis em destaque
        </h2>
        <Link to="/explorar" className="shrink-0 text-sm font-semibold underline underline-offset-4">
          Ver todos
        </Link>
      </div>
      <div className="mt-8">
        {carregando ? (
          <GradeCarregando quantidade={QUANTIDADE_DESTAQUES} colunas="sm:grid-cols-2 lg:grid-cols-4" />
        ) : erro ? (
          <ErroCarregamento erro={erro} aoTentarDeNovo={recarregar} />
        ) : imoveis.length === 0 ? (
          <EstadoVazio icone="casa" titulo="Novos imóveis em breve" texto="Estamos selecionando as primeiras casas. Volte em alguns dias." />
        ) : (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {imoveis.map((imovel) => (
              <CardImovel key={imovel.id} imovel={imovel} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Servicos() {
  return (
    <section className="border-y border-linha bg-areia/60" aria-labelledby="titulo-servicos">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 id="titulo-servicos" className="font-titulo text-4xl font-semibold">
          Serviços para acoplar à sua estadia
        </h2>
        <p className="mt-3 max-w-2xl text-grafite">
          Profissionais selecionados na cidade do imóvel, contratados junto com a reserva.
        </p>
        <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-3">
          {SERVICOS_PREMIUM.map((servico) => (
            <li key={servico.nome} className="bg-white p-6">
              <h3 className="font-titulo text-2xl font-semibold">{servico.nome}</h3>
              <p className="mt-2 text-sm leading-relaxed text-grafite">{servico.descricao}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ComoFunciona() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="titulo-como-funciona">
      <h2 id="titulo-como-funciona" className="font-titulo text-4xl font-semibold">
        Como funciona
      </h2>
      <ol className="mt-10 grid gap-8 md:grid-cols-3">
        {PASSOS.map((passo) => (
          <li key={passo.numero} className="border-t border-tinta pt-5">
            <span className="font-titulo text-xl italic text-ouro-escuro">{passo.numero}</span>
            <h3 className="mt-2 font-titulo text-2xl font-semibold">{passo.titulo}</h3>
            <p className="mt-2 text-grafite">{passo.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Inicio() {
  useTituloPagina('Hospedagem de alto padrão com serviços exclusivos');
  return (
    <>
      <Destaque />
      <Imoveis />
      <Servicos />
      <ComoFunciona />
    </>
  );
}
