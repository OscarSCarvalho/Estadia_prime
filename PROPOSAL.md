# PROPOSAL.md — Estadia Prime
**Proposta Comercial**
**Cliente:** Estadia_ltda | **Projeto:** Estadia Prime
**Data:** 2026-10-11 | **Status:** ✅ APROVADA pelo cliente em 2026-10-11 | **Fase:** 2 — Comercial & Precificação
**Responsáveis:** Squad Omega (Tech Estimator & Pricing + Account Executive)
**Base:** `CONTEXT.md` (stack) e `SPEC.md` (escopo)

---

## 1. RESUMO EXECUTIVO

Construção do MVP do **Estadia Prime**, um marketplace de hospedagem de alto padrão em que o hóspede reserva o imóvel e contrata serviços premium (mordomo, copeiro, empregado, motorista, barman, eventos) num único pagamento. A comissão da plataforma é retida automaticamente via split.

A stack é leve (Node.js + Express + SQLite + React), escolhida pelo cliente e validada pela ATHOS. Ela permite rodar tudo num único servidor de baixo custo mensal, com caminho claro de migração para PostgreSQL quando o volume crescer.

**Investimento:** R$ 59.000 | **Prazo:** 7 semanas | **Infra:** a partir de ~R$ 150/mês

---

## 2. ESCOPO DO MVP

### Incluído
- ✅ Cadastro e login com sessão para os 3 perfis (anfitrião, hóspede e prestador)
- ✅ Cadastro de recebimento do anfitrião e do prestador no Stripe Connect
- ✅ Cadastro de imóveis com até 10 fotos e ativação/desativação
- ✅ Cadastro de serviços premium pelo prestador (6 tipos; preço por hora, diária ou evento)
- ✅ Busca com filtros: cidade, datas livres, hóspedes, faixa de preço, tipo de imóvel e serviços disponíveis
- ✅ Página do imóvel com os serviços acopláveis da cidade e nota média
- ✅ Carrinho único (imóvel + serviços) com cálculo do total no servidor
- ✅ Pagamento por cartão e Pix com split automático (anfitrião + N prestadores + plataforma)
- ✅ Repasse retido até 24h após o check-in
- ✅ Cancelamento com reembolso conforme a política do MVP
- ✅ Avaliações de imóveis e serviços após a estadia
- ✅ Painéis: "Minhas reservas" (hóspede), "Meus imóveis e reservas" (anfitrião) e "Minha agenda" (prestador)
- ✅ Testes automatizados, deploy com HTTPS e backup diário

### Não incluído no MVP (fases futuras)
- ❌ Painel administrativo (no MVP, disputas são resolvidas pelo painel do Stripe)
- ❌ Notificações por e-mail ou WhatsApp
- ❌ Chat entre as partes
- ❌ Calendário do anfitrião e sincronização com Airbnb/Booking (iCal)
- ❌ Preço por temporada, taxa de limpeza e cupons
- ❌ App mobile nativo e vários idiomas

---

## 3. ESTIMATIVA DE HORAS

### 3.1 Artefatos e Planejamento
| Atividade | Horas |
|---|---|
| Fase 0: CONTEXT.md (análise + stack) | 4h |
| Fase 1: SPEC.md (BDD + casos de borda) | 6h |
| Fase 2: PROPOSAL.md | 2h |
| Fase 3: PLAN.md (quebra em tarefas) | 4h |
| **Subtotal Artefatos** | **16h** |

### 3.2 Implementação (Squad Beta)
| Etapa | Entregável | Backend | Frontend | Total |
|---|---|---|---|---|
| 1 | Banco: schema + conexão + teste *(✅ já entregue)* | 6h | — | 6h |
| 2 | Base Express + camadas + sessão + auth (3 perfis) + limite de tentativas de login | 14h | 10h | 24h |
| 3 | Imóveis + upload de fotos + serviços + busca com filtros | 24h | 22h | 46h |
| 4a | Carrinho + criação de reserva atômica + regras de disponibilidade | 16h | 14h | 30h |
| 4b | Stripe Connect: cadastro de recebimento, pagamento, webhook, split, repasse retido e reembolso | 26h | 10h | 36h |
| 5 | Avaliações + painéis do hóspede, anfitrião e prestador + acabamento visual de alto padrão | 8h | 24h | 32h |
| **Subtotal Implementação** | | **94h** | **80h** | **174h** |

### 3.3 QA e DevOps (Squads Gamma + Delta)
| Atividade | Horas |
|---|---|
| Testes unitários do domínio (split, períodos, cancelamento) | 10h |
| Testes de integração das rotas (SQLite em memória) | 14h |
| Teste E2E do fluxo principal do hóspede (Playwright) | 6h |
| VPS + Nginx + HTTPS + PM2 + backup diário do SQLite | 10h |
| **Subtotal QA + DevOps** | **40h** |

### 3.4 TOTAL GERAL
| Categoria | Horas |
|---|---|
| Artefatos e Planejamento | 16h |
| Implementação (Backend + Frontend) | 174h |
| QA e DevOps | 40h |
| **TOTAL** | **230h** |

> **Margem de risco:** a parte com mais incerteza é a 4b (Stripe Connect no Brasil). As horas já incluem 20% de folga nessa etapa.

---

## 4. INVESTIMENTO

