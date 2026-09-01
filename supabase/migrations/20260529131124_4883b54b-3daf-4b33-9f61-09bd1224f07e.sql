ALTER TABLE public.ld_invoice_items
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;

UPDATE public.ld_invoice_items item
SET amount_paid = LEAST(
  COALESCE(item.total_cost, 0),
  CASE
    WHEN c.is_paid THEN GREATEST(COALESCE(c.deposit_amount, 0), COALESCE(item.total_cost, 0))
    ELSE COALESCE(c.deposit_amount, 0)
  END
)
FROM public.ld_cases c
WHERE item.lab_case_id = c.id
  AND COALESCE(item.amount_paid, 0) = 0;

UPDATE public.ld_invoices inv
SET
  amount_paid = LEAST(inv.total_amount, COALESCE(case_payments.total_paid, 0) + COALESCE(invoice_payments.total_paid, 0)),
  deposit_amount = COALESCE(case_payments.total_paid, 0),
  status = CASE
    WHEN LEAST(inv.total_amount, COALESCE(case_payments.total_paid, 0) + COALESCE(invoice_payments.total_paid, 0)) >= inv.total_amount THEN 'paid'
    WHEN LEAST(inv.total_amount, COALESCE(case_payments.total_paid, 0) + COALESCE(invoice_payments.total_paid, 0)) > 0 THEN 'partial'
    ELSE 'unpaid'
  END
FROM (
  SELECT invoice_id, SUM(COALESCE(amount_paid, 0)) AS total_paid
  FROM public.ld_invoice_items
  GROUP BY invoice_id
) case_payments
LEFT JOIN (
  SELECT invoice_id, SUM(COALESCE(amount, 0)) AS total_paid
  FROM public.ld_payments
  WHERE invoice_id IS NOT NULL
  GROUP BY invoice_id
) invoice_payments ON invoice_payments.invoice_id = case_payments.invoice_id
WHERE inv.id = case_payments.invoice_id;