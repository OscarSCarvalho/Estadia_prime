const { ErroDadosInvalidos } = require('./erros');
const { mascararCpfCnpj } = require('./documento');

const PERFIS_USUARIO = Object.freeze(['hospede', 'anfitriao', 'prestador']);

const SENHA_TAMANHO_MINIMO = 8;
// O bcrypt ignora tudo depois do 72º byte; limitar evita senhas que "parecem" diferentes mas não são
const SENHA_TAMANHO_MAXIMO_BYTES = 72;
const NOME_TAMANHO_MAXIMO = 100;
const EMAIL_TAMANHO_MAXIMO = 254;
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function textoOuVazio(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function normalizarEmail(email) {
  return textoOuVazio(email).toLowerCase();
}

function normalizarTelefone(telefone) {
  const somenteDigitos = textoOuVazio(telefone).replace(/\D/g, '');
  return somenteDigitos === '' ? null : somenteDigitos;
}

function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.length < SENHA_TAMANHO_MINIMO) {
    return `A senha precisa ter pelo menos ${SENHA_TAMANHO_MINIMO} caracteres`;
  }
  if (new TextEncoder().encode(senha).length > SENHA_TAMANHO_MAXIMO_BYTES) {
    return 'A senha é longa demais';
  }
  return null;
}

function validarCadastro(dados = {}) {
  const nome = textoOuVazio(dados.nome).replace(/\s+/g, ' ');
  const email = normalizarEmail(dados.email);
  const telefone = normalizarTelefone(dados.telefone);
  const tipo = textoOuVazio(dados.tipo);
  const camposInvalidos = {};

  if (nome.length < 2 || nome.length > NOME_TAMANHO_MAXIMO) {
    camposInvalidos.nome = `Informe um nome entre 2 e ${NOME_TAMANHO_MAXIMO} caracteres`;
  }
  if (!FORMATO_EMAIL.test(email) || email.length > EMAIL_TAMANHO_MAXIMO) {
    camposInvalidos.email = 'Informe um e-mail válido';
  }
  const problemaSenha = validarSenha(dados.senha);
  if (problemaSenha) camposInvalidos.senha = problemaSenha;
  if (telefone !== null && (telefone.length < 10 || telefone.length > 13)) {
    camposInvalidos.telefone = 'Informe o telefone com DDD';
  }
  if (!PERFIS_USUARIO.includes(tipo)) {
    camposInvalidos.tipo = `Escolha um perfil: ${PERFIS_USUARIO.join(', ')}`;
  }

  if (Object.keys(camposInvalidos).length > 0) {
    throw new ErroDadosInvalidos(camposInvalidos);
  }

  return { nome, email, telefone, tipo, senha: dados.senha };
}

function paraUsuarioPublico(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    telefone: usuario.telefone,
    tipo: usuario.tipo,
    data_cadastro: usuario.data_cadastro,
    // LGPD: o documento completo nunca sai da API, só mascarado (***.123.456-**)
    cpf_cnpj: mascararCpfCnpj(usuario.cpf_cnpj),
  };
}

module.exports = {
  PERFIS_USUARIO,
  validarCadastro,
  normalizarEmail,
  paraUsuarioPublico,
};
