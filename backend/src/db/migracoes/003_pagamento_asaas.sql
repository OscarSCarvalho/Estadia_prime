-- Etapa 4b: pagamento pelo Asaas, "cobrança única + transferências" (CONTEXT §4.4).
-- O hóspede paga UMA cobrança na conta da plataforma; 24h depois do check-in a plataforma transfere
-- o repasse de cada recebedor para a subconta Asaas dele (RN09).

-- 1) Usuários. cpf_cnpj só com dígitos (o domínio confere o dígito verificador).
--    conta_pagamento_id (já existia) guarda o walletId da subconta, usado nas transferências.
--    A apiKey da subconta só vem na resposta da criação e não pode ser recuperada depois:
--    fica cifrada (AES-256-GCM) e nunca sai pela API.
ALTER TABLE usuarios ADD COLUMN cpf_cnpj TEXT CHECK (cpf_cnpj IS NULL OR (length(cpf_cnpj) IN (11, 14) AND cpf_cnpj NOT GLOB '*[^0-9]*'));
ALTER TABLE usuarios ADD COLUMN asaas_cliente_id TEXT;
ALTER TABLE usuarios ADD COLUMN asaas_conta_id TEXT;
ALTER TABLE usuarios ADD COLUMN asaas_chave_api_cifrada TEXT;
-- Situação do cadastro da subconta no Asaas. recebimento_ativo = 1 só quando 'aprovado' (RN13)
ALTER TABLE usuarios ADD COLUMN situacao_recebimento TEXT
    CHECK (situacao_recebimento IS NULL OR situacao_recebimento IN ('em_analise', 'pendente', 'aprovado', 'recusado'));

CREATE UNIQUE INDEX idx_usuarios_asaas_conta ON usuarios (asaas_conta_id) WHERE asaas_conta_id IS NOT NULL;

-- 2) Pagamentos. Ninguém referencia esta tabela, então ela é recriada para ampliar o CHECK de status:
--    'cancelado'          → cobrança apagada no Asaas (reserva expirada ou troca de Pix ↔ cartão)
--    'reembolso_pendente' → pagamento aprovado que precisa voltar inteiro ao hóspede (CB03); a rotina tenta de novo
--    'reembolsado'        → houve devolução, total ou parcial (valor em valor_reembolsado)
CREATE TABLE pagamentos_nova (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    reserva_id          INTEGER NOT NULL REFERENCES reservas(id) ON DELETE RESTRICT,
    valor_total         INTEGER NOT NULL CHECK (valor_total > 0),
    valor_comissao      INTEGER NOT NULL CHECK (valor_comissao >= 0 AND valor_comissao <= valor_total),
    status              TEXT    NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente', 'aprovado', 'recusado', 'cancelado', 'reembolso_pendente', 'reembolsado')),
    metodo              TEXT    CHECK (metodo IN ('pix', 'cartao_credito')),
    id_externo          TEXT    UNIQUE,
    data_pagamento      TEXT,
    -- Taxa real cobrada pelo Asaas (value − netValue), absorvida pela plataforma. Só para relatório
    taxa_gateway        INTEGER CHECK (taxa_gateway IS NULL OR taxa_gateway >= 0),
    valor_reembolsado   INTEGER NOT NULL DEFAULT 0 CHECK (valor_reembolsado >= 0 AND valor_reembolsado <= valor_total),
    url_fatura          TEXT,
    pix_copia_cola      TEXT,
    pix_qr_base64       TEXT,
    -- Fim do prazo de pagamento da reserva (RN07), em ISO UTC
    expira_em           TEXT,
    data_criacao        TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO pagamentos_nova (id, reserva_id, valor_total, valor_comissao, status, metodo, id_externo, data_pagamento)
SELECT id, reserva_id, valor_total, valor_comissao, status, metodo, id_externo, data_pagamento
  FROM pagamentos;

DROP TABLE pagamentos;
ALTER TABLE pagamentos_nova RENAME TO pagamentos;

CREATE INDEX idx_pagamentos_reserva ON pagamentos (reserva_id);
-- No máximo uma cobrança em aberto por reserva: dois cliques em "Pagar" não geram duas cobranças
CREATE UNIQUE INDEX idx_pagamentos_um_aberto ON pagamentos (reserva_id) WHERE status = 'pendente';
CREATE INDEX idx_pagamentos_reembolso_pendente ON pagamentos (status) WHERE status = 'reembolso_pendente';

-- 3) Idempotência dos webhooks: o Asaas entrega "pelo menos uma vez"; cada evento é processado uma vez só
CREATE TABLE eventos_gateway (
    id_evento   TEXT PRIMARY KEY,
    tipo        TEXT NOT NULL,
    recebido_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4) Reservas. repasse_em = quando todos os repasses foram enviados (ou quando não havia nada a repassar).
--    hospedagem_reembolsada acompanha os itens: no cancelamento integral (RN10) a hospedagem também volta
ALTER TABLE reservas ADD COLUMN repasse_em TEXT;
ALTER TABLE reservas ADD COLUMN hospedagem_reembolsada INTEGER NOT NULL DEFAULT 0 CHECK (hospedagem_reembolsada IN (0, 1));

-- 5) Repasses (RN09): uma linha por recebedor da reserva. O UNIQUE impede repassar duas vezes
CREATE TABLE repasses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    reserva_id  INTEGER NOT NULL REFERENCES reservas(id) ON DELETE RESTRICT,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo        TEXT    NOT NULL CHECK (tipo IN ('anfitriao', 'prestador')),
    valor       INTEGER NOT NULL CHECK (valor > 0),
    status      TEXT    NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'falhou')),
    id_externo  TEXT    UNIQUE,
    tentativa   INTEGER NOT NULL DEFAULT 0 CHECK (tentativa >= 0),
    ultimo_erro TEXT,
    criado_em   TEXT    NOT NULL DEFAULT (datetime('now')),
    enviado_em  TEXT,
    UNIQUE (reserva_id, usuario_id, tipo)
);

CREATE INDEX idx_repasses_usuario ON repasses (usuario_id);
CREATE INDEX idx_repasses_a_enviar ON repasses (status) WHERE status <> 'enviado';
CREATE INDEX idx_reservas_repasse ON reservas (data_checkin) WHERE repasse_em IS NULL;

-- 6) Itens devolvidos no cancelamento (RN10 + RN20): ficam fora do repasse
ALTER TABLE reserva_servicos ADD COLUMN reembolsado INTEGER NOT NULL DEFAULT 0 CHECK (reembolsado IN (0, 1));
ALTER TABLE reserva_inclusos ADD COLUMN reembolsado INTEGER NOT NULL DEFAULT 0 CHECK (reembolsado IN (0, 1));
