ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS referencia_imagem text,
  ADD COLUMN IF NOT EXISTS referencia_imagem_pos text,
  ADD COLUMN IF NOT EXISTS referencia_texto_apos text;
