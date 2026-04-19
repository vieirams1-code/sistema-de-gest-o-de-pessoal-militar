-- MVP estrutural para identidade de militar + histórico de matrículas
-- Executar em janela de manutenção com backup prévio.

BEGIN;

CREATE TABLE IF NOT EXISTS matricula_militar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  militar_id uuid NOT NULL,
  matricula text NOT NULL,
  matricula_normalizada text NOT NULL,
  tipo_matricula text NOT NULL DEFAULT 'Principal',
  situacao text NOT NULL DEFAULT 'Ativa',
  is_atual boolean NOT NULL DEFAULT true,
  data_inicio date,
  data_fim date,
  motivo text,
  origem_registro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_matricula_militar_matricula_normalizada
  ON matricula_militar (matricula_normalizada);

CREATE UNIQUE INDEX IF NOT EXISTS ux_matricula_militar_atual_por_militar
  ON matricula_militar (militar_id)
  WHERE is_atual = true;

ALTER TABLE militar
  ADD COLUMN IF NOT EXISTS nome_canonico text,
  ADD COLUMN IF NOT EXISTS merged_into_id uuid,
  ADD COLUMN IF NOT EXISTS status_cadastro text;

UPDATE militar
SET nome_canonico = upper(unaccent(trim(coalesce(nome_completo, ''))))
WHERE coalesce(nome_canonico, '') = '';

-- Unicidade condicional de CPF (somente quando preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS ux_militar_cpf_not_null
  ON militar (cpf)
  WHERE cpf IS NOT NULL AND btrim(cpf) <> '';

-- Migração do legado: preserva matrícula atual sem apagar coluna antiga em militar
INSERT INTO matricula_militar (
  militar_id,
  matricula,
  matricula_normalizada,
  tipo_matricula,
  situacao,
  is_atual,
  data_inicio,
  motivo,
  origem_registro
)
SELECT
  m.id,
  m.matricula,
  regexp_replace(m.matricula, '\\D', '', 'g') AS matricula_normalizada,
  'Principal',
  'Ativa',
  true,
  COALESCE(m.data_inclusao::date, CURRENT_DATE),
  'Migração do legado',
  'migracao_estrutura'
FROM militar m
WHERE coalesce(m.matricula, '') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM matricula_militar mm
    WHERE mm.militar_id = m.id
      AND mm.matricula_normalizada = regexp_replace(m.matricula, '\\D', '', 'g')
  );

COMMIT;

-- Diagnóstico (não executa merge automático):
-- SELECT matricula_normalizada, count(*)
-- FROM matricula_militar
-- GROUP BY matricula_normalizada
-- HAVING count(*) > 1;
