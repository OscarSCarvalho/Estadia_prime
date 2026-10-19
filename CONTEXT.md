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
| Pagamentos | **Asaas**: cobrança única + transferências para subcontas (ver 4.4) | Trocado de Stripe Connect pelo cliente em 2026-10-19 |

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

### 4.4 Pagamentos: Asaas ✅ (decisão de 2026-10-19)
O checkout tem **vários recebedores numa única compra** (1 anfitrião + N prestadores + a plataforma).

**Histórico:** em 2026-10-11 foi aprovado o Stripe Connect ("separate charges and transfers"). Em **2026-10-19 o cliente trocou pelo Asaas**, pelos motivos abaixo:
- Pix com **taxa fixa de R$ 1,99** por cobrança, sem mensalidade;
- empresa brasileira (suporte, contrato e conta em reais);
- o Pix da Stripe no Brasil só é liberado por convite.

**Modelo "cobrança única + transferências":**
1. O hóspede paga **uma** cobrança (Pix ou cartão à vista, sem parcelamento no MVP) na conta principal (a da plataforma).
2. Anfitriões e prestadores têm uma **subconta Asaas**, criada pela API. Cada uma tem um `walletId`, guardado em `usuarios.conta_pagamento_id`.
3. **RN09:** 24h depois do check-in, a plataforma transfere para o `walletId` de cada recebedor o repasse gravado na reserva:
   - anfitrião: hospedagem + inclusos − comissões dessas partes;
   - cada prestador: subtotal dos seus itens − a comissão de cada item.
   A transferência entre contas Asaas é o `POST /v3/transfers` com `walletId`.
4. A taxa do Asaas é **absorvida pela plataforma** (sai da comissão). A taxa real (`value − netValue` do pagamento) é gravada em `pagamentos.taxa_gateway`, só para relatório.
5. Cartão: o hóspede paga na **fatura hospedada pelo Asaas** (`invoiceUrl`). O site nunca toca em dado de cartão, então fica fora do escopo PCI.

**Conferência na documentação oficial (docs.asaas.com, 2026-10-19).** O que difere ou complementa o pedido original:

| Tema | O que a documentação diz | Como ficou no projeto |
|---|---|---|
| Autenticação | Cabeçalho `access_token` e **`User-Agent` obrigatório** (contas criadas depois de 13/06/2024). Sandbox: `https://api-sandbox.asaas.com/v3`, chaves `$aact_hmlg_…` | O adaptador envia os dois cabeçalhos |
| Subconta (`POST /v3/accounts`) | Obrigatórios: `name`, `email`, `cpfCnpj`, `mobilePhone`, `incomeValue`, `address`, `addressNumber`, `province`, `postalCode`. Também `birthDate` (pessoa física) e `companyType` (empresa) | O formulário pede CPF/CNPJ, nascimento ou tipo de empresa, celular, renda mensal e endereço completo |
| apiKey da subconta | Vem **só na resposta da criação** e não pode ser recuperada depois. Precisa ficar guardada para consultar a situação da subconta | Gravada cifrada com **AES-256-GCM** (`node:crypto`, chave `CHAVE_CRIPTOGRAFIA`) em `usuarios.asaas_chave_api_cifrada`. Nunca sai pela API |
| Aprovação da subconta | Webhooks `ACCOUNT_STATUS_GENERAL_APPROVAL_{APPROVED, AWAITING_APPROVAL, PENDING, REJECTED}`, configurados **na criação da subconta** (campo `webhooks`). Consulta manual: `GET /v3/myAccount/status` com a apiKey **da subconta**. No sandbox a aprovação é automática | A subconta nasce com o nosso webhook (`authToken` = `ASAAS_WEBHOOK_TOKEN`). `GET /api/recebimento/situacao` também consulta o Asaas enquanto o cadastro não está aprovado |
| Cobrança (`POST /v3/payments`) | `customer`, `billingType` (`PIX` / `CREDIT_CARD`), `value`, `dueDate`. `externalReference` = id da reserva. QR do Pix em `GET /v3/payments/{id}/pixQrCode` (`encodedImage` + `payload`) | Como pedido |
| Pix | Para o fluxo normal, a conta precisa ter uma **chave Pix cadastrada**. Sem ela, o QR é temporário e vale até 23:59 do mesmo dia | Cadastrar a chave Pix na conta principal antes do go-live (T6.4) |
| Retorno do cartão (`callback.successUrl`) | Precisa ser um domínio público | Só é enviado quando `URL_PUBLICA_SITE` começa com `https://`. Em desenvolvimento, o hóspede volta para a aba do site sozinho |
| Cancelar cobrança | `DELETE /v3/payments/{id}`. Não é reembolso | Usado na reserva expirada e na troca Pix ↔ cartão |
| Reembolso (`POST /v3/payments/{id}/refund`) | Aceita reembolso total ou vários parciais. No Pix recém-recebido pode falhar por **falta de saldo** | Se o reembolso automático falhar, o pagamento fica `reembolso_pendente` e a rotina de 15 min tenta de novo |
| Transferência (`POST /v3/transfers`) | Corpo: `value`, `walletId` e `externalReference`. **`description` não aparece** para transferência entre contas Asaas | A identificação vai em `externalReference` = `repasse-<id>` |
| Webhook | Token no cabeçalho `asaas-access-token`. Entrega "pelo menos uma vez": guardar o `id` do evento e não reprocessar. Responder 200 | Tabela `eventos_gateway` + `401` sem token |
| Eventos tratados | `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` (pago), `PAYMENT_REFUNDED`, `PAYMENT_REPROVED_BY_RISK_ANALYSIS` e `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` (cartão recusado), `ACCOUNT_STATUS_GENERAL_APPROVAL_*` | Os outros respondem 200 e são ignorados |

