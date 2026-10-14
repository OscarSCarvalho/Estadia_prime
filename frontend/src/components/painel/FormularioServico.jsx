import { useId, useState } from 'react';
import CampoTexto from '../CampoTexto.jsx';
import CampoSelecao from '../CampoSelecao.jsx';
import CampoAreaTexto from '../CampoAreaTexto.jsx';
import Botao from '../Botao.jsx';
import Alerta from '../Alerta.jsx';
import { useDados } from '../../hooks/useDados.js';
import { listarCidades } from '../../services/catalogo.js';
import { TIPOS_SERVICO, UNIDADES_PRECO } from '../../utils/perfis.js';
import { centavosParaTextoReais } from '../../utils/formatacao.js';

function paraFormulario(servico) {
  if (!servico) return { tipo_servico: 'mordomo', unidade_preco: 'diaria', preco: '', cidade_atuacao: '', descricao: '' };
  return {
    tipo_servico: servico.tipo_servico,
    unidade_preco: servico.unidade_preco,
    preco: centavosParaTextoReais(servico.preco),
    cidade_atuacao: servico.cidade_atuacao,
    descricao: servico.descricao ?? '',
  };
}

// H3.1: cadastro e edição de um serviço. `aoSalvar(dados)` chama a API
export default function FormularioServico({ servico, aoSalvar, aoCancelar }) {
  const [formulario, setFormulario] = useState(() => paraFormulario(servico));
  const [errosCampos, setErrosCampos] = useState({});
  const [mensagemErro, setMensagemErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const idListaCidades = useId();
  const { dados: cidades } = useDados('cidades', listarCidades);

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
    <form onSubmit={aoEnviar} className="flex flex-col gap-5" noValidate>
      <Alerta>{mensagemErro}</Alerta>
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoSelecao rotulo="Tipo de serviço" opcoes={TIPOS_SERVICO} {...propsCampo('tipo_servico')} />
        <CampoTexto rotulo="Cidade onde atende" list={idListaCidades} autoComplete="off" required {...propsCampo('cidade_atuacao')} />
      </div>
      <datalist id={idListaCidades}>
        {(cidades ?? []).map(({ cidade }) => (
          <option key={cidade} value={cidade} />
        ))}
      </datalist>
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoTexto rotulo="Preço (R$)" inputMode="decimal" placeholder="800,00" required {...propsCampo('preco')} />
        <CampoSelecao rotulo="Cobrança" opcoes={UNIDADES_PRECO} {...propsCampo('unidade_preco')} />
      </div>
      <CampoAreaTexto
        rotulo="Descrição (opcional)"
        rows={3}
        maxLength={1000}
        placeholder="Experiência, idiomas, o que está incluído…"
        {...propsCampo('descricao')}
      />
      <div className="flex flex-wrap gap-3">
        <Botao carregando={enviando} textoCarregando="Salvando…" className="sm:w-auto">
          {servico ? 'Salvar alterações' : 'Cadastrar serviço'}
        </Botao>
        <button
          type="button"
          onClick={aoCancelar}
          className="rounded-full border border-linha px-6 py-3.5 font-medium hover:border-tinta"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
