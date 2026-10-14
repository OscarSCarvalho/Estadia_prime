-- Estadia Prime — schema do banco (SQLite)
-- Convenções:
--   * Valores monetários em CENTAVOS (INTEGER). Ex.: R$ 1.250,00 = 125000
--   * Datas no formato ISO: 'YYYY-MM-DD' (dia) ou 'YYYY-MM-DD HH:MM:SS' (momento)
--   * Script idempotente: pode rodar várias vezes sem apagar dados

CREATE TABLE IF NOT EXISTS usuarios (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                TEXT    NOT NULL,
    email               TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash          TEXT    NOT NULL,
    telefone            TEXT,
    tipo                TEXT    NOT NULL CHECK (tipo IN ('anfitriao', 'hospede', 'prestador')),
    conta_pagamento_id  TEXT,
    data_cadastro       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS imoveis (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    anfitriao_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    titulo          TEXT    NOT NULL,
    descricao       TEXT,
    tipo_imovel     TEXT    NOT NULL CHECK (tipo_imovel IN ('casa', 'apartamento', 'cobertura', 'chale', 'villa', 'fazenda')),
    endereco        TEXT    NOT NULL,
    cidade          TEXT    NOT NULL COLLATE NOCASE,
    estado          TEXT    NOT NULL CHECK (length(estado) = 2),
    preco_diaria    INTEGER NOT NULL CHECK (preco_diaria > 0),
    num_hospedes    INTEGER NOT NULL CHECK (num_hospedes >= 1),
    num_quartos     INTEGER NOT NULL CHECK (num_quartos >= 0),
    status          TEXT    NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    data_cadastro   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS imovel_fotos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    imovel_id   INTEGER NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    url_foto    TEXT    NOT NULL,
    ordem       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS servicos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    prestador_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo_servico    TEXT    NOT NULL CHECK (tipo_servico IN ('mordomo', 'copeiro', 'empregado', 'motorista', 'barman', 'eventos')),
    descricao       TEXT,
    preco           INTEGER NOT NULL CHECK (preco > 0),
    unidade_preco   TEXT    NOT NULL DEFAULT 'diaria' CHECK (unidade_preco IN ('hora', 'diaria', 'evento')),
    cidade_atuacao  TEXT    NOT NULL COLLATE NOCASE,
    status          TEXT    NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo'))
);

CREATE TABLE IF NOT EXISTS reservas (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    hospede_id          INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    imovel_id           INTEGER NOT NULL REFERENCES imoveis(id)  ON DELETE RESTRICT,
    data_checkin        TEXT    NOT NULL,
    data_checkout       TEXT    NOT NULL,
    num_hospedes        INTEGER NOT NULL CHECK (num_hospedes >= 1),
    valor_hospedagem    INTEGER NOT NULL CHECK (valor_hospedagem >= 0),
    valor_servicos      INTEGER NOT NULL DEFAULT 0 CHECK (valor_servicos >= 0),
    valor_total         INTEGER NOT NULL CHECK (valor_total = valor_hospedagem + valor_servicos),
    valor_comissao      INTEGER NOT NULL DEFAULT 0 CHECK (valor_comissao >= 0),
    status              TEXT    NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmada', 'cancelada', 'concluida')),
    data_reserva        TEXT    NOT NULL DEFAULT (datetime('now')),
    CHECK (date(data_checkin)  IS data_checkin),
    CHECK (date(data_checkout) IS data_checkout),
    CHECK (data_checkout > data_checkin)
);

CREATE TABLE IF NOT EXISTS reserva_servicos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    reserva_id          INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    servico_id          INTEGER NOT NULL REFERENCES servicos(id) ON DELETE RESTRICT,
    data_servico        TEXT    NOT NULL CHECK (date(data_servico) IS data_servico),
    quantidade          INTEGER NOT NULL DEFAULT 1 CHECK (quantidade >= 1),
    preco_contratado    INTEGER NOT NULL CHECK (preco_contratado > 0),
    valor_comissao      INTEGER NOT NULL DEFAULT 0 CHECK (valor_comissao >= 0)
);

CREATE TABLE IF NOT EXISTS pagamentos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reserva_id      INTEGER NOT NULL REFERENCES reservas(id) ON DELETE RESTRICT,
    valor_total     INTEGER NOT NULL CHECK (valor_total > 0),
    valor_comissao  INTEGER NOT NULL CHECK (valor_comissao >= 0 AND valor_comissao <= valor_total),
    status          TEXT    NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado', 'reembolsado')),
    metodo          TEXT    CHECK (metodo IN ('pix', 'cartao_credito')),
    id_externo      TEXT    UNIQUE,
    data_pagamento  TEXT
);

CREATE TABLE IF NOT EXISTS avaliacoes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    reserva_id  INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    autor_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo_alvo   TEXT    NOT NULL CHECK (tipo_alvo IN ('imovel', 'servico')),
    alvo_id     INTEGER NOT NULL,
    nota        INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
    comentario  TEXT,
    data        TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (reserva_id, autor_id, tipo_alvo, alvo_id)
);

-- Tabela técnica: sessões de login do express-session (não faz parte do modelo de negócio)
CREATE TABLE IF NOT EXISTS sessoes (
    sid         TEXT    PRIMARY KEY,
    dados       TEXT    NOT NULL,
    expira_em   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessoes_expira_em ON sessoes (expira_em);

-- Índices para as consultas mais frequentes (busca, disponibilidade, painéis)
CREATE INDEX IF NOT EXISTS idx_imoveis_busca          ON imoveis (cidade, status, preco_diaria);
CREATE INDEX IF NOT EXISTS idx_imoveis_anfitriao      ON imoveis (anfitriao_id);
CREATE INDEX IF NOT EXISTS idx_imovel_fotos_imovel    ON imovel_fotos (imovel_id, ordem);
CREATE INDEX IF NOT EXISTS idx_servicos_busca         ON servicos (cidade_atuacao, status, tipo_servico);
CREATE INDEX IF NOT EXISTS idx_servicos_prestador     ON servicos (prestador_id);
CREATE INDEX IF NOT EXISTS idx_reservas_periodo       ON reservas (imovel_id, data_checkin, data_checkout);
CREATE INDEX IF NOT EXISTS idx_reservas_hospede       ON reservas (hospede_id);
CREATE INDEX IF NOT EXISTS idx_reserva_servicos_res   ON reserva_servicos (reserva_id);
CREATE INDEX IF NOT EXISTS idx_reserva_servicos_agenda ON reserva_servicos (servico_id, data_servico);
CREATE INDEX IF NOT EXISTS idx_pagamentos_reserva     ON pagamentos (reserva_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_alvo        ON avaliacoes (tipo_alvo, alvo_id);
