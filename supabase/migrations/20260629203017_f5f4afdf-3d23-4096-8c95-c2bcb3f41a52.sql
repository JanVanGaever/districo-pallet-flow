-- Extend products table with richer fields from the Districo product list
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS subgroep text,
  ADD COLUMN IF NOT EXISTS merk text,
  ADD COLUMN IF NOT EXISTS verpakkingstype text,
  ADD COLUMN IF NOT EXISTS inhoud text,
  ADD COLUMN IF NOT EXISTS verkoopvorm text,
  ADD COLUMN IF NOT EXISTS aantal_per_bak integer,
  ADD COLUMN IF NOT EXISTS leeggoed_per_stuk numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS herbruikbaar boolean NOT NULL DEFAULT false;

-- Unique product code so imports can upsert by code
CREATE UNIQUE INDEX IF NOT EXISTS products_code_key ON public.products (code) WHERE code IS NOT NULL;