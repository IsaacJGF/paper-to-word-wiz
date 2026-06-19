ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS referencia_texto TEXT,
ADD COLUMN IF NOT EXISTS referencia_fonte TEXT,
ADD COLUMN IF NOT EXISTS grupo_id UUID,
ADD COLUMN IF NOT EXISTS referencia_imagem TEXT,
ADD COLUMN IF NOT EXISTS referencia_imagem_pos TEXT,
ADD COLUMN IF NOT EXISTS referencia_texto_apos TEXT,
ADD COLUMN IF NOT EXISTS enunciado_imagem TEXT,
ADD COLUMN IF NOT EXISTS enunciado_imagem_pos TEXT,
ADD COLUMN IF NOT EXISTS area_geral TEXT,
ADD COLUMN IF NOT EXISTS conteudo_principal TEXT,
ADD COLUMN IF NOT EXISTS subconteudo_principal TEXT,
ADD COLUMN IF NOT EXISTS conteudos_relacionados TEXT[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS tags_livres TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS questions_grupo_id_idx ON public.questions (grupo_id);
CREATE INDEX IF NOT EXISTS questions_area_geral_idx ON public.questions (area_geral);
CREATE INDEX IF NOT EXISTS questions_conteudo_principal_idx ON public.questions (conteudo_principal);
CREATE INDEX IF NOT EXISTS questions_subconteudo_principal_idx ON public.questions (subconteudo_principal);
