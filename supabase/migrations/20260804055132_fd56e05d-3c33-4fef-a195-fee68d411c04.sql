ALTER TABLE public.retours
  ADD COLUMN IF NOT EXISTS creditnota_nummer text,
  ADD COLUMN IF NOT EXISTS creditnota_at timestamp with time zone;