ALTER TABLE public.clinic_external_labs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.clinic_lab_work_types ALTER COLUMN id SET DEFAULT gen_random_uuid();