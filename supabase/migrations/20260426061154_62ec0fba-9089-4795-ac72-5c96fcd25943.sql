
-- 1. Compensation strategy enum + column on staff
DO $$ BEGIN
  CREATE TYPE public.associate_compensation_strategy AS ENUM ('materials_excluded', 'materials_included');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS compensation_strategy public.associate_compensation_strategy;

COMMENT ON COLUMN public.staff.compensation_strategy IS
  'Associate dentist revenue share: materials_excluded=30% (uses our machines only), materials_included=70% (uses both machines and materials). NULL = not set.';

-- 2. Earnings table
CREATE TABLE IF NOT EXISTS public.associate_invoice_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  associate_staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  strategy public.associate_compensation_strategy NOT NULL,
  percentage NUMERIC(5,2) NOT NULL,
  invoice_amount NUMERIC(12,2) NOT NULL,
  earnings_amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_aie_associate ON public.associate_invoice_earnings(associate_staff_id);
CREATE INDEX IF NOT EXISTS idx_aie_patient ON public.associate_invoice_earnings(patient_id);
CREATE INDEX IF NOT EXISTS idx_aie_invoice ON public.associate_invoice_earnings(invoice_id);

ALTER TABLE public.associate_invoice_earnings ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies (drop-then-create to be idempotent)
DROP POLICY IF EXISTS "Admins, accountants, receptionists view all earnings" ON public.associate_invoice_earnings;
DROP POLICY IF EXISTS "Associates view own earnings" ON public.associate_invoice_earnings;
DROP POLICY IF EXISTS "Admins and accountants insert earnings" ON public.associate_invoice_earnings;
DROP POLICY IF EXISTS "Admins and accountants update earnings" ON public.associate_invoice_earnings;
DROP POLICY IF EXISTS "Admins and accountants delete earnings" ON public.associate_invoice_earnings;

CREATE POLICY "Admins, accountants, receptionists view all earnings"
ON public.associate_invoice_earnings
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role) OR
  public.has_role(auth.uid(), 'receptionist'::app_role)
);

CREATE POLICY "Associates view own earnings"
ON public.associate_invoice_earnings
FOR SELECT
USING (
  public.has_role(auth.uid(), 'associate_dentist'::app_role)
  AND associate_staff_id = public.get_current_staff_id()
);

CREATE POLICY "Admins and accountants insert earnings"
ON public.associate_invoice_earnings
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role)
);

CREATE POLICY "Admins and accountants update earnings"
ON public.associate_invoice_earnings
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role)
);

CREATE POLICY "Admins and accountants delete earnings"
ON public.associate_invoice_earnings
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'accountant'::app_role)
);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_aie_updated_at ON public.associate_invoice_earnings;
CREATE TRIGGER trg_aie_updated_at
BEFORE UPDATE ON public.associate_invoice_earnings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Trigger: on invoice insert, record associate earnings if applicable
CREATE OR REPLACE FUNCTION public.record_associate_invoice_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_staff_id UUID;
  strat public.associate_compensation_strategy;
  pct NUMERIC(5,2);
BEGIN
  -- Find the associate owner of this patient (if any)
  SELECT created_by_staff_id INTO owner_staff_id
  FROM public.patients
  WHERE id = NEW.patient_id;

  IF owner_staff_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Confirm that owner is an associate dentist with a strategy set
  SELECT s.compensation_strategy INTO strat
  FROM public.staff s
  JOIN public.user_roles ur ON ur.user_id = s.user_id
  WHERE s.id = owner_staff_id
    AND ur.role = 'associate_dentist'::app_role
    AND s.compensation_strategy IS NOT NULL
  LIMIT 1;

  IF strat IS NULL THEN
    RETURN NEW;
  END IF;

  pct := CASE strat
    WHEN 'materials_excluded' THEN 30
    WHEN 'materials_included' THEN 70
  END;

  INSERT INTO public.associate_invoice_earnings (
    invoice_id, associate_staff_id, patient_id, strategy, percentage,
    invoice_amount, earnings_amount
  ) VALUES (
    NEW.id, owner_staff_id, NEW.patient_id, strat, pct,
    COALESCE(NEW.total_amount, 0),
    ROUND(COALESCE(NEW.total_amount, 0) * pct / 100, 2)
  )
  ON CONFLICT (invoice_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_associate_earnings ON public.invoices;
CREATE TRIGGER trg_record_associate_earnings
AFTER INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.record_associate_invoice_earnings();

-- 5. Also recompute when total_amount changes on an invoice
CREATE OR REPLACE FUNCTION public.update_associate_invoice_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
    UPDATE public.associate_invoice_earnings
    SET invoice_amount = COALESCE(NEW.total_amount, 0),
        earnings_amount = ROUND(COALESCE(NEW.total_amount, 0) * percentage / 100, 2),
        updated_at = now()
    WHERE invoice_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_associate_earnings ON public.invoices;
CREATE TRIGGER trg_update_associate_earnings
AFTER UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_associate_invoice_earnings();
