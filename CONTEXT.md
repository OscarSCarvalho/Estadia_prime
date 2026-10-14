# CONTEXT.md — Estadia Prime
**Constituição Técnica do Projeto**
**Cliente:** Estadia_ltda | **Projeto:** Estadia Prime
**Data:** 2026-10-11 | **Fase:** 0 — Análise de Demanda & Decisão de Stack
**Responsável:** Agent Software Architect (Squad Alpha)

---

## 1. Problema de negócio

Marketplace de hospedagem por temporada de **alto padrão**, parecido com o Airbnb, com um diferencial: o hóspede pode **acoplar serviços premium à estadia** (mordomo, copeiro, empregado, motorista particular, barman, eventos), tudo num único checkout.

### Os três lados do marketplace
| Perfil | O que faz | Como ganha |
|---|---|---|
| **Anfitrião** | Cadastra imóveis e fotos | Recebe a diária menos a comissão |
| **Hóspede** | Busca, monta o carrinho (imóvel + serviços), paga e avalia | — |
| **Prestador** | Cadastra os serviços que oferece por cidade | Recebe o preço do serviço menos a comissão |

**Receita da plataforma:** comissão sobre a hospedagem e sobre cada serviço, retida automaticamente via **split de pagamento**.

### Fluxo principal (caminho crítico do MVP)
Busca → imóvel → serviços acopláveis → carrinho → pagamento com split → confirmação → avaliação pós-estadia.

---

## 2. Natureza técnica da demanda (critérios 3.1)

| Critério | Análise |
|---|---|
| Natureza | Web app transacional (CRUD + busca + checkout com pagamento). Sem necessidade de tempo real nem mobile nativo no MVP |
| Requisitos não-funcionais | Volume inicial baixo (MVP de validação). O ponto crítico é **consistência**: sem reserva duplicada no mesmo período e split correto do dinheiro |
| Restrições do cliente | **Stack definida pelo cliente** (ver seção 3). Filosofia: leve, mínima complexidade, poucas dependências |
| Custo total | Stack JS de ponta a ponta. Um único processo Node e banco em arquivo, o que permite hospedar numa VPS simples |
| Manutenibilidade | Express, React, Vite e SQLite são maduros, com comunidade enorme e baixo risco de ficarem sem suporte (lock-in) |

---

## 3. Stack decidida

| Camada | Escolha | Origem |
|---|---|---|
| Backend | Node.js 24 + Express | Exigida pelo cliente |
| Banco | SQLite + better-sqlite3 (SQL puro, sem ORM) | Exigida pelo cliente |
| Frontend | React + Vite + Tailwind CSS | Exigida pelo cliente |
| Autenticação | express-session + cookie httpOnly (sem JWT) + bcrypt | Exigida pelo cliente |
| Pagamentos | Stripe Connect (ver 4.4) | Recomendada pela ATHOS, aprovada pelo cliente |

## 4. Justificativa da Stack

### 4.1 Express + better-sqlite3
- **Por que serve:** o MVP tem poucas entidades e regras claras. better-sqlite3 é **síncrono e muito rápido**, e transações (`db.transaction`) garantem a atomicidade do checkout (reserva + serviços + pagamento) sem precisar de pool de conexões.
- **Limite conhecido:** o SQLite aceita uma escrita por vez. Para o volume de um MVP isso não é problema. Se o produto escalar (centenas de reservas por minuto), migrar para PostgreSQL é direto, porque o SQL é puro e padrão.
- **Configuração obrigatória:** `journal_mode = WAL` (leitura sem bloquear escrita) e `foreign_keys = ON`, que no SQLite vem **desligado por padrão**.

### 4.2 express-session (sem JWT)
- Sessão no servidor permite **logout real** e revogação imediata, algo mais simples e seguro que JWT para um app web de domínio único.
- O store padrão (MemoryStore) **não serve para produção**: perde as sessões a cada restart e vaza memória. Na etapa 2 será usado um store em SQLite no mesmo arquivo do banco.

### 4.3 React + Vite + Tailwind
- O Vite dá build rápido e um proxy de desenvolvimento (`/api` → Express), o que evita configurar CORS com cookies.
- O Tailwind permite construir a identidade visual de alto padrão sem biblioteca de componentes pesada.

### 4.4 Pagamentos: ponto de atenção ⚠️
O checkout tem **vários recebedores numa única compra** (1 anfitrião + N prestadores + a plataforma).
- **Mercado Pago (split padrão de marketplace):** cada pagamento tem **um único vendedor** mais a comissão da plataforma. Para pagar vários recebedores, seria preciso dividir o pagamento em vários ou usar o produto avançado de repasses, que tem liberação restrita.
- **Stripe Connect ("separate charges and transfers"):** um único pagamento, depois transferências para várias contas conectadas. Atende o caso de vários recebedores de forma nativa.
- **✅ Decisão (aprovada em 2026-10-11):** Stripe Connect com contas Express para anfitriões e prestadores. Antes da Etapa 4, conferir a tabela de taxas vigente do Stripe Brasil e a disponibilidade de Pix na conta do cliente.

---

## 5. Decisões de modelagem (etapa 1 — banco)

