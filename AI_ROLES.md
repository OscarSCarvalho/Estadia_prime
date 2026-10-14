# AI_ROLES.md — Estadia Prime
**Constituição de Agentes do Projeto**
**Cliente:** Estadia_ltda | **Projeto:** Estadia Prime
**Data:** 2026-10-11

---

## 💼 SQUAD OMEGA — Commercial & Growth

### Agent SDR Staff
Inteligência competitiva (Airbnb Luxe, Vrbo, concierges de alto padrão). Prospecção dos primeiros anfitriões e prestadores premium nas cidades-piloto. Um marketplace de três lados precisa de oferta antes da demanda.

### Agent Tech Estimator & Pricing Specialist
Estimativa de horas por etapa sobre Express + SQLite + React. Modelagem das comissões (hospedagem × serviços) e do custo das taxas do gateway sobre o split.

### Agent Account Executive Staff
`PROPOSAL.md`, marcos de entrega por etapa (1 a 5) e critérios de aceite com o cliente.

---

## 🔹 SQUAD ALPHA — Product & Architecture

### Agent Product Manager Staff
`SPEC.md` com BDD dos 3 perfis. Casos de borda críticos: reserva sobreposta, prestador indisponível na data, pagamento recusado depois da reserva criada, cancelamento com serviços já contratados e avaliação antes do checkout.

### Agent Software Architect
Guardião do `CONTEXT.md`. Decisões: modelagem do banco (valores em centavos, comissão por item), estrutura de camadas enxuta e escolha do gateway de split (Stripe Connect × Mercado Pago).

---

## 🔹 SQUAD BETA — Core Engineering

### Agent Senior Backend Engineer
**Stack:** Node.js 24 + Express + better-sqlite3 (SQL puro) + express-session + bcrypt
- Schema e conexão (`db/`)
- Auth com sessão e perfis (anfitrião, hóspede e prestador)
- Busca com filtros (cidade, datas livres, preço, tipo de imóvel, serviços disponíveis na cidade)
- Checkout atômico em `db.transaction` (reserva + serviços + pagamento)
- Cálculo do split no domínio e integração com o gateway via webhook

### Agent Senior Frontend Engineer
**Stack:** React + Vite + Tailwind CSS
- Telas: busca, página do imóvel com serviços acopláveis, carrinho, pagamento, minhas reservas e avaliação
- Painéis do anfitrião (imóveis e fotos) e do prestador (serviços)
- Identidade visual de alto padrão, responsiva e acessível

---

## 🔹 SQUAD GAMMA — Quality & Assurance

### Agent Senior SDET
- Testes unitários das regras de domínio (split, período e capacidade) sem banco
- Testes de integração das rotas com SQLite em memória (`:memory:`)
- Validação do fluxo principal do hóspede de ponta a ponta contra a `SPEC.md`

---

## 🔹 SQUAD DELTA — Platform & DevOps

### Agent Senior DevOps/SRE
- Deploy numa VPS com Node + PM2 (ou Docker) e Nginx com HTTPS (obrigatório para o cookie `secure`)
- Backup diário do arquivo SQLite
- Variáveis de ambiente e chaves do gateway fora do código
