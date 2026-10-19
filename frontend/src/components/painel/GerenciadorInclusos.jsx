import { useState } from 'react';
import Alerta from '../Alerta.jsx';
import Botao from '../Botao.jsx';
import CampoAreaTexto from '../CampoAreaTexto.jsx';
import CampoSelecao from '../CampoSelecao.jsx';
import CampoTexto from '../CampoTexto.jsx';
import ErroCarregamento from '../ErroCarregamento.jsx';
import Icone from '../Icone.jsx';
import SeloStatus from './SeloStatus.jsx';
import { useConfirmacao } from '../../hooks/useConfirmacao.jsx';
import { useDados } from '../../hooks/useDados.js';
import {
  alterarStatusIncluso,
  cadastrarIncluso,
  editarIncluso,
  listarInclusos,
  reordenarInclusos,
  removerIncluso,
} from '../../services/painel.js';
import { ROTULO_UNIDADE_INCLUSO, SUGESTOES_INCLUSOS, UNIDADES_INCLUSO } from '../../utils/perfis.js';
import { centavosParaTextoReais, formatarMoeda } from '../../utils/formatacao.js';

const LIMITE_INCLUSOS = 15;

function mover(lista, de, para) {
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item);
  return nova;
}

function paraFormulario(incluso) {
  return {
    nome: incluso?.nome ?? '',
    preco: incluso?.preco ? centavosParaTextoReais(incluso.preco) : '',
    unidade_preco: incluso?.unidade_preco ?? 'noite',
    descricao: incluso?.descricao ?? '',
  };
}