| Decisão | Motivo |
|---|---|
| **Valores em centavos (INTEGER)** | Evita erro de arredondamento com dinheiro. R$ 1.250,00 = `125000`. Os gateways também trabalham em centavos |
| **Datas em TEXT ISO** (`YYYY-MM-DD`) | O SQLite não tem tipo data. ISO ordena e compara corretamente como texto |
| **CHECK constraints** em status, tipos, notas e datas | O banco recusa dados inválidos mesmo se a API falhar |
| **Comissão gravada por item** (`reservas.valor_comissao` e `reserva_servicos.valor_comissao`) | O split precisa saber quanto vai para cada recebedor. Se a taxa mudar no futuro, as reservas antigas mantêm o valor original |
| **Preço "congelado" na reserva** (`preco_contratado`) | Se o prestador mudar o preço depois, a reserva não muda |

### Colunas adicionadas às 8 tabelas pedidas (gaps encontrados)
| Tabela | Coluna | Motivo |
|---|---|---|
| usuarios | `conta_pagamento_id` | ID da conta do anfitrião/prestador no gateway, obrigatório para o split |
| imoveis | `tipo_imovel` | O filtro "tipo de imóvel" foi pedido, mas não havia coluna |
| servicos | `unidade_preco` | Motorista cobra por dia, barman por evento. Sem isso o preço fica ambíguo |
| reservas | `num_hospedes`, `valor_servicos`, `valor_comissao` | Validar a capacidade do imóvel, mostrar o total por partes e fazer o split |
| reserva_servicos | `data_servico`, `quantidade`, `valor_comissao` | Em que dia o serviço acontece, quantas unidades e o split |
| pagamentos | `id_externo` | ID da transação no gateway, para conciliação e webhook |
| avaliacoes | UNIQUE (reserva, autor, alvo) | Impede avaliar o mesmo imóvel/serviço duas vezes pela mesma reserva |

### Regras que ficam na aplicação (não no banco)
- **Sobreposição de reservas** no mesmo imóvel: verificada dentro de uma transação no checkout (etapa 4).
- **Prestador em duas reservas no mesmo dia:** verificado pela `data_servico`.
- **Avaliação somente após a estadia:** a reserva precisa estar `concluida`.
- **Nome de cidade padronizado ao salvar:** o `COLLATE NOCASE` do SQLite só ignora maiúsculas em letras sem acento (`búzios` = `Búzios`, mas `BÚZIOS` ≠ `Búzios`). A API vai gravar a cidade sempre no mesmo formato (sem espaços nas pontas, só a inicial maiúscula), e o frontend vai oferecer a cidade numa lista em vez de texto livre.

---

## 6. Clean Architecture aplicada ao projeto

> ✅ **Decisão aprovada pelo cliente em 2026-10-11.** A estrutura de pastas pedida originalmente (`routes/` com SQL direto) não tinha as camadas de Domínio e Aplicação exigidas pela ATHOS.

**Estrutura adotada (Clean Architecture enxuta):** mantém as pastas do cliente e acrescenta quatro:

```
backend/src/
├── dominio/        → regras puras: calcular split, validar período, erros específicos (ex: ErroEmailJaCadastrado)
├── casos_uso/      → orquestração: criarReserva, confirmarPagamento… (dependem só do domínio + interfaces)
├── repositorios/   → SQL puro com better-sqlite3 (infraestrutura)
├── adaptadores/    → mundo externo: bcrypt, store de sessão, Stripe, disco (infraestrutura)
├── db/             → schema.sql + database.js (infraestrutura)
├── routes/         → controladores Express (interfaces)
├── middleware/     → auth (interfaces)
├── config.js       → leitura e validação do .env
├── app.js          → raiz de composição: único lugar que conhece as implementações concretas
└── server.js
```

**Injeção de dependência em JavaScript:** cada caso de uso é uma *factory* que recebe suas dependências (`criarCadastrarUsuario({ repositorioUsuarios, servicoSenha })`). Nos testes unitários, elas são trocadas por dublês em memória, sem banco.

**Testes:** `node:test` nativo (zero dependências). Unitários em `test/dominio` e `test/casos_uso`; integração em `test/integracao` com HTTP real e SQLite `:memory:`.

**Por que vale a pena:** a regra mais sensível do negócio, **o cálculo do split de dinheiro**, fica num arquivo puro, testável sem banco e sem gateway. O custo são 3 pastas a mais e nenhuma dependência nova.

---

## 7. Variáveis de ambiente (`backend/.env`)

| Variável | Exemplo | Uso |
|---|---|---|
| `PORTA` | `3001` | Porta do Express |
| `CAMINHO_BANCO` | `./data/estadia.db` | Arquivo do SQLite |
| `SEGREDO_SESSAO` | (string aleatória longa) | Assinatura do cookie de sessão |
| `PASTA_UPLOADS` | `./uploads` | Pasta das fotos dos imóveis, servida em `/uploads`. Entra no backup junto com o banco |
| `COMISSAO_HOSPEDAGEM_PCT` | `12` | % da plataforma sobre a diária |
| `COMISSAO_SERVICO_PCT` | `15` | % da plataforma sobre cada serviço |
| `PERMITIR_SEM_RECEBIMENTO` | `false` | **Só desenvolvimento.** `true` mostra na busca imóveis e serviços de donos sem conta Stripe (RN13), até a Etapa 4b. O servidor se recusa a iniciar em produção com `true` |

**Migrações do banco:** `schema.sql` é a versão 0 e não muda mais. Toda alteração em tabela existente vira um arquivo `backend/src/db/migracoes/NNN_descricao.sql`, aplicado automaticamente ao abrir o banco, numa transação, com a versão guardada em `PRAGMA user_version`.
