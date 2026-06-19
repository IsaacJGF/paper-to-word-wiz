-- Completa o catálogo com provas e instituições citadas em Caltalo.md.
-- Mantém todos os itens ativos e evita duplicidade por nome.

WITH prova_names(nome) AS (
  SELECT trim(value)
  FROM regexp_split_to_table($provas$
ENEM
PAS
Vestibular
Fuvest
Unicamp
Simulado
Prova escolar
$provas$, E'\n') AS value
  WHERE trim(value) <> ''
)
INSERT INTO public.catalog_provas (nome, ativo)
SELECT nome, true FROM prova_names
ON CONFLICT (nome) DO UPDATE
SET ativo = EXCLUDED.ativo,
    updated_at = now();

WITH instituicao_names(nome) AS (
  SELECT trim(value)
  FROM regexp_split_to_table($instituicoes$
Cebraspe
UnB
Fuvest
Unicamp
Autor próprio
Livro didático
$instituicoes$, E'\n') AS value
  WHERE trim(value) <> ''
)
INSERT INTO public.catalog_instituicoes (nome, ativo)
SELECT nome, true FROM instituicao_names
ON CONFLICT (nome) DO UPDATE
SET ativo = EXCLUDED.ativo,
    updated_at = now();
