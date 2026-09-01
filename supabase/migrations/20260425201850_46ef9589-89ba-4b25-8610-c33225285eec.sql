
-- Tighten Vista staff base-table access: only Vista-owned patients
DROP POLICY IF EXISTS "Vista staff can read patients" ON public.patients;

CREATE POLICY "Vista staff can read vista patients"
ON public.patients FOR SELECT
USING (
  owner_type = 'vista'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'dentist'::app_role)
    OR has_role(auth.uid(), 'receptionist'::app_role)
    OR has_role(auth.uid(), 'assistant'::app_role)
    OR has_role(auth.uid(), 'hygienist'::app_role)
    OR has_role(auth.uid(), 'accountant'::app_role)
  )
);

-- Recreate the central view as security-definer so Vista staff can see
-- associate-owned rows (with contact fields masked) without having direct
-- base-table access to those rows.
DROP VIEW IF EXISTS public.patients_central;

CREATE VIEW public.patients_central
WITH (security_invoker = off) AS
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
