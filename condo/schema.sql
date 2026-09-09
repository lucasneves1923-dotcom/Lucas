-- Schema Postgres do sistema de controle de acesso para condominios.
-- Multi-tenant desde o inicio: toda tabela operacional pendura em condominios,
-- direto ou por transitividade, para que um sindico jamais consiga enxergar
-- ou alterar dados de outro condominio mesmo que tente forcar um ID na URL.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE papel_usuario AS ENUM ('morador', 'sindico');
CREATE TYPE canal_codigo AS ENUM ('sms', 'whatsapp');
CREATE TYPE origem_abertura AS ENUM ('morador', 'visitante', 'sindico');
CREATE TYPE resultado_abertura AS ENUM ('sucesso', 'bloqueado_cooldown', 'erro');

CREATE TABLE condominios (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL,
    endereco    TEXT,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nao existe endpoint publico de cadastro. Toda linha desta tabela nasce
-- de uma acao do sindico (via /admin/moradores) ou de um seed manual via SQL
-- (unico jeito de criar o primeiro sindico de um condominio, de proposito).
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id   UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
    nome            TEXT NOT NULL,
    telefone        TEXT NOT NULL,
    papel           papel_usuario NOT NULL DEFAULT 'morador',
    pin_hash        TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT true,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (condominio_id, telefone),
    -- Moradores nunca tem PIN. So sindico pode ter (e mesmo assim comeca nulo
    -- ate o primeiro login, quando e obrigado a definir um via /admin/definir-pin).
    CONSTRAINT pin_somente_sindico CHECK (papel = 'sindico' OR pin_hash IS NULL)
);

-- Codigos de uso unico (OTP) enviados por SMS/WhatsApp, tanto para o primeiro
-- fator do morador quanto para o primeiro fator do sindico.
CREATE TABLE codigos_acesso (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo_hash     TEXT NOT NULL,
    canal           canal_codigo NOT NULL DEFAULT 'sms',
    tentativas      INTEGER NOT NULL DEFAULT 0,
    usado           BOOLEAN NOT NULL DEFAULT false,
    expira_em       TIMESTAMPTZ NOT NULL,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_codigos_acesso_usuario ON codigos_acesso(usuario_id, criado_em DESC);

CREATE TABLE portoes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id       UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
    nome                TEXT NOT NULL,
    tempo_abertura_seg  INTEGER NOT NULL DEFAULT 15,
    tempo_cooldown_seg  INTEGER NOT NULL DEFAULT 20,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dispositivos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portao_id       UUID NOT NULL REFERENCES portoes(id) ON DELETE CASCADE,
    identificador   TEXT NOT NULL UNIQUE,
    topico_mqtt     TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'desconhecido',
    ultimo_ping_em  TIMESTAMPTZ,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cameras (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portao_id   UUID NOT NULL REFERENCES portoes(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    url_stream  TEXT NOT NULL,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE links_visitante (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portao_id           UUID NOT NULL REFERENCES portoes(id) ON DELETE CASCADE,
    criado_por_usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token               TEXT NOT NULL UNIQUE,
    limite_usos         INTEGER NOT NULL DEFAULT 1,
    usos_realizados      INTEGER NOT NULL DEFAULT 0,
    expira_em           TIMESTAMPTZ NOT NULL,
    revogado            BOOLEAN NOT NULL DEFAULT false,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_links_visitante_token ON links_visitante(token);

CREATE TABLE aberturas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portao_id           UUID NOT NULL REFERENCES portoes(id) ON DELETE CASCADE,
    usuario_id          UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    link_visitante_id   UUID REFERENCES links_visitante(id) ON DELETE SET NULL,
    origem              origem_abertura NOT NULL,
    resultado           resultado_abertura NOT NULL,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O debounce de servidor le sempre a ultima abertura por portao: este indice
-- e o que torna essa checagem barata a cada chamada.
CREATE INDEX idx_aberturas_portao_criado ON aberturas(portao_id, criado_em DESC);
CREATE INDEX idx_aberturas_usuario ON aberturas(usuario_id, criado_em DESC);

-- Auditoria de toda acao sensivel de sindico. Nunca e apagada: revogamos em
-- codigo a permissao de DELETE/UPDATE para o papel de aplicacao e reforcamos
-- com um trigger, para que nem um bug no backend consiga alterar o historico.
CREATE TABLE auditoria (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id   UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
    usuario_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    acao            TEXT NOT NULL,
    detalhes        JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auditoria_condominio ON auditoria(condominio_id, criado_em DESC);

CREATE OR REPLACE FUNCTION bloquear_alteracao_auditoria()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'a tabela auditoria e append-only: % nao e permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditoria_append_only
    BEFORE UPDATE OR DELETE ON auditoria
    FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_auditoria();

CREATE TABLE relatorios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id   UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL,
    periodo_inicio  TIMESTAMPTZ NOT NULL,
    periodo_fim     TIMESTAMPTZ NOT NULL,
    conteudo        JSONB NOT NULL DEFAULT '{}'::jsonb,
    gerado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_relatorios_condominio ON relatorios(condominio_id, gerado_em DESC);
