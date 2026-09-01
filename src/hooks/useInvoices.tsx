import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InvoiceWithPatient {
  id: string;
  invoice_number: string;
  patient_id: string;
  invoice_date: string;
  status: string;
  discount_percent: number;
  payment_method: string;
  total_amount: number;
  amount_paid: number;
  notes: string;
  created_at: string;
  patient_name: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  treatment_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, patients(first_name, last_name)")
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data || []).map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        patient_id: inv.patient_id,
        invoice_date: inv.invoice_date,
        status: inv.status,
        discount_percent: inv.discount_percent,
        payment_method: inv.payment_method,
        total_amount: inv.total_amount,
        amount_paid: inv.amount_paid,
        notes: inv.notes,
        created_at: inv.created_at,
        patient_name: inv.patients
          ? `${inv.patients.first_name} ${inv.patients.last_name}`
          : "Unknown",
      })) as InvoiceWithPatient[];
    },
  });
}

export function useInvoiceItems(invoiceId: string | null) {
  return useQuery({
    queryKey: ["invoice_items", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId!);
      if (error) throw error;
      return data as InvoiceItem[];
    },
  });
}

export function useBillingStats() {
  return useQuery({
    queryKey: ["billing_stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      // Collected today - sum of payments made today
      const { data: todayPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("payment_date", today);
      const collectedToday = (todayPayments || []).reduce((s, p) => s + Number(p.amount), 0);

      // Outstanding - sum of (total - paid) for non-paid invoices
      const { data: outstanding } = await supabase
        .from("invoices")
        .select("total_amount, amount_paid")
        .neq("status", "paid");
      const totalOutstanding = (outstanding || []).reduce(
        (s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)),
        0
      );

      // Overdue - pending invoices older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .lt("invoice_date", thirtyDaysAgo.toISOString().split("T")[0]);

      return { collectedToday, totalOutstanding, overdueCount: count || 0 };
    },
  });
}

interface CreateInvoiceInput {
  patient_id: string;
  discount_percent: number;
  payment_method: string;
  amount_paid: number;
  notes?: string;
  line_items: {
    treatment_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const subtotal = input.line_items.reduce((s, i) => s + i.line_total, 0);
      const discountAmount = (subtotal * input.discount_percent) / 100;
      const total = subtotal - discountAmount;
      const paid = Math.min(input.amount_paid, total);
      const status = paid >= total ? "paid" : paid > 0 ? "partial" : "pending";

      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: "TEMP",
          patient_id: input.patient_id,
          discount_percent: input.discount_percent,
          payment_method: input.payment_method,
          total_amount: total,
          amount_paid: paid,
          status,
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (invError) throw invError;

      const items = input.line_items.map((li) => ({
        invoice_id: invoice.id,
        treatment_id: li.treatment_id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: li.line_total,
      }));
      const { error: itemsError } = await supabase.from("invoice_items").insert(items);
      if (itemsError) throw itemsError;

      if (paid > 0) {
        const { error: payError } = await supabase.from("payments").insert({
          invoice_id: invoice.id,
          amount: paid,
          payment_method: input.payment_method,
        });
        if (payError) throw payError;
      }

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing_stats"] });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      // Delete related records first: payments, invoice_items, then the invoice
      const { error: payErr } = await supabase.from("payments").delete().eq("invoice_id", invoiceId);
      if (payErr) throw payErr;
      const { error: itemsErr } = await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
      if (itemsErr) throw itemsErr;
      const { error: invErr } = await supabase.from("invoices").delete().eq("id", invoiceId);
      if (invErr) throw invErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing_stats"] });
      queryClient.invalidateQueries({ queryKey: ["invoice_items"] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      discount_percent,
      notes,
      line_items,
    }: {
      id: string;
      discount_percent: number;
      notes: string;
      line_items: {
        id?: string;
        treatment_id: string | null;
        description: string;
        quantity: number;
        unit_price: number;
        line_total: number;
      }[];
    }) => {
      // REVISION POLICY: never mutate a saved invoice. Instead, create a NEW
      // invoice that duplicates the original with the edits applied. The old
      // invoice and its payment history remain untouched as the audit trail.
      const subtotal = line_items.reduce((s, i) => s + i.line_total, 0);
      const discountAmount = (subtotal * discount_percent) / 100;
      const total = subtotal - discountAmount;

      // Fetch the original invoice for context (patient, payment method, number)
      const { data: original, error: origErr } = await supabase
        .from("invoices")
        .select("patient_id, payment_method, invoice_number")
        .eq("id", id)
        .single();
      if (origErr) throw origErr;

      const revisionNote = `Revision of ${original.invoice_number}.${notes ? " " + notes : ""}`;

      // Insert the duplicate invoice (unpaid — payments stay on original)
      const { data: newInvoice, error: invError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: "TEMP",
          patient_id: original.patient_id,
          discount_percent,
          payment_method: original.payment_method,
          total_amount: total,
          amount_paid: 0,
          status: "pending",
          notes: revisionNote,
        })
        .select()
        .single();
      if (invError) throw invError;

      const items = line_items.map((li) => ({
        invoice_id: newInvoice.id,
        treatment_id: li.treatment_id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: li.line_total,
      }));
      const { error: itemsError } = await supabase.from("invoice_items").insert(items);
      if (itemsError) throw itemsError;

      return newInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice_items"] });
      queryClient.invalidateQueries({ queryKey: ["billing_stats"] });
    },
  });
}
