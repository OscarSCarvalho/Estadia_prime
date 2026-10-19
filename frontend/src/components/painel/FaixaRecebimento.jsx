import { useRef, useState } from 'react';
import Alerta from '../Alerta.jsx';
import CampoSelecao from '../CampoSelecao.jsx';
import CampoTexto from '../CampoTexto.jsx';
import Icone from '../Icone.jsx';
import Janela from '../Janela.jsx';
import { useDados } from '../../hooks/useDados.js';
import { cadastrarRecebimento, obterSituacaoRecebimento } from '../../services/pagamentos.js';
import { TIPOS_EMPRESA } from '../../utils/perfis.js';
import { mascararDocumentoDigitado } from '../../utils/formatacao.js';

const CAMPOS_VAZIOS = {
  cpf_cnpj: '',
  data_nascimento: '',
  tipo_empresa: '',
  telefone_celular: '',
  renda_mensal: '',
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
};

// H1.3: dados que o Asaas exige para abrir a subconta de recebimento (CONTEXT §4.4)
function FormularioRecebimento({ aoConcluir }) {
  const [campos, setCampos] = useState(CAMPOS_VAZIOS);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const empresa = campos.cpf_cnpj.replace(/\D/g, '').length > 11;

  const campo = (nome) => ({
    value: campos[nome],
    erro: erros[nome],
    onChange: (evento) => setCampos((atuais) => ({ ...atuais, [nome]: evento.target.value })),
  });

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setErros({});
    setErroGeral('');
    try {
      aoConcluir(await cadastrarRecebimento(campos));
    } catch (falha) {
      if (falha.codigo === 'DADOS_INVALIDOS') setErros(falha.detalhes);
      else setErroGeral(falha.message);
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="min-h-0 flex-1 overflow-y-auto px-6 py-5" noValidate>
      <p className="text-sm text-grafite">
        Os pagamentos dos hóspedes são recebidos pelo <strong className="text-tinta">Asaas</strong>, nosso parceiro de pagamentos. Com
        estes dados abrimos a sua conta de recebimento; o valor de cada reserva cai nela 24 horas depois do check-in.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <CampoTexto
          rotulo="CPF ou CNPJ"
          inputMode="numeric"
          placeholder="000.000.000-00"
          {...campo('cpf_cnpj')}
          onChange={(evento) => setCampos((atuais) => ({ ...atuais, cpf_cnpj: mascararDocumentoDigitado(evento.target.value) }))}
        />
        {empresa ? (
          <CampoSelecao rotulo="Tipo de empresa" opcoes={[{ valor: '', rotulo: 'Escolha' }, ...TIPOS_EMPRESA]} {...campo('tipo_empresa')} />
        ) : (
          <CampoTexto rotulo="Data de nascimento" type="date" {...campo('data_nascimento')} />
        )}
        <CampoTexto rotulo="Celular com DDD" type="tel" inputMode="tel" placeholder="(21) 99999-0000" autoComplete="tel" {...campo('telefone_celular')} />
        <CampoTexto
          rotulo={empresa ? 'Faturamento mensal (R$)' : 'Renda mensal (R$)'}
          inputMode="decimal"
          placeholder="10.000,00"
          {...campo('renda_mensal')}
        />
        <CampoTexto rotulo="CEP" inputMode="numeric" placeholder="00000-000" autoComplete="postal-code" {...campo('cep')} />
        <CampoTexto rotulo="Bairro" {...campo('bairro')} />
        <div className="sm:col-span-2">
          <CampoTexto rotulo="Rua" autoComplete="address-line1" {...campo('endereco')} />
        </div>
        <CampoTexto rotulo="Número" {...campo('numero')} />
        <CampoTexto rotulo="Complemento (opcional)" {...campo('complemento')} />
      </div>
      <div className="mt-5">
        <Alerta>{erroGeral}</Alerta>
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="mt-5 w-full rounded-full bg-tinta px-6 py-3.5 font-medium text-marfim hover:bg-grafite disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? 'Enviando ao Asaas…' : 'Enviar cadastro'}
      </button>
    </form>
  );
}

const ESTILOS = {
  aviso: 'border-ouro/60 bg-ouro/10',
  analise: 'border-linha bg-white',
  erro: 'border-erro/30 bg-erro-fundo',
};

// RN13: sem a subconta aprovada, os imóveis/serviços não aparecem na busca. `oQueAparece`: "seus imóveis" / "seus serviços"
export default function FaixaRecebimento({ oQueAparece }) {
  const janela = useRef(null);
  const { dados, erro, carregando, recarregar } = useDados('recebimento', obterSituacaoRecebimento);
  const [atualizado, setAtualizado] = useState(null);
  const recebimento = atualizado ?? dados;

  if (carregando || erro || !recebimento) return null;

  if (recebimento.situacao === 'aprovado') {
    return (
      <p className="mt-6 inline-flex items-center gap-2 text-sm text-grafite">
        <Icone nome="confirmado" tamanho={18} className="text-ouro-escuro" />
        Recebimento ativo{recebimento.cpf_cnpj && ` · ${recebimento.cpf_cnpj}`}. Os repasses caem na sua conta Asaas.
      </p>
    );
  }

  const naoCadastrado = recebimento.situacao === 'nao_cadastrado';
  const recusado = recebimento.situacao === 'recusado';
  return (
    <section className={`mt-6 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${ESTILOS[naoCadastrado ? 'aviso' : recusado ? 'erro' : 'analise']}`}>
      <div className="flex gap-3">
        <Icone nome={naoCadastrado ? 'carteira' : recusado ? 'alerta' : 'relogio'} tamanho={24} className="mt-0.5 shrink-0 text-ouro-escuro" />
        <div>
          <h2 className="font-semibold">
            {naoCadastrado
              ? 'Cadastre seu recebimento para aparecer na busca'
              : recusado
                ? 'O Asaas não aprovou seu cadastro de recebimento'
                : 'Cadastro de recebimento em análise'}
          </h2>
          <p className="mt-1 text-sm text-grafite">
            {naoCadastrado
              ? `Enquanto o recebimento não estiver aprovado, ${oQueAparece} não aparecem para os hóspedes.`
              : recusado
                ? 'Fale com o suporte da Estadia Prime para revisar os dados.'
                : `O Asaas está conferindo seus dados. Assim que aprovar, ${oQueAparece} passam a aparecer na busca.`}
          </p>
        </div>
      </div>
      {naoCadastrado ? (
        <button
          type="button"
          onClick={() => janela.current.showModal()}
          className="shrink-0 rounded-full bg-tinta px-5 py-3 text-sm font-medium text-marfim hover:bg-grafite"
        >
          Cadastrar recebimento
        </button>
      ) : (
        !recusado && (
          <button
            type="button"
            onClick={() => {
              setAtualizado(null);
              recarregar();
            }}
            className="shrink-0 rounded-full border border-tinta px-5 py-3 text-sm font-medium hover:bg-tinta hover:text-marfim"
          >
            Atualizar situação
          </button>
        )
      )}
      <Janela referencia={janela} titulo="Cadastro de recebimento" largura="max-w-2xl">
        <FormularioRecebimento
          aoConcluir={(novo) => {
            setAtualizado(novo);
            janela.current.close();
          }}
        />
      </Janela>
    </section>
  );
}
