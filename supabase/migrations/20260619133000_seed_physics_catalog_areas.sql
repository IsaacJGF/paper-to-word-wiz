-- Cadastra áreas gerais de Física no catálogo pedagógico.
INSERT INTO public.catalog_areas (nome, ativo)
VALUES
  ('Fundamentos da Física', true),
  ('Mecânica', true),
  ('Fluidos', true),
  ('Termologia e Termodinâmica', true),
  ('Ondulatória', true),
  ('Óptica', true),
  ('Eletricidade', true),
  ('Magnetismo e Eletromagnetismo', true),
  ('Física Moderna', true),
  ('Física Nuclear e Radiações', true),
  ('Astronomia e Cosmologia', true),
  ('Física Experimental', true),
  ('Interdisciplinar e Aplicações Tecnológicas', true)
ON CONFLICT (nome) DO UPDATE
SET ativo = EXCLUDED.ativo,
    updated_at = now();
