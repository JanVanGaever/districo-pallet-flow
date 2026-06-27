
-- ENUMS
CREATE TYPE public.pallet_status AS ENUM ('aangemaakt', 'klaar_voor_retour', 'ontvangen');
CREATE TYPE public.pallet_soort AS ENUM ('vol', 'mixed');
CREATE TYPE public.audit_type AS ENUM ('aangemaakt', 'ontvangen', 'foto_toegevoegd', 'product_gewijzigd', 'pallettype_gewijzigd');

-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  naam TEXT NOT NULL,
  klantnummer TEXT NOT NULL,
  plaats TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO anon, authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

-- PRODUCTS
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  naam TEXT NOT NULL,
  categorie TEXT NOT NULL,
  leeggoedwaarde_per_bak NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access products" ON public.products FOR ALL USING (true) WITH CHECK (true);

-- PALLET TYPES
CREATE TABLE public.pallet_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  naam TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pallet_types TO anon, authenticated;
GRANT ALL ON public.pallet_types TO service_role;
ALTER TABLE public.pallet_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access pallet_types" ON public.pallet_types FOR ALL USING (true) WITH CHECK (true);

-- RETOURS
CREATE TABLE public.retours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  retournummer TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retours TO anon, authenticated;
GRANT ALL ON public.retours TO service_role;
ALTER TABLE public.retours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access retours" ON public.retours FOR ALL USING (true) WITH CHECK (true);

-- PALLETS
CREATE TABLE public.pallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  palletnummer TEXT NOT NULL,
  retour_id UUID NOT NULL REFERENCES public.retours(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  pallet_type_id UUID REFERENCES public.pallet_types(id),
  soort public.pallet_soort NOT NULL DEFAULT 'vol',
  status public.pallet_status NOT NULL DEFAULT 'aangemaakt',
  qr_payload TEXT,
  positie INT NOT NULL DEFAULT 1,
  totaal INT NOT NULL DEFAULT 1,
  ontvangen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pallets TO anon, authenticated;
GRANT ALL ON public.pallets TO service_role;
ALTER TABLE public.pallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access pallets" ON public.pallets FOR ALL USING (true) WITH CHECK (true);

-- PALLET PHOTOS
CREATE TABLE public.pallet_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pallet_id UUID NOT NULL REFERENCES public.pallets(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pallet_photos TO anon, authenticated;
GRANT ALL ON public.pallet_photos TO service_role;
ALTER TABLE public.pallet_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access pallet_photos" ON public.pallet_photos FOR ALL USING (true) WITH CHECK (true);

-- AUDIT EVENTS
CREATE TABLE public.audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pallet_id UUID NOT NULL REFERENCES public.pallets(id) ON DELETE CASCADE,
  type public.audit_type NOT NULL,
  actor TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_events TO anon, authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access audit_events" ON public.audit_events FOR ALL USING (true) WITH CHECK (true);

-- REALTIME
ALTER TABLE public.pallets REPLICA IDENTITY FULL;
ALTER TABLE public.retours REPLICA IDENTITY FULL;
ALTER TABLE public.pallet_photos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.retours;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pallet_photos;

-- SEQUENCE for nice numbers
CREATE SEQUENCE public.retour_seq START 145;
CREATE SEQUENCE public.pallet_seq START 1;

-- SEED DATA
INSERT INTO public.customers (naam, klantnummer, plaats) VALUES
  ('Drinxit Kapellen', '3014', 'Kapellen'),
  ('Drinxit Brasschaat', '3015', 'Brasschaat'),
  ('Drankenhandel Swinnen', '3145', 'Lier');

INSERT INTO public.products (naam, categorie, leeggoedwaarde_per_bak) VALUES
  ('Jupiler', 'bier', 4.50),
  ('Maes', 'bier', 4.50),
  ('Vedett', 'bier', 6.00),
  ('Leffe', 'bier', 7.00),
  ('Liefmans', 'bier', 7.00),
  ('Spa Rood', 'water', 6.00),
  ('Spa Blauw', 'water', 6.00),
  ('Coca-Cola', 'frisdrank', 6.35),
  ('Fanta', 'frisdrank', 6.35);

INSERT INTO public.pallet_types (naam) VALUES ('Europallet'), ('CHEP'), ('Wegwerppallet');
