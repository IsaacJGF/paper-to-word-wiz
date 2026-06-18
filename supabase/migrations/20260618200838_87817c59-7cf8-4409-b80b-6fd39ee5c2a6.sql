alter table public.questions
  add column if not exists enunciado_imagem text,
  add column if not exists enunciado_imagem_pos text;