class ErroDominio extends Error {
  constructor(codigo, mensagem, detalhes) {
    super(mensagem);
    this.name = this.constructor.name;
    this.codigo = codigo;
    if (detalhes) this.detalhes = detalhes;
  }
}

class ErroDadosInvalidos extends ErroDominio {
  constructor(camposInvalidos) {
    super('DADOS_INVALIDOS', 'Dados inválidos', camposInvalidos);
  }
}

class ErroEmailJaCadastrado extends ErroDominio {
  constructor() {
    super('EMAIL_JA_CADASTRADO', 'E-mail já cadastrado');
  }
}

class ErroCredenciaisInvalidas extends ErroDominio {
  constructor() {
    super('CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos');
  }
}

class ErroMuitasTentativas extends ErroDominio {
  constructor(segundosParaLiberar) {
    const minutos = Math.max(1, Math.ceil(segundosParaLiberar / 60));
    super('MUITAS_TENTATIVAS', `Muitas tentativas. Tente novamente em ${minutos} minuto(s)`, { segundosParaLiberar });
  }
}

class ErroNaoAutenticado extends ErroDominio {
  constructor() {
    super('NAO_AUTENTICADO', 'Faça login para continuar');
  }
}

class ErroAcessoNegado extends ErroDominio {
  constructor() {
    super('ACESSO_NEGADO', 'Seu perfil não tem acesso a esta ação');
  }
}

class ErroUsuarioNaoEncontrado extends ErroDominio {
  constructor() {
    super('USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado');
  }
}

class ErroPeriodoInvalido extends ErroDominio {
  constructor(mensagem) {
    super('PERIODO_INVALIDO', mensagem);
  }
}

// Também usado quando o imóvel existe mas é de outro anfitrião: não revela que ele existe
class ErroImovelNaoEncontrado extends ErroDominio {
  constructor() {
    super('IMOVEL_NAO_ENCONTRADO', 'Imóvel não encontrado');
  }
}

class ErroServicoNaoEncontrado extends ErroDominio {
  constructor() {
    super('SERVICO_NAO_ENCONTRADO', 'Serviço não encontrado');
  }
}

class ErroFotoNaoEncontrada extends ErroDominio {
  constructor() {
    super('FOTO_NAO_ENCONTRADA', 'Foto não encontrada');
  }
}

class ErroLimiteFotos extends ErroDominio {
  constructor(limite) {
    super('LIMITE_FOTOS', `Limite de ${limite} fotos`, { limite });
  }
}

class ErroArquivoInvalido extends ErroDominio {
  constructor(mensagem) {
    super('ARQUIVO_INVALIDO', mensagem);
  }
}

class ErroImovelComReservasFuturas extends ErroDominio {
  constructor() {
    super('IMOVEL_COM_RESERVAS_FUTURAS', 'Imóvel tem reservas futuras');
  }
}

// SPEC "Carrinho e Criação da Reserva"
class ErroImovelIndisponivel extends ErroDominio {
  constructor() {
    super('IMOVEL_INDISPONIVEL', 'Imóvel indisponível nessas datas');
  }
}

class ErroPrestadorIndisponivel extends ErroDominio {
  constructor({ servicoId, data }) {
    super('PRESTADOR_INDISPONIVEL', 'Prestador indisponível nessa data', { servico_id: servicoId, data_servico: data });
  }
}

class ErroServicoForaDaCidade extends ErroDominio {
  constructor(servicoId) {
    super('SERVICO_FORA_DA_CIDADE', 'Serviço não atende a cidade do imóvel', { servico_id: servicoId });
  }
}

class ErroDataServicoForaDaEstadia extends ErroDominio {
  constructor({ servicoId, data }) {
    super('DATA_SERVICO_FORA_DA_ESTADIA', 'Data do serviço fora da estadia', { servico_id: servicoId, data_servico: data });
  }
}

// Serviço desativado, de prestador sem recebimento ou que não existe: não pode entrar no carrinho
class ErroServicoIndisponivel extends ErroDominio {
  constructor(servicoId) {
    super('SERVICO_INDISPONIVEL', 'Este serviço não está mais disponível', { servico_id: servicoId });
  }
}

class ErroCapacidadeExcedida extends ErroDominio {
  constructor(capacidade) {
    super('CAPACIDADE_EXCEDIDA', `O imóvel recebe no máximo ${capacidade} hóspedes`, { capacidade });
  }
}

