ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS referencia_texto TEXT,
ADD COLUMN IF NOT EXISTS referencia_fonte TEXT,
ADD COLUMN IF NOT EXISTS grupo_id UUID;

CREATE INDEX IF NOT EXISTS questions_grupo_id_idx ON public.questions (grupo_id);