// `inicial`: incluso salvo (edição) ou sugestão sem preço (cadastro). `aoSalvar(dados)` chama a API
function FormularioIncluso({ inicial, editando, aoSalvar, aoCancelar }) {
  const [formulario, setFormulario] = useState(() => paraFormulario(inicial));
  const [errosCampos, setErrosCampos] = useState({});
  const [mensagemErro, setMensagemErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  function atualizar(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
    setErrosCampos((atuais) => ({ ...atuais, [campo]: undefined }));
  }

  async function aoEnviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setMensagemErro('');
    setErrosCampos({});
    try {
      await aoSalvar(formulario);
    } catch (erro) {
      if (erro.codigo === 'DADOS_INVALIDOS') {
        setErrosCampos(erro.detalhes);
        setMensagemErro('Revise os campos destacados.');
      } else {
        setMensagemErro(erro.message);
      }
      setEnviando(false);
    }
  }

  const propsCampo = (campo) => ({
    value: formulario[campo],
    onChange: (evento) => atualizar(campo, evento.target.value),
    erro: errosCampos[campo],
  });

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-5 rounded-2xl border border-tinta/20 bg-marfim p-5" noValidate>
      <Alerta>{mensagemErro}</Alerta>
      <CampoTexto rotulo="Nome do serviço" maxLength={60} required autoFocus={!inicial?.nome} {...propsCampo('nome')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoTexto
          rotulo="Preço (R$)"
          inputMode="decimal"
          placeholder="150,00"
          required
          autoFocus={Boolean(inicial?.nome) && !editando}
          {...propsCampo('preco')}
        />
        <CampoSelecao rotulo="Cobrança" opcoes={UNIDADES_INCLUSO} {...propsCampo('unidade_preco')} />
      </div>
      <CampoAreaTexto rotulo="Descrição (opcional)" rows={2} maxLength={300} {...propsCampo('descricao')} />
      <div className="flex flex-wrap gap-3">
        <Botao carregando={enviando} textoCarregando="Salvando…" className="sm:w-auto">
          {editando ? 'Salvar alterações' : 'Adicionar serviço'}
        </Botao>
        <button type="button" onClick={aoCancelar} className="rounded-full border border-linha px-6 py-3.5 font-medium hover:border-tinta">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function descreverPreco(incluso) {
  const preco = formatarMoeda(incluso.preco);
  return incluso.unidade_preco === 'estadia' ? `${preco} por estadia` : `${preco} / ${ROTULO_UNIDADE_INCLUSO[incluso.unidade_preco]}`;
}

function ListaInclusos({ imovelId, inicial }) {
  const [inclusos, setInclusos] = useState(inicial);
  // null | { novo: true, sugestao } | { id } (edição de um incluso)
  const [formulario, setFormulario] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [erro, setErro] = useState('');
  const [arrastando, setArrastando] = useState(null);
  const [confirmar, janelaConfirmacao] = useConfirmacao();
  const noLimite = inclusos.length >= LIMITE_INCLUSOS;
  const nomesUsados = new Set(inclusos.map((incluso) => incluso.nome.toLowerCase()));
  const sugestoes = SUGESTOES_INCLUSOS.filter((sugestao) => !nomesUsados.has(sugestao.nome.toLowerCase()));

  async function executar(descricao, acao, desfazer) {
    setOcupado(descricao);
    setErro('');
    try {
      setInclusos(await acao());
    } catch (falha) {
      desfazer?.();
      setErro(falha.message);
    } finally {
      setOcupado(null);
    }
  }

  const trocar = (salvo) => inclusos.map((incluso) => (incluso.id === salvo.id ? salvo : incluso));

  function abrirNovo(sugestao = null) {
    setErro('');
    setFormulario({ novo: true, sugestao });
  }

  async function salvarNovo(dados) {
    const salvo = await cadastrarIncluso(imovelId, dados);
    setInclusos((atuais) => [...atuais, salvo]);
    setFormulario(null);
  }

  async function salvarEdicao(dados) {
    const salvo = await editarIncluso(imovelId, formulario.id, dados);
    setInclusos(trocar(salvo));
    setFormulario(null);
  }

  function alternarStatus(incluso) {
    const novoStatus = incluso.status === 'ativo' ? 'inativo' : 'ativo';
    executar(novoStatus === 'ativo' ? 'Ativando…' : 'Desativando…', async () =>
      trocar(await alterarStatusIncluso(imovelId, incluso.id, novoStatus)),
    );
  }

  function reordenar(de, para) {
    if (de === para || para < 0 || para >= inclusos.length) return;
    const ordemAnterior = inclusos;
    const novaOrdem = mover(inclusos, de, para);
    setInclusos(novaOrdem);
    executar(
      'Salvando a ordem…',
      () => reordenarInclusos(imovelId, novaOrdem.map((incluso) => incluso.id)),
      () => setInclusos(ordemAnterior),
    );
  }

  async function remover(incluso) {
    const confirmado = await confirmar({
      titulo: `Remover "${incluso.nome}"?`,
      texto: 'O serviço some do anúncio. Se ele já foi contratado em alguma reserva, desative em vez de remover.',
      rotuloConfirmar: 'Remover serviço',
    });
    if (!confirmado) return;
    executar('Removendo…', () => removerIncluso(imovelId, incluso.id));
  }

  const botaoIcone =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-linha sm:h-9 sm:w-9 text-grafite hover:border-tinta hover:text-tinta disabled:opacity-30 disabled:hover:border-linha';
  const botaoTexto =
    'shrink-0 rounded-full border border-linha px-3 py-1.5 text-sm sm:px-3.5 font-medium hover:border-tinta disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-grafite">
          {inclusos.length} de {LIMITE_INCLUSOS} · aparecem no anúncio e vêm marcados no carrinho, e o hóspede pode retirar
          {inclusos.length > 1 && ' · arraste para mudar a ordem'}
        </p>
        <button
          type="button"
          onClick={() => abrirNovo()}
          disabled={Boolean(formulario) || noLimite}
          className="inline-flex items-center gap-2 rounded-full border border-tinta px-5 py-2.5 text-sm font-medium hover:bg-tinta hover:text-marfim disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icone nome="mais" tamanho={16} /> Adicionar serviço
        </button>
      </div>

      {!formulario && !noLimite && sugestoes.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-grafite">Sugestões rápidas</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {sugestoes.map((sugestao) => (
              <li key={sugestao.nome}>
                <button
                  type="button"
                  onClick={() => abrirNovo(sugestao)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-borda px-3.5 py-1.5 text-sm hover:border-tinta hover:bg-areia"
                >
                  <Icone nome="mais" tamanho={14} /> {sugestao.nome}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-4 rounded-lg border border-erro/30 bg-erro-fundo px-4 py-3 text-sm text-erro">
          {erro}
        </p>
      )}
      <p role="status" className="mt-2 min-h-5 text-sm text-ouro-escuro">
        {ocupado}
      </p>

      {formulario?.novo && (
        <div className="mb-4">
          <FormularioIncluso
            key={formulario.sugestao?.nome ?? 'novo'}
            inicial={formulario.sugestao}
            aoSalvar={salvarNovo}
            aoCancelar={() => setFormulario(null)}
          />
        </div>
      )}

      {inclusos.length === 0 && !formulario ? (
        <p className="rounded-2xl border-2 border-dashed border-linha px-6 py-10 text-center text-sm text-grafite">
          Nenhum serviço incluso. Eles são opcionais: use as sugestões acima ou adicione o seu.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {inclusos.map((incluso, posicao) =>
            formulario?.id === incluso.id ? (
              <li key={incluso.id}>
                <FormularioIncluso inicial={incluso} editando aoSalvar={salvarEdicao} aoCancelar={() => setFormulario(null)} />
              </li>
            ) : (
              <li
                key={incluso.id}
                draggable={!ocupado && !formulario}
                onDragStart={() => setArrastando(posicao)}
                onDragEnd={() => setArrastando(null)}
                onDragOver={(evento) => evento.preventDefault()}
                onDrop={(evento) => {
                  evento.preventDefault();
                  if (arrastando !== null) reordenar(arrastando, posicao);
                  setArrastando(null);
                }}
                className={`flex flex-col gap-3 rounded-2xl border border-linha bg-white p-4 sm:flex-row sm:items-center ${
                  arrastando === posicao ? 'opacity-40' : ''
                } ${incluso.status === 'inativo' ? 'bg-areia/40' : ''}`}
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <Icone nome="arrastar" tamanho={18} className="mt-0.5 hidden shrink-0 cursor-grab text-grafite sm:block" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={`font-semibold ${incluso.status === 'inativo' ? 'text-grafite' : ''}`}>{incluso.nome}</span>
                      <SeloStatus status={incluso.status} />
                    </p>
                    {incluso.descricao && <p className="text-sm text-grafite">{incluso.descricao}</p>}
                    <p className="mt-0.5 text-sm">{descreverPreco(incluso)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    className={botaoIcone}
                    disabled={Boolean(ocupado) || posicao === 0}
                    onClick={() => reordenar(posicao, posicao - 1)}
                  >
                    <Icone nome="acima" tamanho={16} rotulo={`Mover "${incluso.nome}" para cima`} />
                  </button>
                  <button
                    type="button"
                    className={botaoIcone}
                    disabled={Boolean(ocupado) || posicao === inclusos.length - 1}
                    onClick={() => reordenar(posicao, posicao + 1)}
                  >
                    <Icone nome="abaixo" tamanho={16} rotulo={`Mover "${incluso.nome}" para baixo`} />
                  </button>
                  <button
                    type="button"
                    className={botaoTexto}
                    disabled={Boolean(ocupado) || Boolean(formulario)}
                    onClick={() => setFormulario({ id: incluso.id })}
                  >
                    Editar
                  </button>
                  <button type="button" className={botaoTexto} disabled={Boolean(ocupado)} onClick={() => alternarStatus(incluso)}>
                    {incluso.status === 'ativo' ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    className={`${botaoIcone} hover:border-erro hover:text-erro`}
                    disabled={Boolean(ocupado)}
                    onClick={() => remover(incluso)}
                  >
                    <Icone nome="lixeira" tamanho={16} rotulo={`Remover "${incluso.nome}"`} />
                  </button>
                </div>
              </li>
            ),
          )}
        </ol>
      )}
      {janelaConfirmacao}
    </>
  );
}

// RN17: de 0 a 15 serviços do próprio anfitrião (caseiro, limpeza, café da manhã...), opcionais para o hóspede
export default function GerenciadorInclusos({ imovelId }) {
  const { dados, erro, carregando, recarregar } = useDados(`inclusos|${imovelId}`, () => listarInclusos(imovelId));

  return (
    <section aria-labelledby="titulo-inclusos">
      <h2 id="titulo-inclusos" className="font-titulo text-3xl font-semibold">
        Serviços inclusos
      </h2>
      <p className="mb-4 mt-1 text-sm text-grafite">
        Serviços que você mesmo oferece no imóvel. O valor entra no seu repasse junto com a hospedagem, com a mesma comissão.
      </p>
      {carregando ? (
        <p className="text-sm text-grafite">Carregando…</p>
      ) : erro ? (
        <ErroCarregamento erro={erro} aoTentarDeNovo={recarregar} />
      ) : (
        <ListaInclusos imovelId={imovelId} inicial={dados} />
      )}
    </section>
  );
}
