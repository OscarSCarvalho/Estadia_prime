import { useState } from 'react';
import ErroCarregamento from '../../components/ErroCarregamento.jsx';
import EstadoVazio from '../../components/EstadoVazio.jsx';
import { ListaCarregando } from '../../components/Esqueletos.jsx';
import Icone from '../../components/Icone.jsx';
import Avaliacao from '../../components/explorar/Avaliacao.jsx';
import FormularioServico from '../../components/painel/FormularioServico.jsx';
import SeloStatus from '../../components/painel/SeloStatus.jsx';
import { useDados } from '../../hooks/useDados.js';
import { useTituloPagina } from '../../hooks/useTituloPagina.js';
import { alterarStatusServico, cadastrarServico, editarServico, listarMeusServicos } from '../../services/painel.js';
import { ROTULO_TIPO_SERVICO, ROTULO_UNIDADE_PRECO, fotoDoServico } from '../../utils/perfis.js';
import { formatarMoeda } from '../../utils/formatacao.js';
import { rolarParaOTopo } from '../../utils/rolagem.js';

function LinhaServico({ servico, aoEditar, aoMudar }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const ativo = servico.status === 'ativo';

  // H3.2 + CB05: desativar tira das novas buscas; reservas já feitas continuam valendo
  async function alternarStatus() {
    setEnviando(true);
    setErro('');
    try {
      aoMudar(await alterarStatusServico(servico.id, ativo ? 'inativo' : 'ativo'));
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-linha bg-white p-4 sm:flex-row sm:items-center">
      <img src={fotoDoServico(servico.tipo_servico)} alt="" className="aspect-square w-24 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-1.5 font-semibold">
            <Icone nome={servico.tipo_servico} tamanho={18} className="text-ouro-escuro" />
            {ROTULO_TIPO_SERVICO[servico.tipo_servico]} em {servico.cidade_atuacao}
          </h2>
          <SeloStatus status={servico.status} />
        </div>
        <p className="mt-1 text-sm">
          <span className="font-semibold">{formatarMoeda(servico.preco)}</span>
          <span className="text-grafite"> / {ROTULO_UNIDADE_PRECO[servico.unidade_preco]} · </span>
          <Avaliacao nota={servico.nota_media} total={servico.total_avaliacoes} mostrarTotal />
        </p>
        {servico.descricao && <p className="mt-1 line-clamp-2 text-sm text-grafite">{servico.descricao}</p>}
        {!ativo && <p className="mt-2 text-sm font-medium text-ouro-escuro">Desativado: não aparece para novos hóspedes</p>}
        {erro && (
          <p role="alert" className="mt-2 text-sm text-erro">
            {erro}
          </p>
        )}
      </div>
      <div className="flex gap-2 sm:flex-col sm:items-stretch">
        <button
          type="button"
          onClick={aoEditar}
          className="rounded-full bg-tinta px-5 py-2 text-sm font-medium text-marfim hover:bg-grafite"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={alternarStatus}
          disabled={enviando}
          className="rounded-full border border-linha px-5 py-2 text-sm font-medium hover:border-tinta disabled:cursor-wait disabled:opacity-60"
        >
          {ativo ? 'Desativar' : 'Ativar'}
        </button>
      </div>
    </li>
  );
}

export default function MeusServicos() {
  useTituloPagina('Meus serviços');
  const { dados, erro, carregando, recarregar } = useDados('meus-servicos', listarMeusServicos);
  // Alterações locais por cima da lista carregada (cadastro, edição, ativar/desativar)
  const [alterados, setAlterados] = useState({ novos: [], porId: {} });
  // null = formulário fechado; 'novo' = cadastro; objeto = edição
  const [emEdicao, setEmEdicao] = useState(null);

  const servicos = dados
    ? [...alterados.novos, ...dados].map((servico) => alterados.porId[servico.id] ?? servico)
    : [];

  function registrar(servico) {
    setAlterados((atual) => ({ ...atual, porId: { ...atual.porId, [servico.id]: servico } }));
  }

  async function salvar(formulario) {
    if (emEdicao === 'novo') {
      const criado = await cadastrarServico(formulario);
      setAlterados((atual) => ({ ...atual, novos: [criado, ...atual.novos] }));
    } else {
      registrar(await editarServico(emEdicao.id, formulario));
    }
    setEmEdicao(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-ouro-escuro">Painel do prestador</p>
          <h1 className="mt-2 font-titulo text-4xl font-semibold sm:text-5xl">Meus serviços</h1>
        </div>
        {emEdicao === null && (
          <button
            type="button"
            onClick={() => setEmEdicao('novo')}
            className="inline-flex items-center gap-2 rounded-full bg-tinta px-5 py-3 font-medium text-marfim hover:bg-grafite"
          >
            <Icone nome="mais" tamanho={18} /> Cadastrar serviço
          </button>
        )}
      </div>

      {emEdicao !== null && (
        <section className="mt-8 rounded-2xl border border-linha bg-white p-6 sm:p-8" aria-labelledby="titulo-formulario">
          <h2 id="titulo-formulario" className="mb-6 font-titulo text-3xl font-semibold">
            {emEdicao === 'novo' ? 'Novo serviço' : 'Editar serviço'}
          </h2>
          <FormularioServico
            key={emEdicao === 'novo' ? 'novo' : emEdicao.id}
            servico={emEdicao === 'novo' ? null : emEdicao}
            aoSalvar={salvar}
            aoCancelar={() => setEmEdicao(null)}
          />
        </section>
      )}

      <div className="mt-10">
        {carregando ? (
          <ListaCarregando />
        ) : erro ? (
          <ErroCarregamento erro={erro} aoTentarDeNovo={recarregar} />
        ) : servicos.length === 0 ? (
          <EstadoVazio icone="mordomo" titulo="Nenhum serviço ainda" texto="Cadastre o que você oferece e a cidade onde atende." />
        ) : (
          <ul className="flex flex-col gap-4">
            {servicos.map((servico) => (
              <LinhaServico
                key={servico.id}
                servico={servico}
                aoEditar={() => {
                  setEmEdicao(servico);
                  rolarParaOTopo();
                }}
                aoMudar={registrar}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