// RN17. Também usado quando o incluso é de outro imóvel
class ErroServicoInclusoNaoEncontrado extends ErroDominio {
  constructor() {
    super('SERVICO_INCLUSO_NAO_ENCONTRADO', 'Serviço incluso não encontrado');
  }
}

class ErroLimiteInclusos extends ErroDominio {
  constructor(limite) {
    super('LIMITE_INCLUSOS', `Limite de ${limite} serviços inclusos por imóvel`, { limite });
  }
}

// FK RESTRICT de reserva_inclusos: o histórico das reservas precisa do incluso
class ErroServicoInclusoContratado extends ErroDominio {
  constructor() {
    super('SERVICO_INCLUSO_CONTRATADO', 'Este serviço já foi contratado em reservas. Desative-o em vez de remover');
  }
}

// RN21: incluso inativo, de outro imóvel ou inexistente no pedido de reserva
class ErroServicoInclusoIndisponivel extends ErroDominio {
  constructor(inclusoId) {
    super('SERVICO_INCLUSO_INDISPONIVEL', 'Este serviço incluso não está mais disponível', { incluso_id: inclusoId });
  }
}

// Também usada quando a reserva é de outro hóspede: não revela que ela existe
class ErroReservaNaoEncontrada extends ErroDominio {
  constructor() {
    super('RESERVA_NAO_ENCONTRADA', 'Reserva não encontrada');
  }
}

// Desistir sem reembolso só vale para reserva ainda não paga; a confirmada é cancelada com reembolso (4b)
class ErroReservaNaoPendente extends ErroDominio {
  constructor() {
    super('RESERVA_NAO_PENDENTE', 'Só é possível desistir de reservas que ainda aguardam pagamento');
  }
}

class ErroTransicaoStatusInvalida extends ErroDominio {
  constructor(de, para) {
    super('TRANSICAO_STATUS_INVALIDA', `Uma reserva ${de} não pode passar para ${para}`, { de, para });
  }
}

// SPEC "Avaliações" + RN11
class ErroAvaliacaoAntesDoCheckout extends ErroDominio {
  constructor() {
    super('AVALIACAO_ANTES_DO_CHECKOUT', 'Avaliação liberada após o checkout');
  }
}

// Reserva cancelada, expirada ou ainda sem pagamento: a estadia não aconteceu
class ErroReservaNaoAvaliavel extends ErroDominio {
  constructor() {
    super('RESERVA_NAO_AVALIAVEL', 'Só é possível avaliar estadias que aconteceram');
  }
}

class ErroPrazoAvaliacaoEncerrado extends ErroDominio {
  constructor() {
    super('PRAZO_AVALIACAO_ENCERRADO', 'Prazo de avaliação encerrado');
  }
}

class ErroAlvoForaDaReserva extends ErroDominio {
  constructor(tipoAlvo) {
    super(
      'ALVO_FORA_DA_RESERVA',
      tipoAlvo === 'servico' ? 'Este serviço não foi contratado nesta reserva' : 'Este imóvel não é o desta reserva',
    );
  }
}

class ErroAvaliacaoRepetida extends ErroDominio {
  constructor() {
    super('AVALIACAO_REPETIDA', 'Você já avaliou este item nesta reserva');
  }
}

module.exports = {
  ErroDominio,
  ErroDadosInvalidos,
  ErroEmailJaCadastrado,
  ErroCredenciaisInvalidas,
  ErroMuitasTentativas,
  ErroNaoAutenticado,
  ErroAcessoNegado,
  ErroUsuarioNaoEncontrado,
  ErroPeriodoInvalido,
  ErroImovelNaoEncontrado,
  ErroServicoNaoEncontrado,
  ErroFotoNaoEncontrada,
  ErroLimiteFotos,
  ErroArquivoInvalido,
  ErroImovelComReservasFuturas,
  ErroImovelIndisponivel,
  ErroPrestadorIndisponivel,
  ErroServicoForaDaCidade,
  ErroDataServicoForaDaEstadia,
  ErroServicoIndisponivel,
  ErroCapacidadeExcedida,
  ErroServicoInclusoNaoEncontrado,
  ErroLimiteInclusos,
  ErroServicoInclusoContratado,
  ErroServicoInclusoIndisponivel,
  ErroReservaNaoEncontrada,
  ErroReservaNaoPendente,
  ErroTransicaoStatusInvalida,
  ErroAvaliacaoAntesDoCheckout,
  ErroReservaNaoAvaliavel,
  ErroPrazoAvaliacaoEncerrado,
  ErroAlvoForaDaReserva,
  ErroAvaliacaoRepetida,
};
