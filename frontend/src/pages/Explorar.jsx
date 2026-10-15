import { useSearchParams } from 'react-router';
import AbasExplorar from '../components/explorar/AbasExplorar.jsx';
import { BarraBuscaImoveis, BarraBuscaServicos } from '../components/explorar/BarraBusca.jsx';
import FaixaCategorias from '../components/explorar/FaixaCategorias.jsx';
import DialogoFiltros from '../components/explorar/DialogoFiltros.jsx';
import CardImovel from '../components/explorar/CardImovel.jsx';
import CardServico from '../components/explorar/CardServico.jsx';
import ErroCarregamento from '../components/ErroCarregamento.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import { GradeCarregando } from '../components/Esqueletos.jsx';
import Icone from '../components/Icone.jsx';
import { useDados } from '../hooks/useDados.js';
import { useTituloPagina } from '../hooks/useTituloPagina.js';
import { buscarImoveis, buscarServicos, listarCidades } from '../services/catalogo.js';
import { TIPOS_IMOVEL, TIPOS_SERVICO, ROTULO_TIPO_SERVICO } from '../utils/perfis.js';
import { rolarParaOTopo } from '../utils/rolagem.js';

// Os filtros vivem na URL: dá para voltar, recarregar e compartilhar a busca
function lerFiltros(parametros) {
  const numero = (nome) => Number(parametros.get(nome)) || '';
  return {
    aba: parametros.get('aba') === 'servicos' ? 'servicos' : 'imoveis',
    cidade: parametros.get('cidade') ?? '',
    checkin: parametros.get('checkin') ?? '',
    checkout: parametros.get('checkout') ?? '',
    hospedes: numero('hospedes'),
    tipo: parametros.get('tipo') ?? '',
    precoMin: numero('precoMin'),
    precoMax: numero('precoMax'),
    servicos: (parametros.get('servicos') ?? '').split(',').filter(Boolean),
    tipoServico: parametros.get('tipoServico') ?? '',
    pagina: numero('pagina') || 1,
  };
}

function SemResultados({ aoLimpar }) {
  return (
    <EstadoVazio icone="busca" titulo="Nenhum resultado encontrado" texto="Tente mudar as datas, o destino ou remover alguns filtros.">
      <button
        type="button"
        onClick={aoLimpar}
        className="rounded-full border border-tinta px-6 py-3 text-sm font-medium hover:bg-tinta hover:text-marfim"
      >
        Limpar filtros
      </button>
    </EstadoVazio>
  );
}

// A API devolve 20 imóveis por página
function Paginacao({ pagina, totalPaginas, aoMudar }) {
  if (totalPaginas <= 1) return null;
  const botao =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border border-linha hover:border-tinta disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <nav aria-label="Páginas de resultados" className="mt-12 flex items-center justify-center gap-4">
      <button type="button" className={botao} disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
        <Icone nome="anterior" tamanho={18} rotulo="Página anterior" />
      </button>
      <span className="text-sm text-grafite">
        Página {pagina} de {totalPaginas}
      </span>
      <button type="button" className={botao} disabled={pagina >= totalPaginas} onClick={() => aoMudar(pagina + 1)}>
        <Icone nome="proximo" tamanho={18} rotulo="Próxima página" />
      </button>
    </nav>
  );
}

function descreverResultado(quantidade, filtros) {
  const emImoveis = filtros.aba === 'imoveis';
  const substantivo = emImoveis
    ? quantidade === 1 ? 'imóvel' : 'imóveis'
    : quantidade === 1 ? 'profissional' : 'profissionais';
  const servico = !emImoveis && filtros.tipoServico ? ` de ${ROTULO_TIPO_SERVICO[filtros.tipoServico].toLowerCase()}` : '';
  const local = filtros.cidade ? ` em ${filtros.cidade}` : '';
  return `${quantidade} ${substantivo}${servico}${local}`;
}

