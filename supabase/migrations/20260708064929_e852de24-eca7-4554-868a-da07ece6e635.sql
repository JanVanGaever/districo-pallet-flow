CREATE TABLE public.voertuigen (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merk text NOT NULL,
  nummerplaat text NOT NULL,
  aantal_palletplaatsen integer NOT NULL DEFAULT 33,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voertuigen TO anon, authenticated;
GRANT ALL ON public.voertuigen TO service_role;

ALTER TABLE public.voertuigen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo full access voertuigen" ON public.voertuigen
  FOR ALL USING (true) WITH CHECK (true);