const { ErroDadosInvalidos } = require('./erros');
const { normalizarCpfCnpj, ehCnpj } = require('./documento');
const { reaisParaCentavos } = require('./dinheiro');
const { ehDataValida } = require('./periodo');
const { textoEmUmaLinha } = require('./textos');

// H1.3 + RN13: o anfitrião e o prestador recebem os repasses numa subconta Asaas.
// Campos obrigatórios conferidos na documentação do Asaas (POST /v3/accounts) em 2026-10-19:
// cpfCnpj, mobilePhone, incomeValue, address, addressNumber, province, postalCode;
// birthDate para pessoa física e companyType para empresa
const TIPOS_EMPRESA = Object.freeze(['mei', 'limitada', 'individual', 'associacao']);

// Situação do cadastro no Asaas. Só 'aprovado' libera o recebimento (e a vitrine, RN13)
const SITUACOES_RECEBIMENTO = Object.freeze(['em_analise', 'pendente', 'aprovado', 'recusado']);

const IDADE_MINIMA = 18;
const RENDA_MAXIMA_CENTAVOS = 100_000_000_000; // R$ 1 bilhão

function idadeEm(dataNascimento, hoje) {
  const [anoNascimento, mesDiaNascimento] = [dataNascimento.slice(0, 4), dataNascimento.slice(5)];
  const [anoHoje, mesDiaHoje] = [hoje.slice(0, 4), hoje.slice(5)];
  return Number(anoHoje) - Number(anoNascimento) - (mesDiaHoje < mesDiaNascimento ? 1 : 0);
}

const somenteDigitos = (valor) => (typeof valor === 'string' ? valor.replace(/\D/g, '') : '');

// `hoje`: 'YYYY-MM-DD' de Brasília, para conferir a maioridade
function validarDadosRecebimento(dados = {}, { hoje }) {
  const camposInvalidos = {};
  const cpfCnpj = normalizarCpfCnpj(dados.cpf_cnpj);
  if (!cpfCnpj) camposInvalidos.cpf_cnpj = 'Informe um CPF ou CNPJ válido';

  const empresa = cpfCnpj !== null && ehCnpj(cpfCnpj);
  const dataNascimento = empresa ? null : dados.data_nascimento;
  if (!empresa && (!ehDataValida(dataNascimento) || dataNascimento > hoje || idadeEm(dataNascimento, hoje) < IDADE_MINIMA)) {
    camposInvalidos.data_nascimento = `Informe a data de nascimento (AAAA-MM-DD). É preciso ter ${IDADE_MINIMA} anos ou mais`;
  }
  const tipoEmpresa = empresa ? textoEmUmaLinha(dados.tipo_empresa) : null;
  if (empresa && !TIPOS_EMPRESA.includes(tipoEmpresa)) {
    camposInvalidos.tipo_empresa = `Para CNPJ, escolha o tipo de empresa: ${TIPOS_EMPRESA.join(', ')}`;
  }

  const telefoneCelular = somenteDigitos(dados.telefone_celular);
  if (!/^\d{2}9\d{8}$/.test(telefoneCelular)) camposInvalidos.telefone_celular = 'Informe o celular com DDD (11 dígitos)';

  const rendaMensal = reaisParaCentavos(dados.renda_mensal);
  if (rendaMensal === null || rendaMensal < 1 || rendaMensal > RENDA_MAXIMA_CENTAVOS) {
    camposInvalidos.renda_mensal = 'Informe a renda ou o faturamento mensal em reais';
  }

  const cep = somenteDigitos(dados.cep);
  if (!/^\d{8}$/.test(cep)) camposInvalidos.cep = 'Informe o CEP com 8 dígitos';

  const endereco = textoEmUmaLinha(dados.endereco);
  const numero = textoEmUmaLinha(dados.numero);
  const complemento = textoEmUmaLinha(dados.complemento);
  const bairro = textoEmUmaLinha(dados.bairro);
  if (endereco.length < 3 || endereco.length > 120) camposInvalidos.endereco = 'Informe a rua (até 120 caracteres)';
  if (numero.length < 1 || numero.length > 10) camposInvalidos.numero = 'Informe o número (use "S/N" se não houver)';
  if (complemento.length > 60) camposInvalidos.complemento = 'O complemento pode ter até 60 caracteres';
  if (bairro.length < 2 || bairro.length > 60) camposInvalidos.bairro = 'Informe o bairro';

  if (Object.keys(camposInvalidos).length > 0) throw new ErroDadosInvalidos(camposInvalidos);

  return { cpfCnpj, dataNascimento, tipoEmpresa, telefoneCelular, rendaMensal, cep, endereco, numero, complemento: complemento || null, bairro };
}

module.exports = { TIPOS_EMPRESA, SITUACOES_RECEBIMENTO, validarDadosRecebimento };
