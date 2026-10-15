import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import Marca from '../components/Marca.jsx';
import FormularioLogin from '../components/FormularioLogin.jsx';
import Icone from '../components/Icone.jsx';
import { CarregandoSimples } from '../components/Esqueletos.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useTituloPagina } from '../hooks/useTituloPagina.js';
import { SERVICOS_PREMIUM } from '../utils/perfis.js';

const DIFERENCIAIS = [
  'Imóveis selecionados de alto padrão',
  'Serviços premium contratados junto com a reserva',
  'Um único pagamento, com segurança',
];

// O texto do formulário muda conforme o que a pessoa estava tentando fazer quando o login foi pedido
const MOTIVOS_LOGIN = [
  { prefixo: '/anunciar', titulo: 'Anuncie seu imóvel', texto: 'Entre para cadastrar sua casa e começar a receber hóspedes.' },
  { prefixo: '/imoveis/', titulo: 'Falta pouco', texto: 'Entre na sua conta para reservar esta estadia.' },
];
const MOTIVO_PADRAO = { titulo: 'Bem-vindo', texto: 'Entre para reservar e acompanhar suas estadias.' };

function PainelApresentacao() {
  return (
    <section className="relative isolate flex min-h-[28rem] flex-col overflow-hidden text-marfim lg:min-h-dvh">
      <img
        src="/imagens/casa-luxo.jpg"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-tinta via-tinta/70 to-tinta/30 lg:bg-gradient-to-r lg:from-tinta/90 lg:via-tinta/60 lg:to-tinta/20"
      />

      <div className="px-6 pt-6 sm:px-10 sm:pt-8 lg:px-14 lg:pt-10">
        <Marca clara />
      </div>

      <div className="my-auto max-w-2xl px-6 pb-12 pt-16 sm:px-10 lg:px-14 lg:pb-40 lg:pt-12">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-ouro sm:text-sm">Hospedagem de alto padrão</p>
        <h1 className="mt-4 max-w-xl font-titulo text-4xl font-semibold leading-[1.05] sm:text-5xl xl:text-6xl">
          A casa perfeita. <span className="italic text-ouro">O serviço impecável.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-marfim/85 sm:text-lg">
          Reserve imóveis exclusivos e acrescente mordomo, motorista, barman e muito mais à sua estadia.
        </p>

        <ul className="mt-8 hidden flex-col gap-3 sm:flex">
          {DIFERENCIAIS.map((diferencial) => (
            <li key={diferencial} className="flex items-center gap-3 text-sm text-marfim/90">
              <span aria-hidden="true" className="h-px w-6 bg-ouro" />
              {diferencial}
            </li>
          ))}
        </ul>

        {/* Sempre numa linha só; em celulares muito estreitos a linha desliza para o lado */}
        <div
          className="-mx-6 mt-8 flex flex-nowrap gap-1.5 overflow-x-auto px-6 [scrollbar-width:none] sm:mx-0 sm:px-0 xl:gap-2"
          aria-label="Serviços disponíveis"
        >
          {SERVICOS_PREMIUM.map((servico) => (
            <span
              key={servico.nome}
              className="shrink-0 whitespace-nowrap rounded-full border border-marfim/25 bg-tinta/30 px-2.5 py-1 text-[11px] font-medium tracking-wide backdrop-blur-sm xl:px-3 xl:text-xs"
            >
              {servico.nome}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Entrar() {
  const { usuario, carregando } = useAuth();
  const navegar = useNavigate();
  const voltarPara = useLocation().state?.voltarPara;
  const destinoAposLogin = voltarPara ?? '/';
  const motivo = MOTIVOS_LOGIN.find(({ prefixo }) => voltarPara?.startsWith(prefixo)) ?? MOTIVO_PADRAO;
  useTituloPagina('Entrar');

  if (usuario) return <Navigate to={destinoAposLogin} replace />;

  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[1.3fr_1fr]">
      <PainelApresentacao />

      <main id="conteudo" className="flex flex-col px-6 py-8 sm:px-10 lg:py-10">
        <Link to="/" className="inline-flex items-center gap-1 self-start text-sm font-medium text-grafite hover:text-tinta">
          <Icone nome="anterior" tamanho={16} /> Voltar a explorar os imóveis
        </Link>

        <div className="mx-auto my-auto w-full max-w-sm py-10">
          {carregando ? (
            <CarregandoSimples className="py-10" />
          ) : (
            <>
              <h2 className="font-titulo text-4xl font-semibold">{motivo.titulo}</h2>
              <p className="mt-2 text-grafite">{motivo.texto}</p>

              <div className="mt-8">
                <FormularioLogin aoEntrar={() => navegar(destinoAposLogin, { replace: true })} />
              </div>

              <div className="my-8 flex items-center gap-4 text-xs uppercase tracking-widest text-grafite">
                <span className="h-px flex-1 bg-linha" />
                ou
                <span className="h-px flex-1 bg-linha" />
              </div>

              <p className="text-center text-sm text-grafite">Ainda não tem conta?</p>
              <Link
                to="/cadastro"
                state={{ voltarPara }}
                className="mt-3 block rounded-full border border-tinta px-6 py-3.5 text-center font-medium text-tinta hover:bg-tinta hover:text-marfim"
              >
                Criar conta
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
