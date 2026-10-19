# SPEC.md — Estadia Prime
**Especificação Funcional (BDD)**
**Cliente:** Estadia_ltda | **Projeto:** Estadia Prime
**Data:** 2026-10-11 | **Fase:** 1 — Especificação
**Responsável:** Agent Product Manager Staff (Squad Alpha)
**Base técnica:** `CONTEXT.md`

---

## 1. OBJETIVO DO PRODUTO

Permitir que um hóspede de alto padrão **reserve um imóvel de temporada e contrate serviços premium para a estadia num único pagamento**. A plataforma divide o dinheiro automaticamente entre o anfitrião, os prestadores e a própria plataforma (comissão).

**Métrica de sucesso do MVP:** % de reservas que incluem pelo menos 1 serviço premium (a "taxa de acoplamento"). É ela que prova o diferencial frente ao Airbnb.

---

## 2. PERSONAS & PERFIS DE ACESSO

| Perfil | Quem é | Pode | Não pode |
|---|---|---|---|
| **Visitante** | Sem login | Buscar imóveis, ver página do imóvel e serviços | Reservar, avaliar |
| **Hóspede** | Viajante de alto padrão | Reservar, contratar serviços, pagar, cancelar, avaliar | Cadastrar imóvel ou serviço |
| **Anfitrião** | Dono/gestor do imóvel | Cadastrar e editar imóveis e fotos, ver reservas dos seus imóveis | Reservar, cadastrar serviço |
| **Prestador** | Mordomo, motorista, barman… | Cadastrar e editar serviços, ver agenda de contratações | Reservar, cadastrar imóvel |

> Cada conta tem **um único perfil**, escolhido no cadastro. Quem é anfitrião e também quer viajar cria uma segunda conta (limitação aceita no MVP).

**Perfil Administrador:** fora do MVP. Disputas e estornos manuais são feitos pelo painel do Stripe.

---

## 3. ÉPICOS E HISTÓRIAS DE USUÁRIO

### ÉPICO 1 — Contas e Acesso
- **H1.1** Como visitante, quero me cadastrar escolhendo meu perfil, para usar a plataforma.
- **H1.2** Como usuário, quero entrar e sair com e-mail e senha, e continuar logado ao reabrir o navegador.
- **H1.3** Como anfitrião ou prestador, quero conectar minha conta de recebimento (Stripe), para receber meus repasses.

### ÉPICO 2 — Imóveis (Anfitrião)
- **H2.1** Como anfitrião, quero cadastrar um imóvel com título, descrição, tipo, endereço, diária, capacidade e quartos.
- **H2.2** Como anfitrião, quero enviar e ordenar até 10 fotos do imóvel.
- **H2.3** Como anfitrião, quero ativar ou desativar um imóvel sem apagá-lo.
- **H2.4** Como anfitrião, quero ver as reservas dos meus imóveis.
- **H2.5** Como anfitrião, quero oferecer serviços próprios no imóvel (caseiro, limpeza diária, café da manhã, enxoval, lenha, piscineiro), opcionais para o hóspede. *(incluída em 2026-10-19)*

### ÉPICO 3 — Serviços Premium (Prestador)
- **H3.1** Como prestador, quero cadastrar um serviço (tipo, descrição, preço, unidade de preço e cidade de atuação).
- **H3.2** Como prestador, quero ativar ou desativar um serviço.
- **H3.3** Como prestador, quero ver minha agenda de serviços contratados por data.

### ÉPICO 4 — Busca
- **H4.1** Como hóspede, quero buscar por cidade, datas, número de hóspedes, faixa de preço, tipo de imóvel e serviços disponíveis.
- **H4.2** Como hóspede, quero ver só imóveis **livres** nas datas escolhidas.

### ÉPICO 5 — Página do Imóvel e Carrinho (Core)
- **H5.1** Como hóspede, quero ver fotos, detalhes, nota média e os **serviços premium disponíveis na cidade do imóvel**.
- **H5.2** Como hóspede, quero adicionar serviços ao carrinho escolhendo o dia e a quantidade de cada um.
- **H5.3** Como hóspede, quero ver o total separado em hospedagem, serviços inclusos e serviços premium antes de pagar.
- **H5.4** Como hóspede, quero receber os serviços inclusos do anfitrião já marcados no carrinho e poder retirar os que não quiser.

