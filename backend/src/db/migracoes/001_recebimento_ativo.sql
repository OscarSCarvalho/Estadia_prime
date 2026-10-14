-- RN13: imóvel e serviço só aparecem na busca se o dono concluiu o cadastro de recebimento no Stripe.
-- Passa a 1 quando o webhook account.updated do Stripe confirmar a conta (Etapa 4b).
ALTER TABLE usuarios
    ADD COLUMN recebimento_ativo INTEGER NOT NULL DEFAULT 0 CHECK (recebimento_ativo IN (0, 1));