**Acréscimos ao modelo pedido** (necessários para as regras fecharem):
- `pagamentos` foi **recriada** (nenhuma tabela a referencia) para o status aceitar `cancelado` (cobrança apagada) e `reembolso_pendente` (CB03 aguardando nova tentativa). Também ganhou `valor_reembolsado` e `data_criacao`.
- Há também um índice único: **uma só cobrança em aberto por reserva**.
- `reservas.hospedagem_reembolsada`, ao lado do `reembolsado` dos itens: diz se a hospedagem foi devolvida (RN10).
- `usuarios.situacao_recebimento` (`em_analise` / `pendente` / `aprovado` / `recusado`) para a tela. `recebimento_ativo` = 1 só quando aprovado (RN13).
- `repasses.ultimo_erro` guarda o motivo da última falha de transferência.

**Limitação conhecida:** o CNPJ alfanumérico (novo formato da Receita, emitido a partir de jul/2026) ainda não é aceito, porque o pedido define `cpf_cnpj` só com dígitos. Quando aparecer o primeiro anfitrião com esse CNPJ, basta uma migração mudando o CHECK e a validação em `dominio/documento.js`.

**Ambientes:** em desenvolvimento e nos testes roda o **gateway falso** (`adaptadores/gatewayFalso.js`, em memória, com a mesma interface). O sandbox do Asaas é usado só no teste manual (README). A chave de produção nunca é usada fora do servidor de produção, e o `config.js` recusa a URL de produção do Asaas fora de produção.

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
| usuarios | `conta_pagamento_id` | ID da conta do anfitrião/prestador no gateway, obrigatório para o split. Com o Asaas, guarda o `walletId` da subconta |
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
├── adaptadores/    → mundo externo: bcrypt, store de sessão, Asaas (e o gateway falso), cifra, disco (infraestrutura)
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
| `PERMITIR_SEM_RECEBIMENTO` | `false` | **Só desenvolvimento.** `true` mostra na busca imóveis e serviços de donos sem subconta Asaas aprovada (RN13). O servidor se recusa a iniciar em produção com `true` |
| `GATEWAY_PAGAMENTO` | `falso` | `falso` = gateway em memória (desenvolvimento e testes, padrão); `asaas` = API do Asaas. Em produção, `falso` é recusado |
| `ASAAS_API_URL` | `https://api-sandbox.asaas.com/v3` | Produção: `https://api.asaas.com/v3`. Fora de produção a URL de produção é recusada |
| `ASAAS_API_KEY` | `$aact_hmlg_…` (sandbox) | Chave da conta principal, enviada no cabeçalho `access_token`. Obrigatória com `GATEWAY_PAGAMENTO=asaas` |
| `ASAAS_WEBHOOK_TOKEN` | (32+ caracteres aleatórios) | Conferido no cabeçalho `asaas-access-token` de todo webhook (sem ele → 401). O mesmo valor vai no painel do Asaas e nos webhooks das subcontas |
| `CHAVE_CRIPTOGRAFIA` | (64 caracteres hex) | AES-256-GCM das apiKeys das subcontas. Gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Trocar a chave torna as apiKeys gravadas ilegíveis** |
| `URL_PUBLICA_SITE` | `http://localhost:5173` | Endereço público do site: retorno da fatura de cartão e URL do webhook das subcontas (`<URL>/api/webhooks/asaas`). Em produção precisa ser `https://` |

**Migrações do banco:** `schema.sql` é a versão 0 e não muda mais. Toda alteração em tabela existente vira um arquivo `backend/src/db/migracoes/NNN_descricao.sql`, aplicado automaticamente ao abrir o banco, numa transação, com a versão guardada em `PRAGMA user_version`.
