// Helpers for sharing prescriptions with patients via WhatsApp.

export interface ShareableMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface ShareablePrescription {
  patientName: string;
  dentistName: string;
  date: string;
  diagnosis?: string | null;
  notes?: string | null;
  medications: ShareableMedication[];
  clinicName?: string;
}

/** Build a clean, WhatsApp-friendly text version of a prescription. */
export function formatPrescriptionMessage(rx: ShareablePrescription): string {
  const lines: string[] = [];
  const clinic = rx.clinicName?.trim() || "Your Dental Clinic";
  lines.push(`*${clinic} — Prescription*`);
  lines.push("");
  lines.push(`Patient: ${rx.patientName}`);
  lines.push(`Dentist: Dr. ${rx.dentistName}`);
  lines.push(`Date: ${rx.date}`);
  if (rx.diagnosis) lines.push(`Diagnosis: ${rx.diagnosis}`);
  lines.push("");
  lines.push("*Medications:*");
  rx.medications.forEach((m, i) => {
    const parts = [m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ");
    lines.push(`${i + 1}. ${m.name}${parts ? ` — ${parts}` : ""}`);
  });
  if (rx.notes) {
    lines.push("");
    lines.push(`Notes: ${rx.notes}`);
  }
  lines.push("");
  lines.push("Please follow the dosage as prescribed. Contact us if you have any questions.");
  return lines.join("\n");
}

/** Normalise a phone number for use in a wa.me link (digits only). */
export function normalisePhoneForWhatsApp(phone?: string | null): string {
  if (!phone) return "";
  return phone.replace(/[^\d]/g, "");
}

/** Open WhatsApp (web/app) with a pre-filled prescription message. */
export function shareViaWhatsApp(phone: string | null | undefined, message: string) {
  const digits = normalisePhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(message);
  const url = digits
    ? `https://wa.me/${digits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
