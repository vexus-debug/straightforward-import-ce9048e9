ALTER TABLE public.ld_work_types ADD COLUMN IF NOT EXISTS allocation_price numeric;
ALTER TABLE public.ld_client_prices ADD COLUMN IF NOT EXISTS allocation_price numeric;
COMMENT ON COLUMN public.ld_work_types.allocation_price IS 'Optional override price used ONLY for staff % allocation/salary calculations. Invoices keep using base_price.';
COMMENT ON COLUMN public.ld_client_prices.allocation_price IS 'Optional override price used ONLY for staff % allocation/salary calculations. Invoices keep using custom_price.';