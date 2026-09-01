const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const roundLdCurrency = (value: number) => round2(value);

export const getLdCaseDate = (labCase: any) => new Date(labCase.received_date || labCase.created_at);

export const getLdCaseUnits = (labCase: any) => Math.max(Number(labCase.tooth_number) || 1, 1);

export const getLdEffectiveUnitPrice = (labCase: any) => {
  const units = getLdCaseUnits(labCase);
  const storedUnitPrice = Number(labCase.lab_fee || 0);
  const discount = Math.max(Number(labCase.discount || 0), 0);

  if (storedUnitPrice > 0) {
    return Math.max(storedUnitPrice - discount / units, 0);
  }

  const fallbackTotal = Math.max(Number(labCase.net_amount || 0), 0);
  return units > 0 ? fallbackTotal / units : 0;
};

export const getLdCaseCommissionBase = (labCase: any) => round2(getLdEffectiveUnitPrice(labCase) * getLdCaseUnits(labCase));

/**
 * Returns the per-unit price to use for STAFF % ALLOCATION / SALARY calculations only.
 * Resolution order:
 *   1. client-specific allocation_price (ld_client_prices.allocation_price for that work_type, currently effective)
 *   2. work-type allocation_price (ld_work_types.allocation_price)
 *   3. fallback to the normal effective unit price (lab_fee/net_amount minus discount)
 *
 * Invoices and billing must keep using getLdEffectiveUnitPrice — never call this for invoice math.
 */
export const getLdAllocationUnitPrice = (
  labCase: any,
  workTypes: any[] = [],
  clientPrices: any[] = [],
): number => {
  const workTypeId = labCase.work_type_id;
  const clientId = labCase.client_id;
  const caseDate = getLdCaseDate(labCase);

  if (workTypeId && clientId) {
    const match = (clientPrices || []).find((p: any) => {
      if (p.client_id !== clientId || p.work_type_id !== workTypeId) return false;
      if (p.allocation_price == null || Number(p.allocation_price) <= 0) return false;
      const from = p.effective_from ? new Date(p.effective_from) : null;
      const to = p.effective_to ? new Date(p.effective_to) : null;
      if (from && caseDate < from) return false;
      if (to && caseDate > to) return false;
      return true;
    });
    if (match) return Number(match.allocation_price);
  }

  if (workTypeId) {
    const wt = (workTypes || []).find((w: any) => w.id === workTypeId);
    if (wt && wt.allocation_price != null && Number(wt.allocation_price) > 0) {
      return Number(wt.allocation_price);
    }
  }

  return getLdEffectiveUnitPrice(labCase);
};

export const isLdTechnicianRole = (staffMember: any) => {
  const roleText = `${staffMember?.role || ""} ${staffMember?.specialty || ""}`.toLowerCase();
  if (
    roleText.includes("technician") ||
    roleText.includes("technologist") ||
    roleText.includes("technology")
  ) {
    return true;
  }
  // Treat anyone whose specialty marks them as a lab Supervisor (i.e. a working
  // chief tech, not the standalone "Supervisor" oversight role) as a technician
  // for output allocation: they only earn output on cases assigned to them.
  const specialty = `${staffMember?.specialty || ""}`.toLowerCase();
  if (specialty.includes("supervisor")) return true;
  return false;
};

export function getLdCountableCases(
  cases: any[],
  periodStart: Date,
  periodEnd: Date,
  paidOnly: boolean = false,
) {
  const supersededCaseIds = new Set(
    (cases || [])
      .map((labCase: any) => labCase.repeat_of_case_id)
      .filter(Boolean),
  );

  const seenCaseIds = new Set<string>();

  return (cases || []).filter((labCase: any) => {
    const caseDate = getLdCaseDate(labCase);
    if (caseDate < periodStart || caseDate > periodEnd) return false;
    if (paidOnly && !labCase.is_paid) return false;
    if (supersededCaseIds.has(labCase.id)) return false;
    if (seenCaseIds.has(labCase.id)) return false;

    seenCaseIds.add(labCase.id);
    return true;
  });
}