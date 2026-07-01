ALTER TABLE public.pallets
  ADD COLUMN IF NOT EXISTS opgegeven_aantal integer,
  ADD COLUMN IF NOT EXISTS gecontroleerd_aantal integer,
  ADD COLUMN IF NOT EXISTS gewogen_gewicht numeric,
  ADD COLUMN IF NOT EXISTS verwacht_gewicht numeric,
  ADD COLUMN IF NOT EXISTS ontvangen_door text,
  ADD COLUMN IF NOT EXISTS klant_handtekening text;