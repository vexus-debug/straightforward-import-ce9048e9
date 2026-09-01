GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_external_labs TO authenticated;
GRANT ALL ON public.clinic_external_labs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_lab_work_types TO authenticated;
GRANT ALL ON public.clinic_lab_work_types TO service_role;