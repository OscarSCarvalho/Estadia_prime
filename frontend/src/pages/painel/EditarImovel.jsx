import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import ErroCarregamento from '../../components/ErroCarregamento.jsx';
import EstadoVazio from '../../components/EstadoVazio.jsx';
import Icone from '../../components/Icone.jsx';
import { PainelCarregando } from '../../components/Esqueletos.jsx';
import FormularioImovel from '../../components/painel/FormularioImovel.jsx';
import GerenciadorFotos from '../../components/painel/GerenciadorFotos.jsx';
import GerenciadorInclusos from '../../components/painel/GerenciadorInclusos.jsx';
import SeloStatus from '../../components/painel/SeloStatus.jsx';
import { useDados } from '../../hooks/useDados.js';
import { useTituloPagina } from '../../hooks/useTituloPagina.js';
import { alterarStatusImovel, editarImovel, obterMeuImovel } from '../../services/painel.js';

// H2.3 + CB06: desativar tira da busca sem apagar; com reserva futura, a API recusa (409)
function ControleStatus({ imovel, aoMudar }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const ativo = imovel.status === 'ativo';

  async function alternar() {
    setEnviando(true);
    setErro('');
    try {
      aoMudar(await alterarStatusImovel(imovel.id, ativo ? 'inativo' : 'ativo'));
    } catch (falha) {
      setErro(falha.codigo === 'IMOVEL_COM_RESERVAS_FUTURAS' ? 'Não dá para desativar: o imóvel tem reservas futuras.' : falha.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={alternar}
        disabled={enviando}
        aria-busy={enviando || undefined}
        className="rounded-full border border-tinta px-5 py-2.5 text-sm font-medium hover:bg-tinta hover:text-marfim disabled:cursor-wait disabled:opacity-60"
      >
        {ativo ? 'Desativar anúncio' : 'Ativar anúncio'}
      </button>
      {erro && (
        <p role="alert" className="text-sm text-erro">
          {erro}
        </p>
      )}
    </div>
  );
}

function AvisoVisibilidade({ imovel }) {
  const motivo =
    imovel.status === 'inativo'
      ? 'Este anúncio está desativado e não aparece na busca.'
      : imovel.fotos.length === 0
        ? 'Envie pelo menos uma foto: sem fotos, o imóvel não aparece na busca.'
        : null;
  if (!motivo) return null;
  return (
    <p className="mt-6 flex items-start gap-2 rounded-xl border border-ouro/50 bg-ouro/10 px-4 py-3 text-sm text-ouro-escuro">
      <Icone nome="alerta" tamanho={18} className="mt-px shrink-0" />
      {motivo}
    </p>
  );
}

function PainelImovel({ inicial, recemCadastrado }) {
  const [imovel, setImovel] = useState(inicial);
  const visivel = imovel.status === 'ativo' && imovel.fotos.length > 0;
  useTituloPagina(imovel.titulo);

  async function salvarDados(dados) {
    const salvo = await editarImovel(imovel.id, dados);
    setImovel((atual) => ({ ...salvo, fotos: atual.fotos }));
    return salvo;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Link to="/painel/imoveis" className="inline-flex items-center gap-1 text-sm font-medium text-grafite hover:text-tinta">
        <Icone nome="anterior" tamanho={16} /> Meus imóveis
      </Link>

      {recemCadastrado && (
        <p role="status" className="mt-6 rounded-xl border border-ouro/50 bg-ouro/10 px-4 py-3 text-sm">
          <strong>Imóvel cadastrado!</strong> Agora envie as fotos. A primeira será a capa do anúncio.
        </p>
      )}

      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-titulo text-4xl font-semibold sm:text-5xl">{imovel.titulo}</h1>
            <SeloStatus status={imovel.status} />
          </div>
          <p className="mt-2 text-grafite">
            {imovel.cidade}, {imovel.estado}
            {visivel && (
              <>
                {' · '}
                <Link to={`/imoveis/${imovel.id}`} className="font-medium text-ouro-escuro underline underline-offset-4">
                  Ver anúncio
                </Link>
              </>
            )}
          </p>
        </div>
        <ControleStatus imovel={imovel} aoMudar={(salvo) => setImovel((atual) => ({ ...salvo, fotos: atual.fotos }))} />
      </div>

      <AvisoVisibilidade imovel={imovel} />

      <div className="mt-10 rounded-2xl border border-linha bg-white p-6 sm:p-8">
        <GerenciadorFotos
          imovelId={imovel.id}
          fotos={imovel.fotos}
          aoMudar={(fotos) => setImovel((atual) => ({ ...atual, fotos }))}
        />
      </div>

      <div className="mt-8 rounded-2xl border border-linha bg-white p-6 sm:p-8">
        <GerenciadorInclusos imovelId={imovel.id} />
      </div>

      <section className="mt-8 rounded-2xl border border-linha bg-white p-6 sm:p-8" aria-labelledby="titulo-dados">
        <h2 id="titulo-dados" className="mb-6 font-titulo text-3xl font-semibold">
          Dados do imóvel
        </h2>
        <FormularioImovel imovel={imovel} textoBotao="Salvar alterações" textoSalvando="Salvando…" aoSalvar={salvarDados} />
      </section>
    </div>
  );
}

export default function EditarImovel() {
  const { id } = useParams();
  const recemCadastrado = Boolean(useLocation().state?.recemCadastrado);
  const { dados: imovel, erro, carregando, recarregar } = useDados(`meu-imovel|${id}`, () => obterMeuImovel(id));

  if (carregando) return <PainelCarregando />;

  if (erro) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <ErroCarregamento erro={erro} aoTentarDeNovo={recarregar} />
      </div>
    );
  }

  if (!imovel) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <EstadoVazio TagTitulo="h1" icone="casa" titulo="Imóvel não encontrado">
          <Link to="/painel/imoveis" className="rounded-full bg-tinta px-6 py-3 text-sm font-medium text-marfim hover:bg-grafite">
            Voltar para meus imóveis
          </Link>
        </EstadoVazio>
      </div>
    );
  }

  return <PainelImovel key={imovel.id} inicial={imovel} recemCadastrado={recemCadastrado} />;
}
