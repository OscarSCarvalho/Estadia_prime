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

## API disponível (Etapa 2)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/saude` | Verifica se a API está no ar |
| POST | `/api/auth/cadastro` | Cria conta `{ nome, email, senha, telefone?, tipo }` e já faz login |
| POST | `/api/auth/login` | Entra `{ email, senha }` |
| POST | `/api/auth/logout` | Sai |
| GET | `/api/auth/eu` | Dados do usuário logado |

Erros sempre vêm no formato `{ "erro": { "codigo", "mensagem", "detalhes?" } }`.
