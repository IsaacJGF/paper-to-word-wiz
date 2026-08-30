ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS referencia_imagens_extra jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS enunciado_imagens_extra jsonb NOT NULL DEFAULT '[]'::jsonb;