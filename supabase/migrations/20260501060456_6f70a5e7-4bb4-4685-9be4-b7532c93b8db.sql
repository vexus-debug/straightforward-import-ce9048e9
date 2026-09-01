-- 1. Clinic-side External Labs registry
CREATE TABLE IF NOT EXISTS public.clinic_external_labs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  specialties TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_external_labs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view clinic external labs"
  ON public.clinic_external_labs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage clinic external labs"
  ON public.clinic_external_labs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_clinic_external_labs_updated_at
  BEFORE UPDATE ON public.clinic_external_labs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Lab work-type catalogue (per external lab, with editable prices)
CREATE TABLE IF NOT EXISTS public.clinic_lab_work_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_lab_id UUID NOT NULL REFERENCES public.clinic_external_labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (external_lab_id, name)
);

CREATE INDEX IF NOT EXISTS idx_clinic_lab_work_types_lab
  ON public.clinic_lab_work_types(external_lab_id);

ALTER TABLE public.clinic_lab_work_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view lab work types"
  ON public.clinic_lab_work_types FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage lab work types"
  ON public.clinic_lab_work_types FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_clinic_lab_work_types_updated_at
  BEFORE UPDATE ON public.clinic_lab_work_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add external_lab_id link to existing lab_orders (kept lab_name for back-compat)
ALTER TABLE public.lab_orders
  ADD COLUMN IF NOT EXISTS external_lab_id UUID REFERENCES public.clinic_external_labs(id) ON DELETE SET NULL;

-- 4. Multiple work-type line items per lab order
CREATE TABLE IF NOT EXISTS public.lab_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id UUID NOT NULL REFERENCES public.lab_orders(id) ON DELETE CASCADE,
  work_type_id UUID REFERENCES public.clinic_lab_work_types(id) ON DELETE SET NULL,
  work_type_name TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_order_items_order
  ON public.lab_order_items(lab_order_id);

ALTER TABLE public.lab_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view lab order items"
  ON public.lab_order_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert lab order items"
  ON public.lab_order_items FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update lab order items"
  ON public.lab_order_items FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated can delete lab order items"
  ON public.lab_order_items FOR DELETE
  TO authenticated USING (true);