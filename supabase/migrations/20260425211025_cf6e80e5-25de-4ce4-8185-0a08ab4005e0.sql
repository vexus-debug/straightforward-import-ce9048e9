
-- APPOINTMENTS
DROP POLICY IF EXISTS "Authenticated users can read appointments" ON public.appointments;
CREATE POLICY "Non-associate staff can read appointments"
ON public.appointments FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'associate_dentist'::app_role));

DROP POLICY IF EXISTS "Staff can update appointments" ON public.appointments;
CREATE POLICY "Staff can update appointments"
ON public.appointments FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'dentist'::app_role)
  OR public.has_role(auth.uid(), 'receptionist'::app_role)
  OR public.has_role(auth.uid(), 'assistant'::app_role)
  OR public.has_role(auth.uid(), 'hygienist'::app_role)
);

-- CLINICAL NOTES
DROP POLICY IF EXISTS "Authenticated users can read clinical_notes" ON public.clinical_notes;
CREATE POLICY "Non-associate staff can read clinical_notes"
ON public.clinical_notes FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'associate_dentist'::app_role));

-- DENTAL CHART ENTRIES
DROP POLICY IF EXISTS "Authenticated users can read dental_chart_entries" ON public.dental_chart_entries;
CREATE POLICY "Non-associate staff can read dental_chart_entries"
ON public.dental_chart_entries FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'associate_dentist'::app_role));

CREATE POLICY "Assoc dentist dental_chart_entries select"
ON public.dental_chart_entries FOR SELECT
USING (
  public.has_role(auth.uid(), 'associate_dentist'::app_role)
  AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = dental_chart_entries.patient_id AND p.created_by_staff_id = public.get_current_staff_id())
);

-- INVOICES
DROP POLICY IF EXISTS "Authenticated users can read invoices" ON public.invoices;
CREATE POLICY "Non-associate staff can read invoices"
ON public.invoices FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'associate_dentist'::app_role));

-- INVOICE ITEMS
DROP POLICY IF EXISTS "Authenticated users can read invoice_items" ON public.invoice_items;
CREATE POLICY "Non-associate staff can read invoice_items"
ON public.invoice_items FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'associate_dentist'::app_role));

CREATE POLICY "Assoc dentist invoice_items select"
ON public.invoice_items FOR SELECT
USING (
  public.has_role(auth.uid(), 'associate_dentist'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.patients p ON p.id = i.patient_id
    WHERE i.id = invoice_items.invoice_id AND p.created_by_staff_id = public.get_current_staff_id()
  )
);

-- PAYMENTS
DROP POLICY IF EXISTS "Authenticated users can read payments" ON public.payments;
CREATE POLICY "Non-associate staff can read payments"
ON public.payments FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'associate_dentist'::app_role));

-- PRESCRIPTIONS
DROP POLICY IF EXISTS "Authenticated users can read prescriptions" ON public.prescriptions;
CREATE POLICY "Non-associate staff can read prescriptions"
ON public.prescriptions FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'associate_dentist'::app_role));

-- LAB ORDERS
DROP POLICY IF EXISTS "Authenticated users can read lab_orders" ON public.lab_orders;
CREATE POLICY "Non-associate staff can read lab_orders"
ON public.lab_orders FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'associate_dentist'::app_role));

-- TREATMENT PLANS
DROP POLICY IF EXISTS "Authenticated users can read treatment_plans" ON public.treatment_plans;
CREATE POLICY "Non-associate staff can read treatment_plans"
ON public.treatment_plans FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'associate_dentist'::app_role));

CREATE POLICY "Assoc dentist treatment_plans select"
ON public.treatment_plans FOR SELECT
USING (
  public.has_role(auth.uid(), 'associate_dentist'::app_role)
  AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = treatment_plans.patient_id AND p.created_by_staff_id = public.get_current_staff_id())
);

-- PATIENT DOCUMENTS
DROP POLICY IF EXISTS "Authenticated users can read patient_documents" ON public.patient_documents;
CREATE POLICY "Non-associate staff can read patient_documents"
ON public.patient_documents FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'associate_dentist'::app_role));

CREATE POLICY "Assoc dentist patient_documents select"
ON public.patient_documents FOR SELECT
USING (
  public.has_role(auth.uid(), 'associate_dentist'::app_role)
  AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_documents.patient_id AND p.created_by_staff_id = public.get_current_staff_id())
);

-- PATIENT IMAGES
DROP POLICY IF EXISTS "Authenticated users can read patient_images" ON public.patient_images;
CREATE POLICY "Non-associate staff can read patient_images"
ON public.patient_images FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'associate_dentist'::app_role));

CREATE POLICY "Assoc dentist patient_images select"
ON public.patient_images FOR SELECT
USING (
  public.has_role(auth.uid(), 'associate_dentist'::app_role)
  AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_images.patient_id AND p.created_by_staff_id = public.get_current_staff_id())
);
