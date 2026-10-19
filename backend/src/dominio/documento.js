const { ErroDadosInvalidos } = require('./erros');

// CPF (pessoa física) e CNPJ (empresa), exigidos pelo Asaas para o cliente (hóspede) e para a subconta
// (anfitrião/prestador). Gravados só com dígitos; o dígito verificador é conferido aqui.
// O CNPJ alfanumérico (Receita, a partir de jul/2026) ainda não é aceito: ver CONTEXT §4.4

const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_2 = [6, ...PESOS_CNPJ_1];

const digitos = (texto) => [...texto].map(Number);
const todosIguais = (texto) => /^(\d)\1+$/.test(texto);

function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf) || todosIguais(cpf)) return false;
  const numeros = digitos(cpf);
  const verificador = (quantidade) => {
    const soma = numeros.slice(0, quantidade).reduce((total, numero, i) => total + numero * (quantidade + 1 - i), 0);
    return ((soma * 10) % 11) % 10;
  };
  return verificador(9) === numeros[9] && verificador(10) === numeros[10];
}

function cnpjValido(cnpj) {
  if (!/^\d{14}$/.test(cnpj) || todosIguais(cnpj)) return false;
  const numeros = digitos(cnpj);
  const verificador = (pesos) => {
    const resto = pesos.reduce((total, peso, i) => total + numeros[i] * peso, 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return verificador(PESOS_CNPJ_1) === numeros[12] && verificador(PESOS_CNPJ_2) === numeros[13];
}

// Aceita com ou sem pontuação ("123.456.789-09"). Devolve só os dígitos ou null se for inválido
function normalizarCpfCnpj(valor) {
  if (typeof valor !== 'string') return null;
  const somenteDigitos = valor.replace(/[\s.\-/]/g, '');
  if (cpfValido(somenteDigitos) || cnpjValido(somenteDigitos)) return somenteDigitos;
  return null;
}

function exigirCpfCnpj(valor, campo = 'cpf_cnpj') {
  const documento = normalizarCpfCnpj(valor);
  if (!documento) throw new ErroDadosInvalidos({ [campo]: 'Informe um CPF ou CNPJ válido' });
  return documento;
}

const ehCnpj = (documento) => documento.length === 14;

// LGPD: a tela mostra só o miolo do documento. CPF → ***.123.456-**; CNPJ → **.345.678/0001-**
function mascararCpfCnpj(documento) {
  if (!documento) return null;
  if (ehCnpj(documento)) return `**.${documento.slice(2, 5)}.${documento.slice(5, 8)}/${documento.slice(8, 12)}-**`;
  return `***.${documento.slice(3, 6)}.${documento.slice(6, 9)}-**`;
}

module.exports = { cpfValido, cnpjValido, normalizarCpfCnpj, exigirCpfCnpj, ehCnpj, mascararCpfCnpj };
