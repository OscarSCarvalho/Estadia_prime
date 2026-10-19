-- RN17–RN21: serviços inclusos do anfitrião (caseiro, limpeza diária, café da manhã...) e o tipo 'sitio'.

-- 1) 'sitio' no CHECK de imoveis.tipo_imovel. O SQLite não altera CHECK: a tabela é recriada
--    (procedimento oficial de 12 passos). O database.js desliga as foreign keys durante as migrações
--    e confere a integridade (PRAGMA foreign_key_check) antes do commit; sem isso, o DROP TABLE
--    apagaria as fotos em cascata.
CREATE TABLE imoveis_nova (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    anfitriao_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    titulo          TEXT    NOT NULL,
    descricao       TEXT,
    tipo_imovel     TEXT    NOT NULL CHECK (tipo_imovel IN ('casa', 'apartamento', 'cobertura', 'chale', 'villa', 'fazenda', 'sitio')),
    endereco        TEXT    NOT NULL,
    cidade          TEXT    NOT NULL COLLATE NOCASE,
    estado          TEXT    NOT NULL CHECK (length(estado) = 2),
    preco_diaria    INTEGER NOT NULL CHECK (preco_diaria > 0),
    num_hospedes    INTEGER NOT NULL CHECK (num_hospedes >= 1),
    num_quartos     INTEGER NOT NULL CHECK (num_quartos >= 0),
    status          TEXT    NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    data_cadastro   TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO imoveis_nova (id, anfitriao_id, titulo, descricao, tipo_imovel, endereco, cidade, estado,
                          preco_diaria, num_hospedes, num_quartos, status, data_cadastro)
SELECT id, anfitriao_id, titulo, descricao, tipo_imovel, endereco, cidade, estado,
       preco_diaria, num_hospedes, num_quartos, status, data_cadastro
  FROM imoveis;

DROP TABLE imoveis;
ALTER TABLE imoveis_nova RENAME TO imoveis;

CREATE INDEX IF NOT EXISTS idx_imoveis_busca     ON imoveis (cidade, status, preco_diaria);
CREATE INDEX IF NOT EXISTS idx_imoveis_anfitriao ON imoveis (anfitriao_id);

-- 2) Serviços que o próprio anfitrião oferece no imóvel (RN17). Preço em centavos
CREATE TABLE imovel_servicos_inclusos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    imovel_id       INTEGER NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    nome            TEXT    NOT NULL CHECK (length(nome) BETWEEN 3 AND 60),
    descricao       TEXT    CHECK (descricao IS NULL OR length(descricao) <= 300),
    preco           INTEGER NOT NULL CHECK (preco > 0),
    unidade_preco   TEXT    NOT NULL CHECK (unidade_preco IN ('estadia', 'noite', 'hospede')),
    status          TEXT    NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    ordem           INTEGER NOT NULL DEFAULT 0,
    data_cadastro   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_inclusos_imovel ON imovel_servicos_inclusos (imovel_id, status);

-- 3) Inclusos que o hóspede manteve no carrinho (RN18). Nome e preço congelados, como em reserva_servicos.
--    RESTRICT: incluso já contratado não pode ser apagado (o anfitrião desativa)
CREATE TABLE reserva_inclusos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    reserva_id          INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    imovel_servico_id   INTEGER NOT NULL REFERENCES imovel_servicos_inclusos(id) ON DELETE RESTRICT,
    nome_contratado     TEXT    NOT NULL,
    unidade_preco       TEXT    NOT NULL CHECK (unidade_preco IN ('estadia', 'noite', 'hospede')),
    quantidade          INTEGER NOT NULL CHECK (quantidade >= 1),
    preco_contratado    INTEGER NOT NULL CHECK (preco_contratado > 0),
    subtotal            INTEGER NOT NULL CHECK (subtotal = preco_contratado * quantidade),
    valor_comissao      INTEGER NOT NULL DEFAULT 0 CHECK (valor_comissao >= 0 AND valor_comissao <= subtotal),
    UNIQUE (reserva_id, imovel_servico_id)
);

CREATE INDEX idx_reserva_inclusos_reserva ON reserva_inclusos (reserva_id);
CREATE INDEX idx_reserva_inclusos_servico ON reserva_inclusos (imovel_servico_id);
