| ✅ || ✅ || ✅ || ✅ || ✅ || ✅ || ✅ |# PLAN.md — Estadia Prime
**Planejamento Técnico (tarefas atômicas)**
**Cliente:** Estadia_ltda | **Projeto:** Estadia Prime
**Data:** 2026-10-11 | **Fase:** 3 — Planejamento Técnico
**Responsáveis:** Squads Alpha, Beta e Delta
**Base:** `CONTEXT.md` (camadas) · `SPEC.md` (RN/CB/cenários) · `PROPOSAL.md` (aprovada em 2026-10-11)

---

## Legenda

**Camadas** (CONTEXT.md §6). A dependência sempre aponta para dentro: `interfaces → casos_uso → dominio`.
| Sigla | Pasta | Papel |
|---|---|---|
| `DOM` | `backend/src/dominio/` | Regras puras, erros específicos. Zero dependência externa |
| `UC` | `backend/src/casos_uso/` | Orquestração. Recebe repositórios e adaptadores por injeção |
| `REP` | `backend/src/repositorios/` | SQL puro com better-sqlite3 |
| `ADP` | `backend/src/adaptadores/` | Mundo externo: bcrypt, sessão, Stripe, disco |
| `INT` | `backend/src/routes/` + `middleware/` | HTTP: validação de entrada, status code, JSON |
| `INF` | `backend/src/db/`, `app.js`, `server.js`, `config.js` | Composição e configuração |
| `FE` | `frontend/src/` | React |
| `QA` | `backend/test/` | node:test (unitário + integração) |
| `OPS` | infraestrutura | Deploy, backup |

**Status:** ✅ concluída · 🔄 em andamento · ⬜ pendente

**Regra da Fase 4:** uma tarefa só é concluída com os testes passando e sem erro de lint (`npm run lint`).

---

## ETAPA 1 — Banco de dados ✅

| ID | Camada | Tarefa | Referência | Status |
|---|---|---|---|---|
| T1.1 | INF | `schema.sql`: 8 tabelas, CHECKs, índices, valores em centavos | CONTEXT §5 | ✅ |
| T1.2 | INF | `database.js`: WAL, foreign_keys, busy_timeout, schema idempotente | CONTEXT §4.1 | ✅ |
| T1.3 | QA | `scripts/testar-banco.js`: fluxo completo + 11 recusas | — | ✅ |

---

## ETAPA 2 — Base Express + Sessão + Autenticação ✅

