ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS area_geral TEXT,
  ADD COLUMN IF NOT EXISTS conteudo_principal TEXT,
  ADD COLUMN IF NOT EXISTS subconteudo_principal TEXT,
  ADD COLUMN IF NOT EXISTS conteudos_relacionados TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags_livres TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS questions_area_geral_idx ON public.questions (area_geral);
CREATE INDEX IF NOT EXISTS questions_conteudo_principal_idx ON public.questions (conteudo_principal);
CREATE INDEX IF NOT EXISTS questions_subconteudo_principal_idx ON public.questions (subconteudo_principal);
CREATE INDEX IF NOT EXISTS questions_conteudos_relacionados_idx ON public.questions USING GIN (conteudos_relacionados);
CREATE INDEX IF NOT EXISTS questions_tags_livres_idx ON public.questions USING GIN (tags_livres);