### 4.1 Desenvolvimento
| Item | Horas | Taxa/hora | Valor |
|---|---|---|---|
| Artefatos + Planejamento | 16h | R$ 200 | R$ 3.200 |
| Backend Sênior (Node/Express) | 94h | R$ 280 | R$ 26.320 |
| Frontend Sênior (React) | 80h | R$ 260 | R$ 20.800 |
| QA Sênior | 30h | R$ 240 | R$ 7.200 |
| DevOps/SRE | 10h | R$ 260 | R$ 2.600 |
| **Total Desenvolvimento** | **230h** | — | **R$ 60.120** |
| Desconto de fechamento (stack leve, sem infraestrutura complexa) | | | − R$ 1.120 |
| **Valor final** | | | **R$ 59.000** |

### 4.2 Infraestrutura (mensal, após o deploy)
| Serviço | Plano | Custo/mês |
|---|---|---|
| VPS (2 vCPU, 8 GB, SSD), ex.: Hostinger KVM 2 | Única máquina: API + frontend + SQLite | ~R$ 60–100 |
| Domínio .com.br | Anual (R$ 40/ano) | ~R$ 4 |
| HTTPS | Let's Encrypt | R$ 0 |
| Backup externo do banco (armazenamento de objetos) | < 5 GB | ~R$ 10–30 |
| Monitoramento de disponibilidade (UptimeRobot) | Gratuito | R$ 0 |
| **Total infra** | | **~R$ 75–135/mês** |

### 4.3 Custos do gateway (Stripe) ⚠️ ponto de atenção comercial
No modelo usado ("separate charges and transfers"), **as taxas do Stripe são pagas pela plataforma** e saem da comissão. Valores aproximados, **a confirmar na tabela vigente do Stripe Brasil** antes da Etapa 4:
| Item | Referência aproximada |
|---|---|
| Cartão de crédito nacional | ~3,99% + R$ 0,39 por transação |
| Pix | ~1,2% por transação |
| Contas conectadas (anfitriões e prestadores) | cobrança mensal por conta ativa + pequena taxa por repasse |

---

## 5. ROI: SIMULAÇÃO DA PLATAFORMA

**Reserva típica** (Villa em Búzios, 3 noites + mordomo por 2 diárias):
| Item | Valor |
|---|---|
| Hospedagem (3 × R$ 2.500) | R$ 7.500 |
| Serviços (2 × R$ 800) | R$ 1.600 |
| **Total pago pelo hóspede** | **R$ 9.100** |
| Comissão da plataforma (12% + 15%) | R$ 1.140 |
| (−) Taxa do Stripe no cartão (~4%) | − R$ 364 |
| **Receita líquida por reserva** | **≈ R$ 776** |

| Cenário | Reservas/mês | Receita líquida/mês | Retorno do investimento |
|---|---|---|---|
| Conservador | 10 | ≈ R$ 7.760 | ~8 meses |
| Base | 25 | ≈ R$ 19.400 | ~3 meses |
| Otimista | 60 | ≈ R$ 46.560 | ~6 semanas |

> **Ponto de equilíbrio do desenvolvimento:** ≈ **76 reservas** no total.
> **Recomendação da Squad Omega:** começar com **1 ou 2 cidades-piloto** (ex.: Búzios e Trancoso) e garantir pelo menos 3 prestadores por tipo de serviço antes de abrir para hóspedes. Num marketplace, a oferta vem antes da demanda.

---

## 6. CRONOGRAMA DE ENTREGAS

| Semana | Entrega | Você testa |
|---|---|---|
| 0 | ✅ Fase 0, SPEC, PROPOSAL e Etapa 1 (banco) | `npm run db:testar` |
| 1 | PLAN.md + Etapa 2 (auth) | Cadastro, login e logout pelo navegador |
| 2–3 | Etapa 3 (imóveis, serviços, busca) | Cadastrar imóvel com fotos, serviço e buscar |
| 4–5 | Etapa 4 (carrinho, Stripe, split) | Reserva completa no **modo de teste** do Stripe (cartão fictício) |
| 6 | Etapa 5 (avaliações, painéis, visual) | Fluxo completo dos 3 perfis |
| 7 | Testes + deploy em produção | Site no ar com HTTPS |

Cada etapa é entregue funcionando, para você testar antes da próxima, como você pediu.

---

## 7. MODELO DE PAGAMENTO SUGERIDO

| Marco | % | Valor |
|---|---|---|
| Aprovação desta proposta | 30% | R$ 17.700 |
| Entrega da Etapa 3 (busca funcionando) | 30% | R$ 17.700 |
| Deploy em produção (Etapa 5 + testes) | 40% | R$ 23.600 |

---

## 8. CONDIÇÕES GERAIS

- **Pré-requisitos do cliente:** conta Stripe Brasil da empresa (CNPJ) com Connect ativado, domínio registrado e acesso à VPS.
- **Validação jurídica:** termos de uso, política de cancelamento e política de privacidade (LGPD) são responsabilidade do cliente. A ATHOS implementa as regras definidas.
- **Confirmado no aceite (2026-10-11):** RN09 (repasse 24h após o check-in), RN10 (política de cancelamento) e as comissões de 12% e 15% (SPEC.md §4).
- **Mudanças de escopo** fora da seção 2 são orçadas à parte, pela mesma taxa/hora.
- **Garantia:** 30 dias de correção de defeitos após o deploy, sem custo.
- **Código-fonte:** propriedade do cliente após a quitação.

---

## 9. PRÓXIMO PASSO

✅ **Proposta aprovada em 2026-10-11. Desenvolvimento liberado.**

Depois do aceite, a Squad Alpha gera o `PLAN.md` (Fase 3) e a Squad Beta inicia a **Etapa 2: Base Express + sessão + autenticação**.