export default function Explorar() {
  const [parametros, setParametros] = useSearchParams();
  const filtros = lerFiltros(parametros);
  const chaveBusca = parametros.toString();
  const emImoveis = filtros.aba === 'imoveis';
  const tituloPagina = emImoveis ? 'Explorar imóveis' : 'Explorar serviços premium';
  useTituloPagina(filtros.cidade ? `${emImoveis ? 'Imóveis' : 'Serviços'} em ${filtros.cidade}` : tituloPagina);

  const { dados: cidades } = useDados('cidades', listarCidades);
  const { dados: resultados, erro, carregando, recarregar } = useDados(chaveBusca, () =>
    emImoveis ? buscarImoveis(filtros) : buscarServicos({ cidade: filtros.cidade, tipo: filtros.tipoServico }),
  );

  function atualizarFiltros(mudancas) {
    const novos = new URLSearchParams(parametros);
    // Filtro novo volta para a primeira página
    if (!('pagina' in mudancas)) novos.delete('pagina');
    for (const [nome, valor] of Object.entries(mudancas)) {
      const texto = Array.isArray(valor) ? valor.join(',') : String(valor ?? '');
      if (texto) novos.set(nome, texto);
      else novos.delete(nome);
    }
    setParametros(novos);
  }

  function limparFiltros() {
    setParametros(emImoveis ? {} : { aba: 'servicos' });
  }

  const temFiltros = [...parametros.keys()].some((nome) => nome !== 'aba' && nome !== 'pagina');
  // Imóveis vêm paginados ({ imoveis, total }); serviços vêm numa lista só
  const lista = emImoveis ? resultados?.imoveis : resultados;
  const total = emImoveis ? resultados?.total : resultados?.length;

  function mudarPagina(pagina) {
    atualizarFiltros({ pagina: pagina > 1 ? pagina : '' });
    rolarParaOTopo();
  }
  const periodo = { checkin: filtros.checkin, checkout: filtros.checkout, hospedes: filtros.hospedes };

  return (
    <div className="bg-white">
      <h1 className="sr-only">{tituloPagina}</h1>
      <section aria-label="Busca" className="border-b border-linha px-4 pb-6 pt-4 sm:px-6">
        <AbasExplorar abaAtiva={filtros.aba} />
        <div className="mt-5">
          {emImoveis ? (
            <BarraBuscaImoveis key={chaveBusca} filtros={filtros} cidades={cidades ?? []} aoBuscar={atualizarFiltros} />
          ) : (
            <BarraBuscaServicos key={chaveBusca} filtros={filtros} cidades={cidades ?? []} aoBuscar={atualizarFiltros} />
          )}
        </div>
      </section>

      <div className="sticky top-0 z-20 border-b border-linha bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 pt-4 sm:px-6">
          {emImoveis ? (
            <>
              <FaixaCategorias
                rotuloGrupo="Tipo de imóvel"
                categorias={TIPOS_IMOVEL}
                ativa={filtros.tipo}
                aoEscolher={(tipo) => atualizarFiltros({ tipo })}
              />
              <div className="pb-3">
                <DialogoFiltros key={chaveBusca} filtros={filtros} aoAplicar={atualizarFiltros} />
              </div>
            </>
          ) : (
            <FaixaCategorias
              rotuloGrupo="Tipo de serviço"
              categorias={TIPOS_SERVICO}
              ativa={filtros.tipoServico}
              aoEscolher={(tipoServico) => atualizarFiltros({ tipoServico })}
            />
          )}
        </div>
      </div>

      <section aria-label="Resultados" className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
        {/* A cada busca o leitor de tela anuncia só a contagem, não a lista inteira */}
        <p role="status" className="sr-only">
          {carregando || erro ? '' : `Resultado da busca: ${descreverResultado(total, filtros)}`}
        </p>
        {carregando ? (
          <GradeCarregando formato={emImoveis ? 'aspect-[20/19]' : 'aspect-square'} />
        ) : erro ? (
          <ErroCarregamento erro={erro} aoTentarDeNovo={recarregar} />
        ) : lista.length === 0 ? (
          <SemResultados aoLimpar={limparFiltros} />
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-grafite">{descreverResultado(total, filtros)}</p>
              {temFiltros && (
                <button type="button" onClick={limparFiltros} className="text-sm font-semibold underline underline-offset-4">
                  Limpar filtros
                </button>
              )}
            </div>
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {emImoveis
                ? lista.map((imovel) => <CardImovel key={imovel.id} imovel={imovel} periodo={periodo} />)
                : lista.map((servico) => <CardServico key={servico.id} servico={servico} />)}
            </div>
            {emImoveis && (
              <Paginacao pagina={resultados.pagina} totalPaginas={resultados.total_paginas} aoMudar={mudarPagina} />
            )}
          </>
        )}
      </section>
    </div>
  );
}
