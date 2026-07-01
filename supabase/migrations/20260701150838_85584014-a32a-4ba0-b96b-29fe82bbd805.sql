-- Leveranciers (suppliers) voor leeggoed-afhaling
CREATE TABLE public.leveranciers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  naam text NOT NULL,
  plaats text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leveranciers TO anon, authenticated;
GRANT ALL ON public.leveranciers TO service_role;

ALTER TABLE public.leveranciers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo full access leveranciers" ON public.leveranciers FOR ALL USING (true) WITH CHECK (true);

-- Retours kunnen nu ook aan een leverancier hangen i.p.v. een klant
ALTER TABLE public.retours
  ADD COLUMN leverancier_id uuid REFERENCES public.leveranciers(id) ON DELETE SET NULL,
  ADD COLUMN type text NOT NULL DEFAULT 'klant';
ALTER TABLE public.retours ALTER COLUMN customer_id DROP NOT NULL;

-- Producten worden gekoppeld aan een leverancier (producent)
ALTER TABLE public.products ADD COLUMN leverancier text;

-- Seed bekende leveranciers
INSERT INTO public.leveranciers (naam, plaats) VALUES
  ('AB InBev', 'Leuven'),
  ('Alken-Maes', 'Mechelen'),
  ('Coca-Cola', 'Anderlecht'),
  ('Spadel', 'Spa'),
  ('Duvel Moortgat', 'Puurs'),
  ('Nestlé Waters', 'Brussel'),
  ('PepsiCo', 'Zaventem'),
  ('Danone', 'Brussel');

-- Koppel producten aan leverancier op basis van merk
UPDATE public.products SET leverancier = 'AB InBev'       WHERE merk IN ('Jupiler','Stella Artois','Leffe','Hoegaarden','Primus');
UPDATE public.products SET leverancier = 'Alken-Maes'     WHERE merk IN ('Maes','Cristal','Grimbergen');
UPDATE public.products SET leverancier = 'Coca-Cola'      WHERE merk IN ('Coca-Cola','Chaudfontaine','Schweppes');
UPDATE public.products SET leverancier = 'Spadel'         WHERE merk IN ('Spa','Bru');
UPDATE public.products SET leverancier = 'Duvel Moortgat' WHERE merk IN ('Duvel','Liefmans');
UPDATE public.products SET leverancier = 'Nestlé Waters'  WHERE merk IN ('San Pellegrino','Perrier','Vittel');
UPDATE public.products SET leverancier = 'PepsiCo'        WHERE merk IN ('Lipton');
UPDATE public.products SET leverancier = 'Danone'         WHERE merk IN ('Evian');