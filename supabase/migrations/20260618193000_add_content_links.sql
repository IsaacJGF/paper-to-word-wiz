CREATE TABLE IF NOT EXISTS public.contents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.question_contents (
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, content_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contents TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.question_contents TO anon, authenticated;
GRANT ALL ON public.contents TO service_role;
GRANT ALL ON public.question_contents TO service_role;

ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read contents" ON public.contents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert contents" ON public.contents FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update contents" ON public.contents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete contents" ON public.contents FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Public read question contents" ON public.question_contents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert question contents" ON public.question_contents FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public delete question contents" ON public.question_contents FOR DELETE TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS contents_touch_updated_at ON public.contents;
CREATE TRIGGER contents_touch_updated_at
BEFORE UPDATE ON public.contents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS question_contents_content_id_idx ON public.question_contents (content_id);
CREATE INDEX IF NOT EXISTS contents_nome_idx ON public.contents (nome);

CREATE OR REPLACE FUNCTION public.sync_question_contents() RETURNS TRIGGER AS $$
DECLARE
  raw_content TEXT;
  content_name TEXT;
  linked_content_id UUID;
BEGIN
  DELETE FROM public.question_contents WHERE question_id = NEW.id;

  IF NEW.conteudo IS NULL OR btrim(NEW.conteudo) = '' THEN
    RETURN NEW;
  END IF;

  FOR raw_content IN
    SELECT regexp_split_to_table(NEW.conteudo, '\s*[,;]\s*|\n+')
  LOOP
    content_name := btrim(raw_content);
    IF content_name <> '' THEN
      INSERT INTO public.contents (nome)
      VALUES (content_name)
      ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id INTO linked_content_id;

      INSERT INTO public.question_contents (question_id, content_id)
      VALUES (NEW.id, linked_content_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS questions_sync_contents ON public.questions;
CREATE TRIGGER questions_sync_contents
AFTER INSERT OR UPDATE OF conteudo ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.sync_question_contents();

UPDATE public.questions
SET conteudo = conteudo
WHERE conteudo IS NOT NULL AND btrim(conteudo) <> '';