| ID | Camada | Tarefa | Referência | Status |
|---|---|---|---|---|
| T2.1 | INF | Dependências (`express`, `express-session`, `bcryptjs`), scripts `dev/start/test/lint`, ESLint | — | ✅ |
| T2.2 | INF | `config.js`: lê e valida o `.env`. Em produção, falha ao iniciar se faltar `SEGREDO_SESSAO` | CONTEXT §7 | ✅ |
| T2.3 | INF | Tabela técnica `sessoes` no schema | CONTEXT §4.2 | ✅ |
| T2.4 | ADP | `armazemSessoesSqlite.js`: store do express-session (get/set/destroy/touch + limpeza de expiradas) | CONTEXT §4.2 | ✅ |
| T2.5 | DOM | `erros.js`: `ErroDominio` base com `codigo` + erros de dados inválidos, e-mail duplicado, credenciais, tentativas, acesso | Padrão 3.3 | ✅ |
| T2.6 | DOM | `usuario.js`: perfis válidos, `validarCadastro` (normaliza e-mail/telefone, senha 8–72, nome) | H1.1 | ✅ |
| T2.7 | REP | `repositorioUsuarios.js`: `buscarPorEmail`, `buscarPorId`, `inserir` (UNIQUE → `ErroEmailJaCadastrado`) | H1.1 | ✅ |
| T2.8 | ADP | `servicoSenhaBcrypt.js` (hash/compare, custo configurável) e `limitadorTentativasMemoria.js` | H1.2 | ✅ |
| T2.9 | UC | `cadastrarUsuario`: valida, gera hash, insere e devolve usuário público (sem hash) | Cenários "Cadastro" | ✅ |
| T2.10 | UC | `autenticarUsuario`: limite de 5 erros em 15 min, mensagem genérica, comparação mesmo com e-mail inexistente (tempo constante) | Cenários "Login" | ✅ |
| T2.11 | INT | `middleware/auth.js`: `exigirLogin`, `exigirPerfil(...perfis)` | §2 Perfis | ✅ |
| T2.12 | INT | `middleware/tratarErros.js`: mapa erro → status, JSON malformado → 400, rota inexistente → 404, erro inesperado → 500 sem vazar detalhes | — | ✅ |
| T2.13 | INT | `routes/auth.js`: `POST /cadastro`, `POST /login`, `POST /logout`, `GET /eu`. Sessão regenerada no login (anti-fixation) | H1.1, H1.2 | ✅ |
| T2.14 | INF | `app.js` (composição + cabeçalhos de segurança + cookie httpOnly/lax/secure) e `server.js` | RNF Segurança | ✅ |
| T2.15 | QA | Unitários: domínio e casos de uso com repositórios falsos (sem banco) | Padrão 3.3 | ✅ |
| T2.16 | QA | Integração: todos os cenários de "Cadastro e Login" do SPEC via HTTP real + SQLite `:memory:` | SPEC §5 | ✅ |
| T2.17 | FE | Setup Vite + React + Tailwind + React Router, proxy `/api`, fontes e identidade visual | CONTEXT §4.3 | ✅ |
| T2.18 | FE | `services/api.js` (fetch com cookie + erro padronizado) e `contexto/AuthContexto.jsx` | — | ✅ |
| T2.19 | FE | Telas: Início = vitrine pública (sem login); `/entrar` = tela de destaque (foto de casa de luxo + login) acionada só ao reservar/anunciar (RN16), com volta ao destino; Cadastro; `/anunciar` protegida; Minha Conta; Cabeçalho | H1.1, H1.2 | ✅ |
| T2.20 | QA | Lint + build do frontend sem erros; teste de ponta a ponta via proxy | — | ✅ |

---

## ETAPA 3 — Imóveis, Serviços e Busca

> **Parte 3A (T3.1–T3.10) concluída em 2026-10-12:** migrações, domínio (`cidade`, `dinheiro`, `imovel`, `servico`, `periodo`, `reserva`) e repositórios, com 46 testes novos (89 no total), lint ok. Extras: `dominio/dinheiro.js` (reais ↔ centavos, aceita "2.500,00"), `dominio/textos.js`, `repositorios/sqlComum.js` (reserva ativa, nota média e visibilidade RN13 num só lugar). Regra: `schema.sql` = versão 0 e não muda mais; toda alteração vira `db/migracoes/NNN_*.sql`.

> **Parte 3C (T3.18–T3.21) concluída em 2026-10-12:** frontend ligado à API (`services/catalogo.js`, `services/painel.js`), `catalogoExemplo.js` removido, paginação no Explorar, estados de erro com "Tentar de novo", "Novo" para quem ainda não tem avaliação, foto padrão por tipo de serviço (`public/imagens/servicos/`). Painéis: `/painel/imoveis` (lista, cadastro, edição, fotos com envio/arrastar/capa/remover, ativar/desativar) e `/painel/servicos`. Dados de demonstração: `npm run db:demonstracao -- <e-mail>` (12 imóveis na conta do anfitrião + 14 prestadores fictícios @demo.example.com). Pendente para a 4a: dias ocupados do prestador no carrinho (RN06).

> **Parte 3B (T3.11–T3.17) concluída em 2026-10-12:** upload de fotos (multer em memória → bytes conferidos → disco com nome UUID; `/uploads` com CSP `default-src 'none'`), casos de uso (`imoveisDoAnfitriao`, `fotosDoImovel`, `servicosDoPrestador`, `catalogo`), rotas e 56 testes novos (145 no total), lint ok. Endpoints: públicos `GET /api/imoveis` (filtros `cidade, checkin, checkout, hospedes, tipo, preco_min, preco_max` em reais, `servicos=a,b`, `pagina`), `GET /api/imoveis/:id`, `GET /api/imoveis/:id/disponibilidade`, `GET /api/servicos`, `GET /api/cidades`; anfitrião `/api/meus-imoveis` (CRUD, `PATCH /:id/status`, `POST /:id/fotos` multipart campo `fotos`, `PUT /:id/fotos/ordem`, `DELETE /:id/fotos/:fotoId`); prestador `/api/meus-servicos`. Nova dependência: `multer` 2.4. Nova variável: `PASTA_UPLOADS`.

