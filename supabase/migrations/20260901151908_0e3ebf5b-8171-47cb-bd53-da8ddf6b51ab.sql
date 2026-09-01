CREATE POLICY "Clinic staff can read associate patients"
ON public.patients
FOR SELECT
TO authenticated
USING (
  owner_type = 'associate'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'dentist'::app_role)
    OR has_role(auth.uid(), 'receptionist'::app_role)
    OR has_role(auth.uid(), 'assistant'::app_role)
    OR has_role(auth.uid(), 'hygienist'::app_role)
  )
);