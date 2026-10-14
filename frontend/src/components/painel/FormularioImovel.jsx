import { useId, useState } from 'react';
import CampoTexto from '../CampoTexto.jsx';
import CampoSelecao from '../CampoSelecao.jsx';
import CampoAreaTexto from '../CampoAreaTexto.jsx';
import Botao from '../Botao.jsx';
import Alerta from '../Alerta.jsx';
import { useDados } from '../../hooks/useDados.js';
import { listarCidades } from '../../services/catalogo.js';
import { ESTADOS, ROTULO_TIPO_IMOVEL } from '../../utils/perfis.js';
import { centavosParaTextoReais } from '../../utils/formatacao.js';

const OPCOES_TIPO = Object.entries(ROTULO_TIPO_IMOVEL).map(([valor, rotulo]) => ({ valor, rotulo }));
const OPCOES_ESTADO = [{ valor: '', rotulo: 'Escolha' }, ...ESTADOS.map((uf) => ({ valor: uf, rotulo: uf }))];

function paraFormulario(imovel) {
  if (!imovel) {
    return { titulo: '', tipo_imovel: 'villa', descricao: '', endereco: '', cidade: '', estado: '', diaria: '', num_hospedes: '', num_quartos: '' };
  }
  return {
    titulo: imovel.titulo,
    tipo_imovel: imovel.tipo_imovel,
    descricao: imovel.descricao ?? '',
    endereco: imovel.endereco,
    cidade: imovel.cidade,
    estado: imovel.estado,
    diaria: centavosParaTextoReais(imovel.preco_diaria),
    num_hospedes: String(imovel.num_hospedes),
    num_quartos: String(imovel.num_quartos),
  };
}

// Cadastro e edição usam o mesmo formulário. `aoSalvar(dados)` chama a API; os erros por campo
// (DADOS_INVALIDOS) aparecem embaixo de cada campo
export default function FormularioImovel({ imovel, textoBotao, textoSalvando, aoSalvar }) {
  const [formulario, setFormulario] = useState(() => paraFormulario(imovel));
  const [errosCampos, setErrosCampos] = useState({});
  const [mensagem, setMensagem] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const idListaCidades = useId();
  const { dados: cidades } = useDados('cidades', listarCidades);

  function atualizar(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
    setErrosCampos((atuais) => ({ ...atuais, [campo]: undefined }));
    setMensagem(null);
  }

  async function aoEnviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setMensagem(null);
    setErrosCampos({});
    try {
      const salvo = await aoSalvar(formulario);
      if (salvo) {
        setFormulario(paraFormulario(salvo));
        setMensagem({ tipo: 'sucesso', texto: 'Alterações salvas.' });
      }
    } catch (erro) {
      if (erro.codigo === 'DADOS_INVALIDOS') {
        setErrosCampos(erro.detalhes);
        setMensagem({ tipo: 'erro', texto: 'Revise os campos destacados.' });
      } else {
        setMensagem({ tipo: 'erro', texto: erro.message });
      }
    } finally {
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
      {mensagem?.tipo === 'erro' && <Alerta>{mensagem.texto}</Alerta>}

      <CampoTexto rotulo="Título do anúncio" maxLength={120} placeholder="Ex.: Villa Vista Mar" required {...propsCampo('titulo')} />

      <div className="grid gap-5 sm:grid-cols-2">
        <CampoSelecao rotulo="Tipo de imóvel" opcoes={OPCOES_TIPO} {...propsCampo('tipo_imovel')} />
        <CampoTexto
          rotulo="Diária (R$)"
          inputMode="decimal"
          placeholder="2.500,00"
          ajuda="Valor de uma noite, em reais."
          required
          {...propsCampo('diaria')}
        />
      </div>

      <CampoAreaTexto
        rotulo="Descrição (opcional)"
        maxLength={3000}
        placeholder="O que torna o imóvel especial: vista, piscina, arquitetura, localização…"
        {...propsCampo('descricao')}
      />

      <CampoTexto
        rotulo="Endereço"
        autoComplete="street-address"
        placeholder="Rua, número e complemento"
        ajuda="O hóspede só vê o endereço depois da reserva confirmada."
        required
        {...propsCampo('endereco')}
      />

      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        <CampoTexto rotulo="Cidade" list={idListaCidades} autoComplete="off" required {...propsCampo('cidade')} />
        <CampoSelecao rotulo="Estado" opcoes={OPCOES_ESTADO} {...propsCampo('estado')} />
      </div>
      <datalist id={idListaCidades}>
        {(cidades ?? []).map(({ cidade }) => (
          <option key={cidade} value={cidade} />
        ))}
      </datalist>

      <div className="grid gap-5 sm:grid-cols-2">
        <CampoTexto rotulo="Hóspedes (máximo)" type="number" min={1} max={50} inputMode="numeric" required {...propsCampo('num_hospedes')} />
        <CampoTexto rotulo="Quartos" type="number" min={0} max={50} inputMode="numeric" required {...propsCampo('num_quartos')} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Botao carregando={enviando} textoCarregando={textoSalvando} className="sm:w-auto">
          {textoBotao}
        </Botao>
        {mensagem?.tipo === 'sucesso' && (
          <p role="status" className="text-sm font-medium text-ouro-escuro">
            {mensagem.texto}
          </p>
        )}
      </div>
    </form>
  );
}