| ID | Camada | Tarefa | Referência | Status |
|---|---|---|---|---|
| T3.1 | INF | Migrações versionadas (`PRAGMA user_version` + `db/migracoes/*.sql`) para alterar tabelas existentes sem perder dados | — | ✅ |
| T3.2 | INF | Migração 001: `usuarios.recebimento_ativo` (0/1). Flag `.env` `PERMITIR_SEM_RECEBIMENTO` só para desenvolvimento | RN13 | ✅ |
| T3.3 | DOM | `cidade.js`: `normalizarCidade` (trim, espaços, iniciais maiúsculas preservando acentos) | CB11 | ✅ |
| T3.4 | DOM | `imovel.js`: tipos válidos, `validarImovel`, conversão reais ↔ centavos, `ocultarEndereco` | H2.1, RN12 | ✅ |
| T3.5 | DOM | `servico.js`: tipos, unidades, `validarServico` | H3.1 | ✅ |
| T3.6 | DOM | `periodo.js`: `calcularNoites`, `validarPeriodo` (passado, máximo 30 noites), `periodosSeSobrepoem` | RN01, RN04, RN15, CB12, CB13 | ✅ |
| T3.7 | REP | `repositorioImoveis.js`: CRUD com checagem de dono, listagem do anfitrião | H2.1, H2.3 | ✅ |
| T3.8 | REP | `repositorioFotos.js`: inserir, contar, remover, reordenar | H2.2 | ✅ |
| T3.9 | REP | `repositorioServicos.js`: CRUD com checagem de dono, serviços ativos por cidade | H3.1, H5.1 | ✅ |
| T3.10 | REP | `repositorioBusca.js`: SQL da busca com filtros, disponibilidade (reservas ativas + pendentes < 30 min), RN13, paginação 20 | H4.1, H4.2, RN07 | ✅ |
| T3.11 | ADP | `armazenamentoFotosDisco.js`: multer, 5 MB, tipo real pelos bytes (JPG/PNG/WEBP), nome gerado no servidor | CB15 | ✅ |
| T3.12 | UC | `cadastrarImovel`, `editarImovel`, `alterarStatusImovel` (bloqueia com reservas futuras), `listarMeusImoveis` | H2.1, H2.3, CB06 | ✅ |
| T3.13 | UC | `adicionarFotos` (limite 10), `removerFoto`, `reordenarFotos` | H2.2 | ✅ |
| T3.14 | UC | `cadastrarServico`, `editarServico`, `alterarStatusServico`, `listarMeusServicos` | H3.1, H3.2, CB05 | ✅ |
| T3.15 | UC | `buscarImoveis`, `obterImovel` (serviços da cidade + nota média + endereço oculto), `listarCidades` | H4, H5.1 | ✅ |
| T3.16 | INT | `routes/imoveis.js`, `routes/servicos.js`, `/uploads` estático, `GET /api/cidades` | — | ✅ |
| T3.17 | QA | Unitários do domínio + integração dos cenários "Cadastro de Imóvel", "Serviço" e "Busca" | SPEC §5 | ✅ |
| T3.18 | FE | Explorar (estilo Airbnb, marca Estadia Prime): abas Imóveis/Serviços, barra de busca em pílula (destino, datas, hóspedes), faixa de categorias por tipo, diálogo de filtros (preço, serviços), grade de cards com carrossel de fotos. Filtros na URL. Ligada à API (dados de exemplo removidos) | H4.1 | ✅ |
| T3.19 | FE | Página do imóvel: galeria, detalhes, nota, serviços da cidade, cartão de reserva com datas na URL; "Reservar" pede login (RN16) e volta com as datas. Ligada à API (dados de exemplo removidos) | H5.1 | ✅ |
| T3.20 | FE | Painel do anfitrião: lista, formulário de imóvel, upload e ordenação de fotos, ativar/desativar | H2 | ✅ |
| T3.21 | FE | Painel do prestador: lista e formulário de serviços, ativar/desativar | H3 | ✅ |

