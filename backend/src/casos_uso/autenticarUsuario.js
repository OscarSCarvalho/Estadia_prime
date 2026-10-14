const { normalizarEmail, paraUsuarioPublico } = require('../dominio/usuario');
const { ErroCredenciaisInvalidas, ErroMuitasTentativas } = require('../dominio/erros');

function criarAutenticarUsuario({ repositorioUsuarios, servicoSenha, limitadorTentativas }) {
  return async function autenticarUsuario({ email, senha, origem }) {
    const emailNormalizado = normalizarEmail(email);
    const chaveTentativas = `${origem}|${emailNormalizado}`;

    const segundosParaLiberar = limitadorTentativas.segundosAteLiberar(chaveTentativas);
    if (segundosParaLiberar > 0) {
      throw new ErroMuitasTentativas(segundosParaLiberar);
    }

    const usuario = emailNormalizado ? repositorioUsuarios.buscarPorEmail(emailNormalizado) : null;
    // Compara mesmo sem usuário (contra um hash fictício) para o tempo de resposta não revelar se o e-mail existe
    const senhaConfere = await servicoSenha.comparar(
      typeof senha === 'string' ? senha : '',
      usuario ? usuario.senha_hash : null
    );

    if (!usuario || !senhaConfere) {
      limitadorTentativas.registrarFalha(chaveTentativas);
      throw new ErroCredenciaisInvalidas();
    }

    limitadorTentativas.limpar(chaveTentativas);
    return paraUsuarioPublico(usuario);
  };
}

module.exports = { criarAutenticarUsuario };
