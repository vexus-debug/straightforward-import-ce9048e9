-- Per-external-lab price list (payable-to-lab pricing, separate from clinic billing)
CREATE TABLE public.ld_external_lab_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_lab_id uuid NOT NULL REFERENCES public.ld_external_labs(id) ON DELETE CASCADE,
  work_type_name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_lab_id, work_type_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ld_external_lab_prices TO authenticated;
GRANT ALL ON public.ld_external_lab_prices TO service_role;

ALTER TABLE public.ld_external_lab_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ld_external_lab_prices"
  ON public.ld_external_lab_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ld_external_lab_prices"
  ON public.ld_external_lab_prices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update ld_external_lab_prices"
  ON public.ld_external_lab_prices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete ld_external_lab_prices"
  ON public.ld_external_lab_prices FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_ld_external_lab_prices_updated_at
  BEFORE UPDATE ON public.ld_external_lab_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-case override for the amount payable to the external lab.
-- NULL = fall back to the lab's configured price for the work type.
ALTER TABLE public.ld_cases
  ADD COLUMN IF NOT EXISTS external_lab_unit_price numeric;