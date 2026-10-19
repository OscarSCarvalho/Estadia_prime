const express = require('express');

const { criarRepositorioUsuarios } = require('./repositorios/repositorioUsuarios');
const { criarRepositorioImoveis } = require('./repositorios/repositorioImoveis');
const { criarRepositorioFotos } = require('./repositorios/repositorioFotos');
const { criarRepositorioServicos } = require('./repositorios/repositorioServicos');
const { criarRepositorioBusca } = require('./repositorios/repositorioBusca');
const { criarRepositorioReservas } = require('./repositorios/repositorioReservas');
const { criarRepositorioAvaliacoes } = require('./repositorios/repositorioAvaliacoes');
const { criarRepositorioServicosInclusos } = require('./repositorios/repositorioServicosInclusos');
const { criarRepositorioPagamentos } = require('./repositorios/repositorioPagamentos');
const { criarRepositorioRepasses } = require('./repositorios/repositorioRepasses');
const { criarServicoSenhaBcrypt } = require('./adaptadores/servicoSenhaBcrypt');
const { criarLimitadorTentativasMemoria } = require('./adaptadores/limitadorTentativasMemoria');
const { criarArmazenamentoFotosDisco } = require('./adaptadores/armazenamentoFotosDisco');
const { criarGatewayAsaas } = require('./adaptadores/gatewayAsaas');
const { criarGatewayFalso } = require('./adaptadores/gatewayFalso');
const { criarCifraAesGcm } = require('./adaptadores/cifraAesGcm');
const { criarCadastrarUsuario } = require('./casos_uso/cadastrarUsuario');
const { criarAutenticarUsuario } = require('./casos_uso/autenticarUsuario');
const { criarObterUsuario } = require('./casos_uso/obterUsuario');
const imoveisDoAnfitriao = require('./casos_uso/imoveisDoAnfitriao');
const fotosDoImovel = require('./casos_uso/fotosDoImovel');
const servicosDoPrestador = require('./casos_uso/servicosDoPrestador');
const servicosInclusos = require('./casos_uso/servicosInclusos');
const catalogo = require('./casos_uso/catalogo');
const reservas = require('./casos_uso/reservas');
const avaliacoes = require('./casos_uso/avaliacoes');
const pagamentos = require('./casos_uso/pagamentos');
const recebimento = require('./casos_uso/recebimento');
const cancelamento = require('./casos_uso/cancelamento');
const { criarExecutarRepasses } = require('./casos_uso/repasses');
const { criarMiddlewareSessao } = require('./middleware/sessao');
const { cabecalhosSeguranca, semCache } = require('./middleware/seguranca');
const { criarTratadorErros, rotaNaoEncontrada } = require('./middleware/tratarErros');
const { criarRotasAuth } = require('./routes/auth');
const { criarRotasImoveis, criarRotasMeusImoveis } = require('./routes/imoveis');
const { criarRotasServicos, criarRotasMeusServicos } = require('./routes/servicos');
const { criarRotasCidades } = require('./routes/cidades');
const { criarRotasReservas, criarRotasReservasRecebidas, criarRotasAgenda } = require('./routes/reservas');
const { criarRotasAvaliacoes } = require('./routes/avaliacoes');
const { criarRotasRecebimento } = require('./routes/recebimento');
const { criarRotasWebhooks, criarRotasDesenvolvimento } = require('./routes/webhooks');

// CONTEXT §4.4: Asaas em produção (e no teste manual com o sandbox); gateway falso no resto
function criarGateway(config) {
  if (config.gatewayPagamento === 'asaas') {
    return criarGatewayAsaas({
      urlApi: config.asaasApiUrl,
      chaveApi: config.asaasApiKey,
      tokenWebhook: config.asaasWebhookToken,
      urlWebhook: `${config.urlPublicaSite}/api/webhooks/asaas`,
    });
  }
  return criarGatewayFalso({ tokenWebhook: config.asaasWebhookToken || undefined });
}

