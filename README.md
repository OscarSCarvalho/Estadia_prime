# Estadia Prime

Marketplace de hospedagem de alto padrão com serviços premium acopláveis (mordomo, copeiro, empregado, motorista, barman, eventos).

**Documentação ATHOS:** [CONTEXT](CONTEXT.md) · [AI_ROLES](AI_ROLES.md) · [SPEC](SPEC.md) · [PROPOSAL](PROPOSAL.md) · [PLAN](PLAN.md)

## Requisitos
- Node.js 22.9 ou mais novo (testado no 24)

## Como rodar em desenvolvimento

São **dois terminais**, um para a API e outro para o site.

**Terminal 1: API (backend)**
```
cd backend
npm install
copy .env.example .env
npm run dev
```
A API sobe em `http://localhost:3001`. O banco é criado sozinho em `backend/data/estadia.db`.

**Terminal 2: site (frontend)**
```
cd frontend
npm install
npm run dev
```
Abra **http://localhost:5173** no navegador.

## Comandos úteis

| Onde | Comando | O que faz |
|---|---|---|
| backend | `npm test` | Roda todos os testes automáticos |
| backend | `npm run lint` | Confere a qualidade do código |
| backend | `npm run db:testar` | Testa só o banco de dados |
| backend | `npm run db:demonstracao -- <e-mail do anfitrião>` | Cadastra 12 imóveis (com fotos), serviços inclusos do anfitrião em 6 deles e 14 serviços de demonstração no banco de desenvolvimento. Pode rodar de novo: o que já existe é pulado |
| backend | `npm run db:demonstracao-avaliacoes -- <e-mail do hóspede>` | Só desenvolvimento: hóspedes fictícios avaliam a maioria dos imóveis/serviços de demonstração e a conta informada ganha uma estadia terminada ontem, pronta para avaliar. Rode depois do `db:demonstracao`. Pode rodar de novo |
| frontend | `npm run lint` | Confere a qualidade do código |
| frontend | `npm run build` | Gera a versão de produção em `frontend/dist/` |

## Pagamento (Asaas)

Por padrão o projeto usa o **gateway falso** (`GATEWAY_PAGAMENTO=falso`): nenhum dinheiro de verdade, e a tela de pagamento mostra o botão **"Simular pagamento aprovado"**. Os testes automáticos também usam o gateway falso: nenhum deles chama o Asaas.

### Teste manual no sandbox do Asaas (dinheiro de mentira, API de verdade)

> Nunca use a chave de produção no seu computador. O servidor se recusa a iniciar com a URL de produção fora de produção.

1. **Crie a conta sandbox** em https://sandbox.asaas.com (é grátis e separada da conta real).
2. **Gere a chave da API:** no sandbox, vá em *Integrações → Chaves de API* e crie uma chave. Ela começa com `$aact_hmlg_`.
3. **Abra um túnel** para o Asaas conseguir chamar o seu computador. Com o backend rodando, num terceiro terminal:
   ```
   npx cloudflared tunnel --url http://localhost:3001
   ```
   Ele mostra um endereço `https://….trycloudflare.com`. Copie esse endereço.
4. **Preencha o `backend/.env`:**
   ```
   GATEWAY_PAGAMENTO=asaas
   ASAAS_API_URL=https://api-sandbox.asaas.com/v3
   ASAAS_API_KEY=$aact_hmlg_...            (a chave do passo 2)
   ASAAS_WEBHOOK_TOKEN=...                 (32+ caracteres aleatórios, invente)
   CHAVE_CRIPTOGRAFIA=...                  (gere com o comando abaixo)
   URL_PUBLICA_SITE=https://….trycloudflare.com   (o endereço do passo 3)
   ```
   Para gerar a `CHAVE_CRIPTOGRAFIA`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
5. **Configure o webhook** no sandbox: *Integrações → Webhooks → Adicionar*.
   - URL: `https://….trycloudflare.com/api/webhooks/asaas`
   - Token de autenticação: o mesmo `ASAAS_WEBHOOK_TOKEN`
   - Versão da API: v3
   - Eventos: os de **Cobranças** (pelo menos `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`, `PAYMENT_REPROVED_BY_RISK_ANALYSIS`).
6. **Cadastre uma chave Pix** na conta sandbox (*Pix → Minhas chaves*). Sem ela, o QR do Pix é temporário.
7. Reinicie o backend (`npm run dev`). A primeira linha deve dizer `(pagamento: asaas)`.
8. **Teste o fluxo:**
   - Entre como anfitrião e faça o *Cadastro de recebimento* no painel. No sandbox a subconta é aprovada sozinha em alguns segundos; clique em *Atualizar situação*.
   - Entre como hóspede, monte o carrinho e clique em *Confirmar reserva*. Informe um CPF válido (de teste) e gere o Pix.
   - No painel do sandbox, abra a cobrança e use **"Confirmar pagamento"** (simula o Pix pago). Em poucos segundos a tela do site mostra *Pagamento confirmado*.
   - No cartão, use um cartão de teste do Asaas (veja "Cartões de teste" em docs.asaas.com).

Para voltar ao modo simulado, troque para `GATEWAY_PAGAMENTO=falso` e reinicie.


## API disponível (Etapa 2)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/saude` | Verifica se a API está no ar |
| POST | `/api/auth/cadastro` | Cria conta `{ nome, email, senha, telefone?, tipo }` e já faz login |
| POST | `/api/auth/login` | Entra `{ email, senha }` |
| POST | `/api/auth/logout` | Sai |
| GET | `/api/auth/eu` | Dados do usuário logado |

Erros sempre vêm no formato `{ "erro": { "codigo", "mensagem", "detalhes?" } }`.
