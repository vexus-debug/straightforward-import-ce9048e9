ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS has_indemnity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS indemnity_expiry date,
  ADD COLUMN IF NOT EXISTS indemnity_certificate_url text,
  ADD COLUMN IF NOT EXISTS indemnity_provider text,
  ADD COLUMN IF NOT EXISTS indemnity_policy_number text;