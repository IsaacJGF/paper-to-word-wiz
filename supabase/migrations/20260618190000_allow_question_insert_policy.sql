ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow question inserts from app" ON public.questions;

CREATE POLICY "Allow question inserts from app"
ON public.questions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
