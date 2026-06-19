
-- ============ CATÁLOGOS ============

CREATE TABLE public.catalog_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_areas TO anon, authenticated;
GRANT ALL ON public.catalog_areas TO service_role;
ALTER TABLE public.catalog_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read"   ON public.catalog_areas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert" ON public.catalog_areas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update" ON public.catalog_areas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete" ON public.catalog_areas FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER catalog_areas_touch BEFORE UPDATE ON public.catalog_areas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.catalog_conteudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  area_id uuid NOT NULL REFERENCES public.catalog_areas(id) ON DELETE RESTRICT,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_conteudos TO anon, authenticated;
GRANT ALL ON public.catalog_conteudos TO service_role;
ALTER TABLE public.catalog_conteudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read"   ON public.catalog_conteudos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert" ON public.catalog_conteudos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update" ON public.catalog_conteudos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete" ON public.catalog_conteudos FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER catalog_conteudos_touch BEFORE UPDATE ON public.catalog_conteudos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX catalog_conteudos_area_idx ON public.catalog_conteudos(area_id);

CREATE TABLE public.catalog_subconteudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  conteudo_id uuid NOT NULL REFERENCES public.catalog_conteudos(id) ON DELETE RESTRICT,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conteudo_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_subconteudos TO anon, authenticated;
GRANT ALL ON public.catalog_subconteudos TO service_role;
ALTER TABLE public.catalog_subconteudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read"   ON public.catalog_subconteudos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert" ON public.catalog_subconteudos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update" ON public.catalog_subconteudos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete" ON public.catalog_subconteudos FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER catalog_subconteudos_touch BEFORE UPDATE ON public.catalog_subconteudos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX catalog_subconteudos_conteudo_idx ON public.catalog_subconteudos(conteudo_id);

-- Listas simples (relacionados, tags, provas, instituições)
DO $$ BEGIN
  PERFORM 1;
END $$;

CREATE TABLE public.catalog_relacionados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_relacionados TO anon, authenticated;
GRANT ALL ON public.catalog_relacionados TO service_role;
ALTER TABLE public.catalog_relacionados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read"   ON public.catalog_relacionados FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert" ON public.catalog_relacionados FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update" ON public.catalog_relacionados FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete" ON public.catalog_relacionados FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER catalog_relacionados_touch BEFORE UPDATE ON public.catalog_relacionados FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.catalog_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_tags TO anon, authenticated;
GRANT ALL ON public.catalog_tags TO service_role;
ALTER TABLE public.catalog_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read"   ON public.catalog_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert" ON public.catalog_tags FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update" ON public.catalog_tags FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete" ON public.catalog_tags FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER catalog_tags_touch BEFORE UPDATE ON public.catalog_tags FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.catalog_provas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_provas TO anon, authenticated;
GRANT ALL ON public.catalog_provas TO service_role;
ALTER TABLE public.catalog_provas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read"   ON public.catalog_provas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert" ON public.catalog_provas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update" ON public.catalog_provas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete" ON public.catalog_provas FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER catalog_provas_touch BEFORE UPDATE ON public.catalog_provas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.catalog_instituicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_instituicoes TO anon, authenticated;
GRANT ALL ON public.catalog_instituicoes TO service_role;
ALTER TABLE public.catalog_instituicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read"   ON public.catalog_instituicoes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert" ON public.catalog_instituicoes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update" ON public.catalog_instituicoes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete" ON public.catalog_instituicoes FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER catalog_instituicoes_touch BEFORE UPDATE ON public.catalog_instituicoes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ NOVOS CAMPOS NA TABELA questions ============

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS area_geral text,
  ADD COLUMN IF NOT EXISTS conteudo_principal text,
  ADD COLUMN IF NOT EXISTS subconteudo_principal text,
  ADD COLUMN IF NOT EXISTS conteudos_relacionados text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS tags_livres text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS questions_area_geral_idx ON public.questions(area_geral);
CREATE INDEX IF NOT EXISTS questions_conteudo_principal_idx ON public.questions(conteudo_principal);
CREATE INDEX IF NOT EXISTS questions_subconteudo_principal_idx ON public.questions(subconteudo_principal);

-- ============ FUNÇÃO DE CONTAGEM ============

CREATE OR REPLACE FUNCTION public.count_catalog_usage(_kind text, _name text)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE c bigint;
BEGIN
  IF _kind = 'area' THEN
    SELECT count(*) INTO c FROM public.questions WHERE area_geral = _name;
  ELSIF _kind = 'conteudo' THEN
    SELECT count(*) INTO c FROM public.questions WHERE conteudo_principal = _name;
  ELSIF _kind = 'subconteudo' THEN
    SELECT count(*) INTO c FROM public.questions WHERE subconteudo_principal = _name;
  ELSIF _kind = 'relacionado' THEN
    SELECT count(*) INTO c FROM public.questions WHERE _name = ANY(conteudos_relacionados);
  ELSIF _kind = 'tag' THEN
    SELECT count(*) INTO c FROM public.questions WHERE _name = ANY(tags_livres);
  ELSIF _kind = 'prova' THEN
    SELECT count(*) INTO c FROM public.questions WHERE prova = _name;
  ELSIF _kind = 'instituicao' THEN
    SELECT count(*) INTO c FROM public.questions WHERE instituicao = _name;
  ELSE
    c := 0;
  END IF;
  RETURN c;
END;
$$;
GRANT EXECUTE ON FUNCTION public.count_catalog_usage(text, text) TO anon, authenticated;
