
DROP POLICY IF EXISTS "Admins manage clinic external labs" ON public.clinic_external_labs;
CREATE POLICY "Staff manage clinic external labs"
ON public.clinic_external_labs
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lab_manager'::app_role)
  OR has_role(auth.uid(), 'receptionist'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lab_manager'::app_role)
  OR has_role(auth.uid(), 'receptionist'::app_role)
);

DROP POLICY IF EXISTS "Admins manage lab work types" ON public.clinic_lab_work_types;
CREATE POLICY "Staff manage lab work types"
ON public.clinic_lab_work_types
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lab_manager'::app_role)
  OR has_role(auth.uid(), 'receptionist'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lab_manager'::app_role)
  OR has_role(auth.uid(), 'receptionist'::app_role)
);