### ÉPICO 6 — Pagamento com Split (Core)
- **H6.1** Como hóspede, quero pagar tudo de uma vez (cartão de crédito ou Pix).
- **H6.2** Como plataforma, quero reter minha comissão e repassar o restante ao anfitrião e a cada prestador.
- **H6.3** Como hóspede, quero cancelar a reserva e receber o reembolso conforme a política.

### ÉPICO 7 — Avaliações
- **H7.1** Como hóspede, quero avaliar o imóvel e cada serviço contratado (nota de 1 a 5 e comentário) após a estadia.
- **H7.2** Como visitante, quero ver a nota média e os comentários de imóveis e prestadores.

---

## 4. REGRAS DE NEGÓCIO

| # | Regra |
|---|---|
| RN01 | Valor da hospedagem = **nº de noites × diária**. Nº de noites = checkout − checkin. Mínimo de 1 noite. |
| RN02 | Valor de cada serviço = **preço × quantidade**. O preço fica congelado no momento da reserva. |
| RN03 | Comissão da plataforma: **12% sobre a hospedagem** e **15% sobre cada serviço** (configurável no `.env`). Arredondamento: sempre para baixo no centavo do repasse e o centavo restante fica com a plataforma. |
| RN04 | Um imóvel não pode ter duas reservas **ativas** (`pendente` dentro do prazo ou `confirmada`) com períodos que se sobrepõem. O dia do checkout pode ser o checkin de outra reserva. |
| RN05 | Um serviço só pode ser acoplado se a **cidade de atuação = cidade do imóvel**, se estiver ativo e se a `data_servico` estiver entre o checkin e o checkout (inclusive). |
| RN06 | Um prestador não pode ter o mesmo serviço contratado **duas vezes no mesmo dia** em reservas ativas. |
| RN07 | Reserva `pendente` sem pagamento aprovado em **30 minutos** expira (vira `cancelada`) e libera as datas e os prestadores. |
| RN08 | Reserva vira `confirmada` **somente** quando o gateway confirma o pagamento via webhook, nunca pela tela de retorno. |
| RN09 | **Repasse retido até o check-in:** o dinheiro do anfitrião e dos prestadores é transferido 24h após o check-in. Isso protege o hóspede de imóvel diferente do anunciado ou de serviço não prestado. *(✅ aprovada em 2026-10-11)* |
| RN10 | **Política de cancelamento do MVP:** até 7 dias antes do check-in, reembolso integral. Com menos de 7 dias, reembolso só dos serviços, se faltarem mais de 48h para a data de cada serviço. A hospedagem não é reembolsada. *(✅ aprovada em 2026-10-11)* |
| RN11 | Reserva vira `concluida` automaticamente depois da data de checkout. A avaliação só é permitida em reserva `concluida`, pelo próprio hóspede, em até **14 dias** após o checkout. |
| RN12 | O **endereço completo** do imóvel só aparece para o hóspede com reserva confirmada. Antes disso, aparecem apenas cidade e estado. |
| RN13 | Imóvel e serviço só aparecem na busca se estiverem `ativo` **e** o dono tiver concluído o cadastro de recebimento no Stripe. Imóvel precisa de pelo menos 1 foto. |
| RN14 | Número de hóspedes da reserva ≤ capacidade (`num_hospedes`) do imóvel. |
| RN15 | Check-in não pode ser no passado. Período máximo de uma reserva: 30 noites. |
| RN16 | **Navegação livre, login só na ação.** O visitante vê sem login a vitrine, a busca, a página do imóvel, as fotos e os serviços. O login (tela de destaque `/entrar`) só é pedido ao **reservar/negociar** ou **anunciar um imóvel**. Depois do login ou do cadastro, a pessoa volta exatamente para a ação que estava fazendo. *(definida pelo cliente em 2026-10-11)* |
| RN17 | **Serviços inclusos do anfitrião.** Cada imóvel pode ter de 0 a 15 serviços inclusos, cadastrados pelo próprio anfitrião: nome (3–60 caracteres), descrição opcional (até 300), preço > 0 e unidade de cobrança `estadia` (valor fixo), `noite` (preço × noites) ou `hospede` (preço × nº de hóspedes). O anfitrião pode editar, ativar/desativar, ordenar e remover (remover só se nunca foi contratado; senão, desativa). *(2026-10-19)* |
| RN18 | No carrinho, todos os inclusos **ativos** vêm marcados e o hóspede pode desmarcar qualquer um. O pedido de reserva envia a lista de ids que o hóspede **manteve** (sem a lista, nenhum incluso entra). O backend recalcula tudo pelo banco e congela nome e preço na reserva (`reserva_inclusos`). *(2026-10-19)* |
| RN19 | Comissão da plataforma sobre os inclusos = `COMISSAO_HOSPEDAGEM_PCT` (12%), com o arredondamento da RN03 (por linha). O repasse dos inclusos vai para o anfitrião junto com a hospedagem. *(2026-10-19)* |
| RN20 | No cancelamento (RN10), os inclusos seguem a regra da **hospedagem**: reembolso integral só até 7 dias antes do check-in. *(2026-10-19)* |
| RN21 | Incluso inativo, de outro imóvel ou inexistente enviado no pedido → erro 422 e nada é gravado. *(2026-10-19)* |