// Raiz de composição: único ponto que conhece as implementações concretas e as injeta nos casos de uso.
// `gateway` pode ser injetado (testes); senão vem da config
function criarApp({ db, config, registrarErro = console.error, gateway = criarGateway(config) }) {
  // RN13: em produção só aparece na busca quem tem a subconta Asaas aprovada
  const visibilidade = { exigirRecebimento: !config.permitirSemRecebimento };

  const repositorioUsuarios = criarRepositorioUsuarios(db);
  const repositorioImoveis = criarRepositorioImoveis(db);
  const repositorioFotos = criarRepositorioFotos(db);
  const repositorioServicos = criarRepositorioServicos(db, visibilidade);
  const repositorioBusca = criarRepositorioBusca(db, visibilidade);
  const repositorioReservas = criarRepositorioReservas(db, visibilidade);
  const repositorioAvaliacoes = criarRepositorioAvaliacoes(db);
  const repositorioServicosInclusos = criarRepositorioServicosInclusos(db);
  const repositorioPagamentos = criarRepositorioPagamentos(db);
  const repositorioRepasses = criarRepositorioRepasses(db);
  // CB09: a comissão vale para novas reservas; as antigas guardam o valor gravado
  const comissoes = { comissaoHospedagemPct: config.comissaoHospedagemPct, comissaoServicoPct: config.comissaoServicoPct };
  const servicoSenha = criarServicoSenhaBcrypt({ custo: config.custoHashSenha });
  const limitadorTentativas = criarLimitadorTentativasMemoria();
  const armazenamentoFotos = criarArmazenamentoFotosDisco({ pasta: config.pastaUploads });
  const concluirReservasVencidas = avaliacoes.criarConcluirReservasVencidas({ repositorioReservas });
  const cifra = criarCifraAesGcm(config.chaveCriptografia);

  // Etapa 4b: peças de pagamento usadas por mais de um caso de uso
  const cancelarCobrancaAberta = pagamentos.criarCancelarCobrancaAberta({ repositorioPagamentos, gateway, registrarErro });
  const reembolsarPagamento = pagamentos.criarReembolsarPagamento({ repositorioPagamentos, gateway, registrarErro });
  const atualizarSituacaoRecebimento = recebimento.criarAtualizarSituacaoRecebimento({ repositorioUsuarios });
  const desistirDaReserva = reservas.criarDesistirDaReserva({ repositorioReservas, cancelarCobrancaAberta });
  const processarEventoPagamento = pagamentos.criarProcessarEventoPagamento({
    repositorioReservas,
    repositorioPagamentos,
    repositorioBusca,
    gateway,
    atualizarSituacaoRecebimento,
    reembolsarPagamento,
    cancelarCobrancaAberta,
    registrarErro,
  });

  const casosUso = {
    cadastrarUsuario: criarCadastrarUsuario({ repositorioUsuarios, servicoSenha }),
    autenticarUsuario: criarAutenticarUsuario({ repositorioUsuarios, servicoSenha, limitadorTentativas }),
    obterUsuario: criarObterUsuario({ repositorioUsuarios }),

    cadastrarImovel: imoveisDoAnfitriao.criarCadastrarImovel({ repositorioImoveis }),
    editarImovel: imoveisDoAnfitriao.criarEditarImovel({ repositorioImoveis }),
    alterarStatusImovel: imoveisDoAnfitriao.criarAlterarStatusImovel({ repositorioImoveis }),
    listarMeusImoveis: imoveisDoAnfitriao.criarListarMeusImoveis({ repositorioImoveis }),
    obterMeuImovel: imoveisDoAnfitriao.criarObterMeuImovel({ repositorioImoveis, repositorioFotos }),
    adicionarFotos: fotosDoImovel.criarAdicionarFotos({ repositorioImoveis, repositorioFotos, armazenamentoFotos }),
    removerFoto: fotosDoImovel.criarRemoverFoto({ repositorioImoveis, repositorioFotos, armazenamentoFotos }),
    reordenarFotos: fotosDoImovel.criarReordenarFotos({ repositorioImoveis, repositorioFotos }),

    listarInclusos: servicosInclusos.criarListarInclusos({ repositorioImoveis, repositorioServicosInclusos }),
    cadastrarIncluso: servicosInclusos.criarCadastrarIncluso({ repositorioImoveis, repositorioServicosInclusos }),
    editarIncluso: servicosInclusos.criarEditarIncluso({ repositorioImoveis, repositorioServicosInclusos }),
    alterarStatusIncluso: servicosInclusos.criarAlterarStatusIncluso({ repositorioImoveis, repositorioServicosInclusos }),
    reordenarInclusos: servicosInclusos.criarReordenarInclusos({ repositorioImoveis, repositorioServicosInclusos }),
    removerIncluso: servicosInclusos.criarRemoverIncluso({ repositorioImoveis, repositorioServicosInclusos }),

    cadastrarServico: servicosDoPrestador.criarCadastrarServico({ repositorioServicos }),
    editarServico: servicosDoPrestador.criarEditarServico({ repositorioServicos }),
    alterarStatusServico: servicosDoPrestador.criarAlterarStatusServico({ repositorioServicos }),
    listarMeusServicos: servicosDoPrestador.criarListarMeusServicos({ repositorioServicos }),

    buscarImoveis: catalogo.criarBuscarImoveis({ repositorioBusca }),
    obterImovel: catalogo.criarObterImovel({ repositorioBusca, repositorioServicos, repositorioServicosInclusos }),
    verificarDisponibilidade: catalogo.criarVerificarDisponibilidade({ repositorioBusca }),
    listarCidades: catalogo.criarListarCidades({ repositorioBusca }),
    buscarServicos: catalogo.criarBuscarServicos({ repositorioServicos }),
    listarServicosDaEstadia: catalogo.criarListarServicosDaEstadia({ repositorioBusca, repositorioServicos, repositorioReservas }),

    criarReserva: reservas.criarCriarReserva({ repositorioReservas, repositorioBusca, ...comissoes }),
    listarMinhasReservas: reservas.criarListarMinhasReservas({ repositorioReservas, repositorioAvaliacoes, concluirReservasVencidas }),
    listarReservasDoAnfitriao: reservas.criarListarReservasDoAnfitriao({ repositorioReservas, repositorioRepasses, concluirReservasVencidas }),
    agendaDoPrestador: reservas.criarAgendaDoPrestador({ repositorioReservas, repositorioRepasses, concluirReservasVencidas }),
    desistirDaReserva,

    atualizarDocumento: recebimento.criarAtualizarDocumento({ repositorioUsuarios }),
    iniciarCadastroRecebimento: recebimento.criarIniciarCadastroRecebimento({ repositorioUsuarios, gateway, cifra }),
    obterSituacaoRecebimento: recebimento.criarObterSituacaoRecebimento({ repositorioUsuarios, gateway, cifra, registrarErro }),

    iniciarPagamento: pagamentos.criarIniciarPagamento({
      repositorioReservas, repositorioPagamentos, repositorioUsuarios, gateway, urlPublicaSite: config.urlPublicaSite, registrarErro,
    }),
    obterSituacaoPagamento: pagamentos.criarObterSituacaoPagamento({ repositorioReservas, repositorioPagamentos, gateway }),
    processarEventoPagamento,
    simularPagamento: pagamentos.criarSimularPagamento({ repositorioReservas, repositorioPagamentos, gateway, processarEventoPagamento }),
    previaCancelamento: cancelamento.criarPreviaCancelamento({ repositorioReservas, repositorioPagamentos, repositorioRepasses }),
    cancelarReserva: cancelamento.criarCancelarReserva({
      repositorioReservas, repositorioPagamentos, repositorioRepasses, gateway, desistirDaReserva,
    }),

    avaliar: avaliacoes.criarAvaliar({ repositorioReservas, repositorioAvaliacoes, concluirReservasVencidas }),
    listarAvaliacoes: avaliacoes.criarListarAvaliacoes({ repositorioAvaliacoes, repositorioBusca, repositorioServicos }),
  };

  const sessao = criarMiddlewareSessao({ db, segredo: config.segredoSessao, emProducao: config.emProducao });

  const app = express();
  app.disable('x-powered-by');
  // Atrás do Nginx em produção: necessário para o cookie "secure" e para req.ip ser o IP real do cliente
  if (config.emProducao) app.set('trust proxy', 1);

  app.use(cabecalhosSeguranca);

  // Nomes gerados no servidor (UUID) nunca mudam de conteúdo: o navegador pode guardar em cache.
  // A CSP impede que um arquivo aberto direto no navegador execute qualquer coisa
  app.use(
    '/uploads',
    express.static(armazenamentoFotos.pasta, {
      index: false,
      dotfiles: 'ignore',
      immutable: true,
      maxAge: '30d',
      setHeaders: (res) => res.set('Content-Security-Policy', "default-src 'none'"),
    }),
  );

  // Antes da sessão: quem chama o webhook é o Asaas, não um navegador logado
  app.use('/api/webhooks', semCache, express.json({ limit: '1mb' }), criarRotasWebhooks({ gateway, processarEventoPagamento }));

  app.use('/api', semCache, express.json({ limit: '100kb' }), sessao.middleware);

  app.get('/api/saude', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', criarRotasAuth({ ...casosUso, emProducao: config.emProducao }));
  // Antes de /api/imoveis, /api/servicos e /api/reservas: atende os caminhos /:id/avaliacoes desses recursos
  app.use('/api', criarRotasAvaliacoes(casosUso));
  app.use('/api/imoveis', criarRotasImoveis(casosUso));
  app.use('/api/meus-imoveis', criarRotasMeusImoveis(casosUso));
  app.use('/api/servicos', criarRotasServicos(casosUso));
  app.use('/api/meus-servicos', criarRotasMeusServicos(casosUso));
  app.use('/api/cidades', criarRotasCidades(casosUso));
  app.use('/api/reservas', criarRotasReservas(casosUso));
  app.use('/api/reservas-recebidas', criarRotasReservasRecebidas(casosUso));
  app.use('/api/agenda', criarRotasAgenda(casosUso));
  app.use('/api/recebimento', criarRotasRecebimento(casosUso));
  if (gateway.simulado && !config.emProducao) app.use('/api/dev', criarRotasDesenvolvimento(casosUso));

  app.use('/api', rotaNaoEncontrada);
  app.use(criarTratadorErros({ registrarErro }));

  // Rotina de 15 min (server.js): RN07 (expira pendentes e apaga a cobrança), CB03 (reembolsos que
  // falharam) e RN09 (repasses). A trava impede duas execuções ao mesmo tempo; um passo que falha
  // não impede os outros. Os testes chamam cada passo direto
  const rotinas = {
    expirarReservasPendentes: pagamentos.criarExpirarReservasPendentes({ repositorioReservas, cancelarCobrancaAberta }),
    reembolsarPendentes: pagamentos.criarReembolsarPendentes({ repositorioPagamentos, reembolsarPagamento }),
    executarRepasses: criarExecutarRepasses({ repositorioReservas, repositorioRepasses, gateway, registrarErro }),
  };
  let rotinaRodando = false;
  async function executarRotinaPagamentos() {
    if (rotinaRodando) return null;
    rotinaRodando = true;
    const resumo = {};
    try {
      for (const [nome, passo] of Object.entries(rotinas)) {
        try {
          resumo[nome] = await passo();
        } catch (erro) {
          registrarErro(erro);
          resumo[nome] = { erro: erro.message };
        }
      }
      return resumo;
    } finally {
      rotinaRodando = false;
    }
  }

  function encerrar() {
    sessao.armazem.encerrar();
  }

  return { app, encerrar, gateway, rotinas, executarRotinaPagamentos };
}

module.exports = { criarApp };
