ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS bakken_per_europallet integer,
  ADD COLUMN IF NOT EXISTS bakken_per_cheppallet integer;