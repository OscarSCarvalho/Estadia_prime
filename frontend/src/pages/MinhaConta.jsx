import { Link, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth.js';
import { useTituloPagina } from '../hooks/useTituloPagina.js';
import { PERFIS } from '../utils/perfis.js';
import { formatarDataCadastro, formatarTelefone } from '../utils/formatacao.js';

// No celular o cabeçalho esconde estes atalhos: aqui eles aparecem para todo perfil
const PROXIMOS_PASSOS = {
  hospede: {
    texto: 'Encontre um imóvel e monte sua estadia com serviços premium.',
    links: [
      { para: '/explorar', rotulo: 'Explorar imóveis' },
      { para: '/minhas-reservas', rotulo: 'Minhas reservas' },
    ],
  },
  anfitriao: {
    texto: 'Cadastre seus imóveis, envie as fotos e acompanhe as reservas.',
    links: [
      { para: '/painel/imoveis', rotulo: 'Meus imóveis' },
      { para: '/painel/reservas', rotulo: 'Reservas' },
    ],
  },
  prestador: {
    texto: 'Cadastre seus serviços e acompanhe os dias contratados.',
    links: [
      { para: '/painel/servicos', rotulo: 'Meus serviços' },
      { para: '/painel/agenda', rotulo: 'Agenda' },
    ],
  },
};

function Dado({ rotulo, valor }) {
  return (
    <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-grafite">{rotulo}</dt>
      <dd className="mt-1 font-medium sm:col-span-2 sm:mt-0">{valor}</dd>
    </div>
  );
}

export default function MinhaConta() {
  const { usuario, sair } = useAuth();
  const navegar = useNavigate();
  useTituloPagina('Minha conta');

  async function aoSair() {
    await sair();
    navegar('/');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-ouro-escuro">{PERFIS[usuario.tipo].titulo}</p>
      <h1 className="mt-2 font-titulo text-4xl font-semibold sm:text-5xl">Olá, {usuario.nome.split(' ')[0]}</h1>
      <p className="mt-3 text-grafite">{PROXIMOS_PASSOS[usuario.tipo].texto}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {PROXIMOS_PASSOS[usuario.tipo].links.map(({ para, rotulo }, posicao) => (
          <Link
            key={para}
            to={para}
            className={`rounded-full px-6 py-3 font-medium ${
              posicao === 0 ? 'bg-tinta text-marfim hover:bg-grafite' : 'border border-tinta hover:bg-tinta hover:text-marfim'
            }`}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      <section className="mt-10 rounded-2xl border border-linha bg-white px-6" aria-labelledby="titulo-dados">
        <h2 id="titulo-dados" className="sr-only">
          Seus dados
        </h2>
        <dl className="divide-y divide-linha">
          <Dado rotulo="Nome" valor={usuario.nome} />
          <Dado rotulo="E-mail" valor={usuario.email} />
          <Dado rotulo="Telefone" valor={formatarTelefone(usuario.telefone)} />
          <Dado rotulo="CPF/CNPJ" valor={usuario.cpf_cnpj ?? 'Não informado'} />
          <Dado rotulo="Perfil" valor={PERFIS[usuario.tipo].titulo} />
          <Dado rotulo="Cliente desde" valor={formatarDataCadastro(usuario.data_cadastro)} />
        </dl>
      </section>

      <button
        type="button"
        onClick={aoSair}
        className="mt-8 rounded-full border border-tinta px-6 py-3 font-medium hover:bg-tinta hover:text-marfim"
      >
        Sair da conta
      </button>
    </div>
  );
}