---

## ETAPA 4a — Carrinho e Reserva ✅

> **Etapa 4a concluída em 2026-10-12:** domínio `precificacao.js`, `reserva.js` (transições, expiração, pedido), `cancelamento.js` (RN10, só cálculo); `repositorioReservas.js`; casos de uso `reservas.js`; rotas `POST/GET /api/reservas`, `POST /api/reservas/:id/desistir` (só pendente), `GET /api/reservas-recebidas` (anfitrião), `GET /api/agenda` (prestador), `GET /api/imoveis/:id/servicos` (dias ocupados, RN06). 22 testes novos (167 no total). Telas: `/minhas-reservas`, `/painel/reservas`, `/painel/agenda`. Sem pagamento ainda, toda reserva expira em 30 min; cancelar reserva confirmada com reembolso fica para a 4b (T4b.8).

| ID | Camada | Tarefa | Referência | Status |
|---|---|---|---|---|
| T4a.1 | DOM | `precificacao.js`: hospedagem, serviços, comissões, valores de repasse com arredondamento (a soma sempre fecha) | RN01–03, CB10 | ✅ |
| T4a.2 | DOM | `reserva.js`: transições de status válidas, expiração de 30 min, `estaAtiva` | RN07, RN08, CB04 | ✅ |
| T4a.3 | DOM | `cancelamento.js`: cálculo do reembolso por item (7 dias / 48h) | RN10 | ✅ |
| T4a.4 | REP | `repositorioReservas.js`: criar reserva + itens, conflitos do imóvel, conflitos do prestador, listagens por hóspede, anfitrião e prestador | RN04, RN06 | ✅ |
| T4a.5 | UC | `criarReserva`: recalcula tudo pelo banco, valida RN04/05/06/14/15 e grava numa única `db.transaction` | Cenários "Carrinho" | ✅ |
| T4a.6 | UC | `listarMinhasReservas`, `listarReservasDoAnfitriao`, `agendaDoPrestador` | H2.4, H3.3 | ✅ |
| T4a.7 | INT | `routes/reservas.js` | — | ✅ |
| T4a.8 | QA | Unitários de precificação, cancelamento e transições + integração com disputa de datas | CB01, CB02 | ✅ |
| T4a.9 | FE | Carrinho `/imoveis/:id/carrinho` (protegido; "Reservar" leva até ele): serviços da cidade com dia (check-in a check-out, dias ocupados do prestador bloqueados) + quantidade (1–10, mesmo serviço no mesmo dia soma), resumo hospedagem/serviços/total, salvo na aba (`services/carrinhoSalvo.js`). Regras em `utils/carrinho.js`. Ligado à API: "Confirmar reserva" cria a reserva pendente; recusas (prestador contratado, serviço desativado, datas tomadas) atualizam o carrinho na hora | H5.2, H5.3, RN05, RN06, RN14, RN15 | ✅ |
| T4a.10 | FE | "Minhas reservas", "Reservas dos meus imóveis", "Minha agenda" | H2.4, H3.3 | ✅ |

## ETAPA 4b — Stripe Connect (Pagamento com Split)

> **Ordem definida pelo cliente em 2026-10-12:** o pagamento é a **última** etapa de desenvolvimento, executada depois da Etapa 5 e antes do deploy (Etapa 6).

