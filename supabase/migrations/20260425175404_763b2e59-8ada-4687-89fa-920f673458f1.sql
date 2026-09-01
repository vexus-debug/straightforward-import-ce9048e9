
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS staff_type text NOT NULL DEFAULT 'in_house',
  ADD COLUMN IF NOT EXISTS compensation_type text,
  ADD COLUMN IF NOT EXISTS compensation_percentage numeric,
  ADD COLUMN IF NOT EXISTS compensation_flat_amount numeric;

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_type_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_type_check
  CHECK (staff_type IN ('in_house', 'associate'));
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_compensation_type_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_compensation_type_check
  CHECK (compensation_type IS NULL OR compensation_type IN ('revenue_split', 'flat_fee'));

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS created_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_patients_created_by_staff ON public.patients(created_by_staff_id);

CREATE OR REPLACE FUNCTION public.get_current_staff_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.staff WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.tag_patient_owner_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  IF NEW.created_by_staff_id IS NULL AND public.has_role(auth.uid(), 'associate_dentist'::app_role) THEN
    sid := public.get_current_staff_id();
    IF sid IS NOT NULL THEN NEW.created_by_staff_id := sid; END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_tag_patient_owner ON public.patients;
CREATE TRIGGER trg_tag_patient_owner
  BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tag_patient_owner_on_insert();

-- Patients
CREATE POLICY "Assoc dentist view own patients" ON public.patients FOR SELECT
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND created_by_staff_id = public.get_current_staff_id());
CREATE POLICY "Assoc dentist insert patients" ON public.patients FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'associate_dentist'::app_role));
CREATE POLICY "Assoc dentist update own patients" ON public.patients FOR UPDATE
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND created_by_staff_id = public.get_current_staff_id());

-- Appointments
CREATE POLICY "Assoc dentist appts select" ON public.appointments FOR SELECT
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND staff_id = public.get_current_staff_id());
CREATE POLICY "Assoc dentist appts insert" ON public.appointments FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'associate_dentist'::app_role)
              AND staff_id = public.get_current_staff_id());
CREATE POLICY "Assoc dentist appts update" ON public.appointments FOR UPDATE
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND staff_id = public.get_current_staff_id());
CREATE POLICY "Assoc dentist appts delete" ON public.appointments FOR DELETE
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND staff_id = public.get_current_staff_id());

-- Prescriptions (patient-scoped)
CREATE POLICY "Assoc dentist rx select" ON public.prescriptions FOR SELECT
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = prescriptions.patient_id
                     AND p.created_by_staff_id = public.get_current_staff_id()));
CREATE POLICY "Assoc dentist rx insert" ON public.prescriptions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'associate_dentist'::app_role)
              AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = prescriptions.patient_id
                          AND p.created_by_staff_id = public.get_current_staff_id()));
CREATE POLICY "Assoc dentist rx update" ON public.prescriptions FOR UPDATE
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = prescriptions.patient_id
                     AND p.created_by_staff_id = public.get_current_staff_id()));

-- Clinical notes
CREATE POLICY "Assoc dentist notes select" ON public.clinical_notes FOR SELECT
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = clinical_notes.patient_id
                     AND p.created_by_staff_id = public.get_current_staff_id()));
CREATE POLICY "Assoc dentist notes insert" ON public.clinical_notes FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'associate_dentist'::app_role)
              AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = clinical_notes.patient_id
                          AND p.created_by_staff_id = public.get_current_staff_id()));
CREATE POLICY "Assoc dentist notes update" ON public.clinical_notes FOR UPDATE
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = clinical_notes.patient_id
                     AND p.created_by_staff_id = public.get_current_staff_id()));

-- Lab orders (also their own as the assigned dentist)
CREATE POLICY "Assoc dentist lab orders select" ON public.lab_orders FOR SELECT
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND (dentist_id = public.get_current_staff_id()
              OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = lab_orders.patient_id
                         AND p.created_by_staff_id = public.get_current_staff_id())));
CREATE POLICY "Assoc dentist lab orders insert" ON public.lab_orders FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'associate_dentist'::app_role)
              AND dentist_id = public.get_current_staff_id());
CREATE POLICY "Assoc dentist lab orders update" ON public.lab_orders FOR UPDATE
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND dentist_id = public.get_current_staff_id());

-- Invoices
CREATE POLICY "Assoc dentist invoices select" ON public.invoices FOR SELECT
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = invoices.patient_id
                     AND p.created_by_staff_id = public.get_current_staff_id()));

-- Payments
CREATE POLICY "Assoc dentist payments select" ON public.payments FOR SELECT
  USING (public.has_role(auth.uid(), 'associate_dentist'::app_role)
         AND EXISTS (SELECT 1 FROM public.invoices i
                     JOIN public.patients p ON p.id = i.patient_id
                     WHERE i.id = payments.invoice_id
                       AND p.created_by_staff_id = public.get_current_staff_id()));
