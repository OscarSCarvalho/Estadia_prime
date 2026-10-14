const { validarCadastro, paraUsuarioPublico } = require('../dominio/usuario');
const { ErroEmailJaCadastrado } = require('../dominio/erros');

function criarCadastrarUsuario({ repositorioUsuarios, servicoSenha }) {
  return async function cadastrarUsuario(dados) {
    const { senha, ...novoUsuario } = validarCadastro(dados);

    if (repositorioUsuarios.buscarPorEmail(novoUsuario.email)) {
      throw new ErroEmailJaCadastrado();
    }

    const senha_hash = await servicoSenha.gerarHash(senha);
    const usuarioCriado = repositorioUsuarios.inserir({ ...novoUsuario, senha_hash });
    return paraUsuarioPublico(usuarioCriado);
  };
}

module.exports = { criarCadastrarUsuario };