---

## 5. ESPECIFICAÇÕES BDD — CENÁRIOS DETALHADOS

### FEATURE: Cadastro e Login

```gherkin
Cenário: Cadastro com sucesso
  Dado que sou um visitante
  Quando envio nome, e-mail "ana@x.com", senha com 8+ caracteres e perfil "anfitriao"
  Então minha conta é criada com a senha guardada como hash (bcrypt)
  E já fico logado (cookie de sessão httpOnly)

Cenário: E-mail já cadastrado
  Dado que existe uma conta com "ana@x.com"
  Quando tento me cadastrar com "ANA@x.com"
  Então recebo erro 409 "E-mail já cadastrado"

Cenário: Senha errada
  Quando tento entrar com a senha incorreta
  Então recebo erro 401 "E-mail ou senha inválidos"
  E a mensagem não revela se o e-mail existe

Cenário: Muitas tentativas de login
  Dado que errei a senha 5 vezes em 15 minutos
  Quando tento novamente
  Então recebo erro 429 e preciso aguardar

Cenário: Sessão persiste
  Dado que estou logado
  Quando fecho e reabro o navegador dentro de 7 dias
  Então continuo logado

Cenário: Logout
  Quando saio da conta
  Então a sessão é destruída no servidor e o cookie deixa de valer
```

### FEATURE: Cadastro de Imóvel

```gherkin
Cenário: Anfitrião cadastra imóvel
  Dado que estou logado como anfitrião
  Quando envio título, tipo "villa", endereço, cidade "Búzios", estado "RJ", diária R$ 2.500,00, 8 hóspedes e 4 quartos
  Então o imóvel é criado com status "ativo"
  E a diária é gravada como 250000 centavos

Cenário: Envio de fotos
  Dado que tenho um imóvel cadastrado
  Quando envio 3 fotos JPG de até 5 MB
  Então as fotos são salvas na ordem enviada

Cenário: Foto inválida
  Quando envio um arquivo PDF ou uma foto com mais de 5 MB
  Então recebo erro 400 e nada é salvo

Cenário: Limite de fotos
  Dado que o imóvel já tem 10 fotos
  Quando envio mais uma
  Então recebo erro 400 "Limite de 10 fotos"

Cenário: Outro perfil tenta cadastrar imóvel
  Dado que estou logado como hóspede
  Quando tento cadastrar um imóvel
  Então recebo erro 403

Cenário: Editar imóvel de outro anfitrião
  Dado que o imóvel 7 pertence a outro anfitrião
  Quando tento editá-lo
  Então recebo erro 404 (não revela que o imóvel existe)
```

### FEATURE: Cadastro de Serviço

```gherkin
Cenário: Prestador cadastra serviço
  Dado que estou logado como prestador
  Quando cadastro "motorista", preço R$ 900,00, unidade "diaria", cidade "Búzios"
  Então o serviço é criado como "ativo"

Cenário: Tipo de serviço fora da lista
  Quando cadastro o tipo "chef"
  Então recebo erro 400 listando os tipos aceitos
```

### FEATURE: Busca de Imóveis

```gherkin
Cenário: Busca por cidade e datas
  Dado que a "Villa Vista Mar" em Búzios tem reserva confirmada de 20/12 a 23/12
  Quando busco Búzios de 21/12 a 24/12
  Então a "Villa Vista Mar" NÃO aparece

Cenário: Checkout no mesmo dia do checkin de outra reserva
  Dado que a "Villa Vista Mar" tem reserva de 20/12 a 23/12
  Quando busco de 23/12 a 26/12
  Então a "Villa Vista Mar" aparece

Cenário: Filtro por serviço disponível
  Dado que existe um mordomo ativo em Búzios e nenhum em Paraty
  Quando busco imóveis com o serviço "mordomo"
  Então só aparecem imóveis em cidades com mordomo ativo

Cenário: Filtros combinados
  Quando busco Búzios, 6 hóspedes, tipo "villa", diária entre R$ 1.000 e R$ 3.000
  Então só aparecem villas ativas com capacidade ≥ 6 e diária nessa faixa
  E os resultados são paginados (20 por página)

Cenário: Reserva pendente expirada não bloqueia a busca
  Dado que uma reserva pendente foi criada há 31 minutos sem pagamento
  Quando busco aquelas datas
  Então o imóvel aparece como disponível
```

