
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT,
  enunciado TEXT NOT NULL DEFAULT '',
  alternativas JSONB NOT NULL DEFAULT '[]'::jsonb,
  tipo TEXT NOT NULL DEFAULT 'multipla_escolha',
  resposta TEXT,
  fonte TEXT,
  disciplina TEXT,
  conteudo TEXT,
  dificuldade TEXT,
  ano TEXT,
  prova TEXT,
  instituicao TEXT,
  tags TEXT[],
  observacoes TEXT,
  imagem_original_url TEXT,
  tem_equacao BOOLEAN NOT NULL DEFAULT false,
  tem_imagem BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO anon, authenticated;
GRANT ALL ON public.questions TO service_role;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.questions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert" ON public.questions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update" ON public.questions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete" ON public.questions FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER questions_touch_updated_at
BEFORE UPDATE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX questions_created_at_idx ON public.questions (created_at DESC);
