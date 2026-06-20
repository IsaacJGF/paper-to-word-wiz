ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS referencia_imagem TEXT,
  ADD COLUMN IF NOT EXISTS referencia_imagem_pos TEXT,
  ADD COLUMN IF NOT EXISTS referencia_imagem_layout JSONB,
  ADD COLUMN IF NOT EXISTS referencia_texto_apos TEXT,
  ADD COLUMN IF NOT EXISTS enunciado_imagem_layout JSONB;