### FEATURE: Carrinho e Criação da Reserva

```gherkin
Cenário: Reserva com serviços acoplados
  Dado que estou logado como hóspede
  E escolhi a "Villa Vista Mar" (R$ 2.500/noite) de 20/12 a 23/12 para 6 hóspedes
  E adicionei "mordomo" (R$ 800/diária) em 21/12, quantidade 2
  Quando confirmo o carrinho
  Então é criada uma reserva "pendente" com:
    | valor_hospedagem | 750000 |
    | valor_servicos   | 160000 |
    | valor_total      | 910000 |
    | valor_comissao   | 114000 |  # 12% de 7.500 + 15% de 1.600
  E os preços dos serviços ficam congelados
  E tudo é gravado numa única transação (ou tudo, ou nada)

Cenário: Disputa pela mesma data
  Dado que dois hóspedes confirmam o carrinho do mesmo imóvel e período ao mesmo tempo
  Então apenas um consegue criar a reserva
  E o outro recebe erro 409 "Imóvel indisponível nessas datas"

Cenário: Serviço de outra cidade
  Quando tento acoplar um serviço de "Paraty" a um imóvel em "Búzios"
  Então recebo erro 422 "Serviço não atende a cidade do imóvel"

Cenário: Serviço fora do período
  Quando escolho data_servico 25/12 para uma estadia de 20/12 a 23/12
  Então recebo erro 422 "Data do serviço fora da estadia"

Cenário: Prestador já contratado no dia
  Dado que o mordomo já está contratado em 21/12 em outra reserva confirmada
  Quando tento contratá-lo para 21/12
  Então recebo erro 409 "Prestador indisponível nessa data"

Cenário: Capacidade excedida
  Quando reservo para 10 hóspedes um imóvel com capacidade 8
  Então recebo erro 422

Cenário: Preço manipulado no navegador
  Quando o carrinho chega à API com um valor alterado
  Então a API ignora os valores enviados e recalcula tudo pelo banco
```

### FEATURE: Serviços inclusos do anfitrião (RN17–RN21)

```gherkin
Cenário: Anfitrião cadastra serviço incluso
  Dado que estou logado como anfitrião, dono da "Villa Vista Mar"
  Quando cadastro "Caseiro", preço R$ 150,00, cobrança "noite"
  Então o incluso é criado "ativo", no fim da lista, com preço 15000 centavos

Cenário: Limite de inclusos
  Dado que o imóvel já tem 15 serviços inclusos
  Quando cadastro mais um
  Então recebo erro 400 "Limite de 15 serviços inclusos por imóvel"

Cenário: Incluso de imóvel de outro anfitrião
  Quando tento listar, cadastrar, editar ou desativar inclusos de um imóvel que não é meu
  Então recebo erro 404 e nada muda

Cenário: Página do imóvel
  Dado que a "Villa Vista Mar" tem "Caseiro" e "Lenha" ativos e "Café da manhã" inativo
  Quando um visitante abre a página do imóvel
  Então vê o bloco "Serviços inclusos" só com "Caseiro" e "Lenha", na ordem do anfitrião
  E o texto "Você pode retirar o que não quiser no carrinho"

Cenário: Reserva com todos os inclusos
  Dado que escolhi a "Villa Vista Mar" (R$ 2.500/noite) de 20/12 a 23/12 para 6 hóspedes
  E o carrinho trouxe marcados Caseiro (R$ 150/noite), Café da manhã (R$ 80/hóspede) e Lenha (R$ 120/estadia)
  Quando confirmo o carrinho
  Então a reserva tem:
    | valor_hospedagem | 750000 |
    | valor_inclusos   | 105000 |  # 150 × 3 + 80 × 6 + 120
    | valor_total      | 855000 |
  E a comissão dos inclusos é 12% (12600) e o anfitrião recebe 660000 + 92400
  E nome e preço de cada incluso ficam congelados na reserva

Cenário: Hóspede retira parte dos inclusos
  Dado que desmarquei o "Café da manhã" no carrinho
  Quando confirmo
  Então só Caseiro e Lenha são cobrados (valor_inclusos = 57000)

Cenário: Sem nenhum incluso
  Quando desmarco todos e confirmo
  Então a reserva tem valor_inclusos = 0

Cenário: Preço manipulado no navegador
  Quando o pedido chega com valores de inclusos alterados
  Então a API ignora e recalcula tudo pelo banco

Cenário: Incluso desativado enquanto o hóspede monta o carrinho
  Dado que o anfitrião desativou a "Lenha" depois que abri o carrinho
  Quando confirmo a reserva com a "Lenha" marcada
  Então recebo erro 422 "Este serviço incluso não está mais disponível" e nada é gravado
  E o carrinho tira a "Lenha", avisa e mostra o novo total

Cenário: Cancelamento com inclusos
  Dado que minha reserva com inclusos começa daqui a 3 dias
  Quando cancelo
  Então hospedagem e inclusos não são reembolsados (RN20); só os serviços premium a mais de 48h

Cenário: Busca só com inclusos
  Quando busco com o filtro "Só imóveis com serviços inclusos" (com_inclusos=1)
  Então só aparecem imóveis com pelo menos 1 incluso ativo
  E cada imóvel do resultado traz qtd_inclusos e o card mostra o selo "Com serviços inclusos"
```