| ID | Camada | Tarefa | Referência | Status |
|---|---|---|---|---|
| T4b.1 | OPS | Conferir taxas vigentes do Stripe BR e Pix na conta do cliente; chaves de teste no `.env` | PROPOSAL §4.3 | ⬜ |
| T4b.2 | INF | Migração 002: `pagamentos.id_evento_processado`, `reservas.repasse_em`, `reserva_servicos.reembolsado` | CB04, RN09 | ⬜ |
| T4b.3 | ADP | `gatewayStripe.js`: conta Express, link de cadastro, PaymentIntent, transfer, refund, verificação de assinatura do webhook | — | ⬜ |
| T4b.4 | UC | `iniciarCadastroRecebimento`, `atualizarRecebimento` (webhook `account.updated`) | H1.3, RN13 | ⬜ |
| T4b.5 | UC | `iniciarPagamento` (cartão/Pix) | H6.1 | ⬜ |
| T4b.6 | UC | `processarEventoPagamento`: idempotente, confirma reserva, trata pagamento após expiração | RN08, CB03, CB04 | ⬜ |
| T4b.7 | UC | `executarRepasses`: transfers 24h após o check-in (rotina a cada 15 min) | RN09, H6.2 | ⬜ |
| T4b.8 | UC | `cancelarReserva`: reembolso parcial/integral via gateway + liberação de datas | RN10, H6.3 | ⬜ |
| T4b.9 | INT | `routes/pagamentos.js` + webhook com `express.raw` | — | ⬜ |
| T4b.10 | QA | Integração com gateway falso (todas as transições) + teste manual no modo de teste do Stripe | Cenários "Pagamento" e "Cancelamento" | ⬜ |
| T4b.11 | FE | Checkout com Stripe Elements, tela de confirmação, botão "Cadastrar recebimento" nos painéis | H6.1, H1.3 | ⬜ |

---

## ETAPA 5 — Avaliações, Painéis e Acabamento

| ID | Camada | Tarefa | Referência | Status |
|---|---|---|---|---|
| T5.1 | DOM | `avaliacao.js`: concluída, prazo de 14 dias, alvo pertence à reserva | RN11 | ✅ |
| T5.2 | UC | `concluirReservasVencidas` (na leitura, sem cron), `avaliar`, `listarAvaliacoes` | H7.1, H7.2 | ✅ |
| T5.3 | REP/INT | `repositorioAvaliacoes.js` + `routes/avaliacoes.js` | — | ✅ |
| T5.4 | QA | Cenários "Avaliações" do SPEC | SPEC §5 | ✅ |
| T5.5 | FE | Formulário de avaliação em "Minhas reservas"; notas e comentários na página do imóvel e no prestador | H7 | ✅ |
| T5.6 | FE | Acabamento visual de alto padrão, estados vazio/carregando/erro, responsividade e acessibilidade AA | RNF | ⬜ |

> **T5.1–T5.5 concluídas em 2026-10-13 (182 testes backend, lint e build ok).** Reserva `confirmada` vira `concluida` no dia seguinte ao checkout (o dia do checkout ainda é da estadia, pode ter serviço — RN05), aplicado em toda leitura de reservas e antes de avaliar. API: `POST /api/reservas/:id/avaliacoes` (hóspede), `GET /api/imoveis/:id/avaliacoes` e `GET /api/servicos/:id/avaliacoes` (públicas, 10 por página, só o primeiro nome do autor). Erros: 422 antes do checkout / prazo encerrado / reserva cancelada / alvo fora da reserva; 409 repetida (garantida também pela UNIQUE do banco). Telas: formulário com estrelas em "Minhas reservas", seção "Avaliações dos hóspedes" na página do imóvel e janela com as avaliações de cada prestador. Como não há pagamento ainda, `npm run db:demonstracao-avaliacoes -- <e-mail do hóspede>` grava estadias passadas e avaliações fictícias para demonstração.

## ETAPA 6 — Validação e Deploy (`VALIDATE.md`)

| ID | Camada | Tarefa | Referência | Status |
|---|---|---|---|---|
| T6.1 | QA | E2E Playwright do fluxo principal do hóspede (busca → pagamento de teste → avaliação) | SPEC §1 | ⬜ |
| T6.2 | OPS | VPS: Node 24 + PM2, Nginx (frontend estático + proxy `/api`), HTTPS Let's Encrypt, `trust proxy` | RNF | ⬜ |
| T6.3 | OPS | Backup diário do SQLite (`.backup` online) com retenção de 7 dias + cópia externa | RNF | ⬜ |
| T6.4 | OPS | Webhook do Stripe apontando para produção + troca para as chaves reais | — | ⬜ |
| T6.5 | QA | `VALIDATE.md`: matriz SPEC × testes, resultado e checklist de go-live | Fase 5 | ⬜ |
