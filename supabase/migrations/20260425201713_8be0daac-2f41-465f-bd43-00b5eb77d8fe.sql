
-- 1. Add ownership columns
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS owner_type TEXT NOT NULL DEFAULT 'vista' CHECK (owner_type IN ('vista','associate')),
  ADD COLUMN IF NOT EXISTS associate_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL;

-- Default all existing patients to Vista (already covered by default, but be explicit)
UPDATE public.patients SET owner_type = 'vista' WHERE owner_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_patients_owner_type ON public.patients(owner_type);
CREATE INDEX IF NOT EXISTS idx_patients_associate_staff_id ON public.patients(associate_staff_id);

-- 2. Helper: is current user the associate owner of a patient row?
CREATE OR REPLACE FUNCTION public.is_patient_associate_owner(_associate_staff_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _associate_staff_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = _associate_staff_id AND user_id = auth.uid()
    )
$$;

-- 3. Drop the overly-broad SELECT policy and replace with portal-aware policies
DROP POLICY IF EXISTS "Authenticated users can read patients" ON public.patients;
DROP POLICY IF EXISTS "Assoc dentist view own patients" ON public.patients;
DROP POLICY IF EXISTS "Vista staff can read patients" ON public.patients;
DROP POLICY IF EXISTS "Associate dentists can read own patients" ON public.patients;

-- Vista-side staff can read all patient rows (contact masking is done in the view layer)
CREATE POLICY "Vista staff can read patients"
ON public.patients FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'dentist'::app_role)
  OR has_role(auth.uid(), 'receptionist'::app_role)
  OR has_role(auth.uid(), 'assistant'::app_role)
  OR has_role(auth.uid(), 'hygienist'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
);

-- Associate dentists can only read their own patients
CREATE POLICY "Associate dentists can read own patients"
ON public.patients FOR SELECT
USING (
  has_role(auth.uid(), 'associate_dentist'::app_role)
  AND owner_type = 'associate'
  AND public.is_patient_associate_owner(associate_staff_id)
);

-- 4. Central view used by Vista UI: masks contact info for associate-owned patients
CREATE OR REPLACE VIEW public.patients_central
WITH (security_invoker = on) AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  CASE WHEN p.owner_type = 'associate' AND NOT public.is_patient_associate_owner(p.associate_staff_id)
       THEN NULL ELSE p.email END AS email,
  CASE WHEN p.owner_type = 'associate' AND NOT public.is_patient_associate_owner(p.associate_staff_id)
       THEN NULL ELSE p.phone END AS phone,
  CASE WHEN p.owner_type = 'associate' AND NOT public.is_patient_associate_owner(p.associate_staff_id)
       THEN NULL ELSE p.address END AS address,
  CASE WHEN p.owner_type = 'associate' AND NOT public.is_patient_associate_owner(p.associate_staff_id)
       THEN NULL ELSE p.emergency_contact_name END AS emergency_contact_name,
  CASE WHEN p.owner_type = 'associate' AND NOT public.is_patient_associate_owner(p.associate_staff_id)
       THEN NULL ELSE p.emergency_contact_phone END AS emergency_contact_phone,
  p.gender,
  p.date_of_birth,
  p.blood_group,
  p.status,
  p.registered_date,
  p.owner_type,
  p.associate_staff_id,
  s.full_name AS associate_name,
  p.created_at,
  p.updated_at,
  COALESCE(
    (SELECT MAX(a.appointment_date) FROM public.appointments a WHERE a.patient_id = p.id),
    p.registered_date
  ) AS last_visit_date
FROM public.patients p
LEFT JOIN public.staff s ON s.id = p.associate_staff_id;

GRANT SELECT ON public.patients_central TO authenticated;
