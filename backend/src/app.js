const express = require('express');

const { criarRepositorioUsuarios } = require('./repositorios/repositorioUsuarios');
const { criarRepositorioImoveis } = require('./repositorios/repositorioImoveis');
const { criarRepositorioFotos } = require('./repositorios/repositorioFotos');
const { criarRepositorioServicos } = require('./repositorios/repositorioServicos');
const { criarRepositorioBusca } = require('./repositorios/repositorioBusca');
const { criarRepositorioReservas } = require('./repositorios/repositorioReservas');
const { criarRepositorioAvaliacoes } = require('./repositorios/repositorioAvaliacoes');
const { criarRepositorioServicosInclusos } = require('./repositorios/repositorioServicosInclusos');
const { criarServicoSenhaBcrypt } = require('./adaptadores/servicoSenhaBcrypt');
const { criarLimitadorTentativasMemoria } = require('./adaptadores/limitadorTentativasMemoria');
const { criarArmazenamentoFotosDisco } = require('./adaptadores/armazenamentoFotosDisco');
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
const { criarMiddlewareSessao } = require('./middleware/sessao');
const { cabecalhosSeguranca, semCache } = require('./middleware/seguranca');
const { criarTratadorErros, rotaNaoEncontrada } = require('./middleware/tratarErros');
const { criarRotasAuth } = require('./routes/auth');
const { criarRotasImoveis, criarRotasMeusImoveis } = require('./routes/imoveis');
const { criarRotasServicos, criarRotasMeusServicos } = require('./routes/servicos');
const { criarRotasCidades } = require('./routes/cidades');
const { criarRotasReservas, criarRotasReservasRecebidas, criarRotasAgenda } = require('./routes/reservas');
const { criarRotasAvaliacoes } = require('./routes/avaliacoes');

// Raiz de composição: único ponto que conhece as implementações concretas e as injeta nos casos de uso
function criarApp({ db, config, registrarErro = console.error }) {
  // RN13: em produção só aparece na busca quem tem recebimento ativo no Stripe
  const visibilidade = { exigirRecebimento: !config.permitirSemRecebimento };

  const repositorioUsuarios = criarRepositorioUsuarios(db);
  const repositorioImoveis = criarRepositorioImoveis(db);
  const repositorioFotos = criarRepositorioFotos(db);
  const repositorioServicos = criarRepositorioServicos(db, visibilidade);
  const repositorioBusca = criarRepositorioBusca(db, visibilidade);
  const repositorioReservas = criarRepositorioReservas(db, visibilidade);
  const repositorioAvaliacoes = criarRepositorioAvaliacoes(db);
  const repositorioServicosInclusos = criarRepositorioServicosInclusos(db);
  // CB09: a comissão vale para novas reservas; as antigas guardam o valor gravado
  const comissoes = { comissaoHospedagemPct: config.comissaoHospedagemPct, comissaoServicoPct: config.comissaoServicoPct };
  const servicoSenha = criarServicoSenhaBcrypt({ custo: config.custoHashSenha });
  const limitadorTentativas = criarLimitadorTentativasMemoria();
  const armazenamentoFotos = criarArmazenamentoFotosDisco({ pasta: config.pastaUploads });
  const concluirReservasVencidas = avaliacoes.criarConcluirReservasVencidas({ repositorioReservas });

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
    listarReservasDoAnfitriao: reservas.criarListarReservasDoAnfitriao({ repositorioReservas, concluirReservasVencidas }),
    agendaDoPrestador: reservas.criarAgendaDoPrestador({ repositorioReservas, concluirReservasVencidas }),
    desistirDaReserva: reservas.criarDesistirDaReserva({ repositorioReservas }),

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

  app.use('/api', rotaNaoEncontrada);
  app.use(criarTratadorErros({ registrarErro }));

  function encerrar() {
    sessao.armazem.encerrar();
  }

  return { app, encerrar };
}

module.exports = { criarApp };
