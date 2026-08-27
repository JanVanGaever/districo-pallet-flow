ALTER TABLE public.products ADD COLUMN IF NOT EXISTS favoriet boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS products_favoriet_idx ON public.products (favoriet) WHERE favoriet;