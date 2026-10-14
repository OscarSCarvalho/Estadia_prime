const { paraUsuarioPublico } = require('../dominio/usuario');
const { ErroUsuarioNaoEncontrado } = require('../dominio/erros');

function criarObterUsuario({ repositorioUsuarios }) {
  return function obterUsuario(id) {
    const usuario = repositorioUsuarios.buscarPorId(id);
    if (!usuario) throw new ErroUsuarioNaoEncontrado();
    return paraUsuarioPublico(usuario);
  };
}

module.exports = { criarObterUsuario };
