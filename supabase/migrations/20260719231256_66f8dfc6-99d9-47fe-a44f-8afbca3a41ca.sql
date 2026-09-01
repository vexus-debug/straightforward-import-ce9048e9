ALTER TABLE public.ld_cases
  ADD COLUMN IF NOT EXISTS external_lab_express_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_lab_discount numeric NOT NULL DEFAULT 0;