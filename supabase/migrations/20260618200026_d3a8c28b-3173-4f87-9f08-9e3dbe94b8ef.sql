ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS referencia_texto text,
  ADD COLUMN IF NOT EXISTS referencia_fonte text,
  ADD COLUMN IF NOT EXISTS grupo_id uuid;

CREATE INDEX IF NOT EXISTS questions_grupo_id_idx ON public.questions(grupo_id);