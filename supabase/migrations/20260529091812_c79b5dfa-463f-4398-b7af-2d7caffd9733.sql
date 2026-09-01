CREATE TABLE public.invoice_breakdown_overrides (
  invoice_id UUID PRIMARY KEY REFERENCES public.invoices(id) ON DELETE CASCADE,
  examination NUMERIC,
  lab_cost NUMERIC,
  dental_sales NUMERIC,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_breakdown_overrides TO authenticated;
GRANT ALL ON public.invoice_breakdown_overrides TO service_role;

ALTER TABLE public.invoice_breakdown_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invoice breakdown overrides"
ON public.invoice_breakdown_overrides
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read invoice breakdown overrides"
ON public.invoice_breakdown_overrides
FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER trg_invoice_breakdown_overrides_updated_at
BEFORE UPDATE ON public.invoice_breakdown_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();