### FEATURE: Pagamento com Split

```gherkin
Cenário: Pagamento aprovado
  Dado que tenho uma reserva "pendente" de R$ 9.100,00
  Quando pago com cartão e o Stripe envia o webhook de pagamento aprovado
  Então o pagamento fica "aprovado" com id_externo do Stripe
  E a reserva fica "confirmada"
  E o endereço completo do imóvel passa a aparecer para mim

Cenário: Pagamento recusado
  Quando o cartão é recusado
  Então o pagamento fica "recusado", a reserva continua "pendente"
  E posso tentar outro meio de pagamento até a reserva expirar (30 min)

Cenário: Webhook repetido
  Dado que o Stripe envia o mesmo evento de pagamento duas vezes
  Então a reserva é confirmada uma única vez (processamento idempotente)

Cenário: Webhook falso
  Quando chega um webhook com assinatura inválida
  Então a API responde 400 e não altera nada

Cenário: Pagamento chega depois da expiração
  Dado que a reserva expirou e as datas foram reservadas por outro hóspede
  Quando o pagamento atrasado é aprovado
  Então o valor é reembolsado automaticamente e a reserva continua "cancelada"

Cenário: Repasse (split)
  Dado que a reserva de R$ 9.100,00 foi confirmada
  Quando passam 24h do check-in
  Então o anfitrião recebe R$ 6.600,00 (7.500 − 12%)
  E o mordomo recebe R$ 1.360,00 (1.600 − 15%)
  E a plataforma fica com R$ 1.140,00 (menos as taxas do Stripe)
```

### FEATURE: Cancelamento

```gherkin
Cenário: Cancelamento com mais de 7 dias de antecedência
  Dado que minha reserva confirmada começa daqui a 10 dias
  Quando cancelo
  Então recebo reembolso integral e a reserva fica "cancelada"
  E as datas e os prestadores são liberados

Cenário: Cancelamento em cima da hora
  Dado que minha reserva começa daqui a 3 dias, com serviço marcado para daqui a 4 dias
  Quando cancelo
  Então recebo reembolso apenas do serviço
  E a hospedagem não é reembolsada

Cenário: Cancelar reserva de outro hóspede
  Quando tento cancelar uma reserva que não é minha
  Então recebo erro 404
```

### FEATURE: Avaliações

```gherkin
Cenário: Avaliar após a estadia
  Dado que minha reserva terminou ontem
  Quando dou nota 5 ao imóvel com o comentário "Impecável"
  Então a avaliação é salva e a nota média do imóvel é atualizada

Cenário: Avaliar antes do checkout
  Dado que minha estadia ainda não terminou
  Quando tento avaliar
  Então recebo erro 422 "Avaliação liberada após o checkout"

Cenário: Avaliar serviço não contratado
  Quando tento avaliar um serviço que não está na minha reserva
  Então recebo erro 422

Cenário: Avaliação repetida
  Dado que já avaliei o imóvel desta reserva
  Quando tento avaliar de novo
  Então recebo erro 409

Cenário: Prazo encerrado
  Dado que o checkout foi há 15 dias
  Quando tento avaliar
  Então recebo erro 422 "Prazo de avaliação encerrado"
```

---

## 6. CASOS DE BORDA MAPEADOS

