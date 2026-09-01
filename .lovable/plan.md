## Goal

On the lab dashboard's External Labs → Summary, "Amount owed to external lab" must be calculated from each external lab's **own** price list, not from the clinic-facing `lab_fee` on the case. Case-level overrides remain possible for discounts/remakes.

## Changes

### 1. Database (new migration)

Create `public.ld_external_lab_prices`:
- `id`, `external_lab_id` → `ld_external_labs(id) on delete cascade`
- `work_type_name` text (matches `ld_cases.work_type_name`; also usable via `ld_work_types.name`)
- `price` numeric NOT NULL default 0
- `notes` text
- `created_at`, `updated_at`
- Unique (`external_lab_id`, `work_type_name`)
- GRANTs for `authenticated` + `service_role`, RLS enabled, policies mirroring existing `ld_*` tables (authenticated can manage).

Add to `public.ld_cases`:
- `external_lab_unit_price numeric` (nullable) — per-case manual override of the payable-to-lab unit price. Left NULL means "use the external lab's configured price for this work type".

`lab_fee` on `ld_cases` stays unchanged (clinic billing / expected revenue).

### 2. UI — `src/pages/lab-dashboard/LdExternalLabsPage.tsx`

- In the **Partner Labs** tab, when a lab row is selected, show a "Price List" card underneath (mirrors the clinic-side pattern in `ClinicExternalLabsPage`):
  - List work types + prices for that lab
  - Add / edit / delete entries (work type name selectable from existing `ld_work_types`, price in ₦)
- On the outsource-case dialog, add an optional **"Payable to lab (override)"** input. When empty, the summary uses the lab's configured price for the case's work type.

### 3. Summary calculation — `src/components/lab-dashboard/LdOutsourceSummary.tsx`

Replace the current `caseValue` (which uses `lab_fee`) with:

```
unit = case.external_lab_unit_price
    ?? priceMap[case.external_lab_id][case.work_type_name]
    ?? 0
value = max(units * unit - discount, 0)
```

- Fetch `ld_external_lab_prices` for the year's labs and build the lookup map.
- Include `external_lab_unit_price` in the `ld_cases` select.
- Everything else (month/year buckets, paid, balance, drill-down) stays the same, just fed by the new value.

### 4. Hooks

Add a small hook module (e.g. `src/hooks/useLdExternalLabPrices.tsx`) with:
- `useLdExternalLabPrices(labId?)` — list
- `useUpsertLdExternalLabPrice`
- `useDeleteLdExternalLabPrice`

### 5. Out of scope

- Clinic dashboard's own external-lab page (`ClinicExternalLabsPage`) already has its own `clinic_lab_work_types` price table and is not affected.
- Existing `ld_cases.lab_fee` values are untouched; the summary just stops using them for lab-payable amounts.

## Result

- Expected clinic inflow: still driven by clinic billing (unchanged).
- Amount owed to external lab: `units × external lab's own price` (per work type), with per-case override for discounts / remakes / renegotiations.
- In the user's example: 2 Zirconia Crowns at lab price ₦30,000 → summary shows ₦60,000 payable, not ₦120,000.