| # | Caso | Tratamento |
|---|---|---|
| CB01 | Duas reservas simultâneas no mesmo período | Checagem e insert na mesma `db.transaction` (o SQLite serializa as escritas) → 409 para a segunda |
| CB02 | Hóspede abandona o pagamento | Expira em 30 min (RN07), checado na consulta de disponibilidade, sem depender de cron |
| CB03 | Pagamento aprovado depois da expiração | Reembolso automático se as datas já foram tomadas. Se ainda estiverem livres, a reserva é reativada |
| CB04 | Webhook duplicado, fora de ordem ou falso | Assinatura verificada + `id_externo UNIQUE` + só transições de status válidas |
| CB05 | Prestador desativa um serviço já contratado | Reservas existentes são mantidas. O serviço só some de novas buscas |
| CB06 | Anfitrião desativa imóvel com reservas futuras | Bloqueado → 409 "Imóvel tem reservas futuras" |
| CB07 | Prestador muda o preço depois da reserva | Sem efeito: o `preco_contratado` está congelado |
| CB08 | Anfitrião ou prestador sem conta Stripe concluída | Imóvel ou serviço não aparece na busca (RN13) |
| CB09 | Taxa de comissão alterada no `.env` | Só vale para novas reservas. As antigas guardam a comissão gravada |
| CB10 | Arredondamento do split (centavos ímpares) | Repasse arredondado para baixo e a diferença fica com a plataforma. A soma sempre fecha com o total |
| CB11 | Cidade digitada de formas diferentes ("búzios ", "BÚZIOS") | A API padroniza ao salvar e o frontend oferece uma lista de cidades existentes |
| CB12 | Check-in hoje com estadia já iniciada | Permitido se o check-in for hoje. Data passada → 422 |
| CB13 | Fuso horário | Todas as datas de estadia em horário de Brasília. Momentos (data_cadastro etc.) em UTC |
| CB14 | Usuário com reservas tenta excluir a conta | Bloqueado pelo banco (`ON DELETE RESTRICT`). Exclusão de conta fica fora do MVP |
| CB15 | Upload de arquivo malicioso com extensão .jpg | Validação do tipo real do arquivo (assinatura dos bytes) e nome do arquivo gerado pelo servidor |
| CB16 | Anfitrião muda preço ou nome de um incluso já contratado | Sem efeito na reserva: `reserva_inclusos` guarda nome e preço congelados |
| CB17 | Anfitrião tenta remover incluso já contratado | 409: o histórico precisa dele (FK RESTRICT). Ele pode desativar |
| CB18 | Anfitrião cria incluso depois que o hóspede salvou o carrinho | O carrinho guarda os inclusos **retirados**: o novo aparece marcado (RN18) |

---

## 7. REQUISITOS NÃO-FUNCIONAIS

| Categoria | Requisito |
|---|---|
| Segurança | Senha com bcrypt; cookie `httpOnly`, `sameSite=lax`, `secure` em produção; SQL sempre com parâmetros (`?`), nunca concatenado; checagem de dono em toda rota de edição |
| Pagamentos | Nenhum dado de cartão passa pelo servidor: o Stripe recolhe o cartão direto no navegador (Stripe Elements/Checkout) |
| Desempenho | Busca < 500 ms com 5.000 imóveis (índices já criados na Etapa 1) |
| Disponibilidade | Backup diário do arquivo SQLite com retenção de 7 dias |
| Acessibilidade | Navegação por teclado e contraste AA nas telas do fluxo do hóspede |
| Responsividade | Fluxo do hóspede 100% usável no celular |
| LGPD | Endereço exato só após a confirmação (RN12); telefone do hóspede visível apenas ao anfitrião e aos prestadores da própria reserva |
| Testes | Regras de domínio (split, período, cancelamento) com testes unitários sem banco; rotas com testes de integração em SQLite `:memory:` |

---

## 8. FORA DO ESCOPO DO MVP

- Painel administrativo (moderação, disputas): usar o painel do Stripe
- Notificações por e-mail ou WhatsApp (o MVP mostra a confirmação na tela e em "Minhas reservas")
- Chat entre hóspede, anfitrião e prestador
- Bloqueio manual de datas pelo anfitrião e calendário sincronizado (iCal com Airbnb/Booking)
- Taxa de limpeza, preço por temporada e descontos por estadia longa
- Política de cancelamento diferente por imóvel
- Aceite manual da reserva pelo anfitrião ou prestador (MVP = reserva instantânea)
- App mobile nativo, vários idiomas e cupons
