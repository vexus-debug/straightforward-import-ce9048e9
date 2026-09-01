import type { HelpSection } from "@/components/lab-dashboard/StatsHelpButton";

export const HOME_HELP: { intro: string; sections: HelpSection[] } = {
  intro: "The Home dashboard is a real-time snapshot of your lab. Numbers update as cases move, invoices are issued, and payments arrive. Use it as your morning glance — drill into the dedicated pages for detail.",
  sections: [
    {
      title: "Primary Stats (top row)",
      what: "Quick counts of the most important operational numbers: Total Cases, In Progress, Ready / Delivered, and Urgent.",
      how: "Counts are taken from the ld_cases table across all time. 'In Progress' = status not in (delivered). 'Urgent' = cases flagged is_urgent and not yet delivered.",
      read: "If 'Urgent' is high, prioritise those first. If 'In Progress' keeps growing while 'Delivered' is flat, you have a throughput bottleneck.",
    },
    {
      title: "Lab Revenue card",
      what: "Total Revenue (all time billed), This Month (billed this calendar month), Collected (paid so far), Outstanding (unpaid balance).",
      how: "Total Revenue = sum of every invoice's total_amount. Collected = sum of amount_paid. Outstanding = Total − Collected (never below 0). 'This Month' filters invoices whose invoice_date is on/after the 1st of the current month.",
      read: "Compare Collected vs Total. The progress bar is your collection rate — anything below ~80% means follow-ups are overdue.",
    },
    {
      title: "Completion Rate ring",
      what: "Percentage of all cases that have reached 'delivered' status.",
      how: "delivered cases ÷ total cases × 100, rounded.",
      read: "A healthy lab usually sits at 70–90%. A sharp drop means cases are stuck mid-pipeline.",
    },
    {
      title: "Active Clients & Active Staff",
      what: "Number of clients with status 'active' and staff with status 'active'.",
      how: "Direct count from ld_clients / ld_staff where status = 'active'.",
      read: "If active clients drops, churn is happening. Cross-check with the Clients page.",
    },
    {
      title: "Urgent / Overdue / Upcoming lists",
      what: "Three lists of cases needing attention.",
      how: "Urgent = is_urgent flag, not delivered. Overdue = due_date in the past, not delivered/ready. Upcoming = due_date in the future, not delivered, sorted nearest first. Each list shows the top 5.",
      read: "These are your action queues. Overdue cases are the most damaging to client trust — clear those first.",
    },
  ],
};

export const ANALYTICS_HELP: { intro: string; sections: HelpSection[] } = {
  intro: "Analytics lets you slice case and revenue data by date range. The charts react to whatever date window you pick.",
  sections: [
    {
      title: "Date Range filter",
      what: "Defines the window every chart and stat below uses.",
      how: "Quick buttons set From/To automatically. You can also type custom dates. Cases are filtered by received_date, invoices by invoice_date.",
      read: "Always confirm the window before reading — 'All Time' inflates numbers vs a single month.",
    },
    {
      title: "Total / Active / Completed Cases & Revenue",
      what: "Four headline counts for the chosen window.",
      how: "Total = all ld_cases in the window. Active = status pending or in-progress. Completed = status completed/delivered/ready. Revenue = sum of invoice total_amount in the window.",
      read: "Active + Completed should roughly equal Total. If not, some cases are in other statuses (cancelled, on-hold).",
    },
    {
      title: "Status distribution chart",
      what: "Pie/bar of how cases break down by status.",
      how: "Count of cases grouped by their current status field.",
      read: "Use to spot pipeline bottlenecks — a fat 'in-progress' slice means work is piling up.",
    },
    {
      title: "Top Work Types chart",
      what: "Top 6 work types by case count for the window.",
      how: "Cases grouped by work_type_name, sorted descending, top 6 shown.",
      read: "Tells you where your volume comes from. Combine with pricing to see where margin lives.",
    },
    {
      title: "Monthly Revenue trend",
      what: "Invoice value totaled by month.",
      how: "Invoices grouped by the YYYY-MM of their invoice_date and summed.",
      read: "Look for trend, not single spikes. Three months of decline = a real problem.",
    },
  ],
};

export const REPORTS_HELP: { intro: string; sections: HelpSection[] } = {
  intro: "Reports is the financial source of truth: P&L, work type performance, client sales, expenses, and staff revenue allocation. Each tab answers a different business question.",
  sections: [
    {
      title: "Top summary strip",
      what: "Total Billed, Total Collected, Total Expenses, Credits Issued, Total Cases for the selected month.",
      how: "Billed = sum of invoice totals. Collected = sum of amount_paid. Expenses = sum of ld_expenses. Credits = sum of ld_credit_notes where type='credit'. Cases = count of received cases that month.",
      read: "Billed − Collected = your receivables risk. Billed − Expenses ≈ gross profit (refined in P&L tab).",
    },
    {
      title: "P&L Stock tab",
      what: "Profit & loss with stock-in/stock-out adjustments.",
      how: "Revenue (collected) − Expenses ± inventory movements gives net profit for the period.",
      read: "Net profit positive = you're above water. Compare margin % across months to spot trends.",
    },
    {
      title: "By Work Type tab",
      what: "Breakdown of units, revenue, and average price per unit per work type.",
      how: "Cases grouped by work type, units summed from tooth_number, revenue from each case's net amount.",
      read: "Top 5 are highlighted as 'TOP'. Drop a top performer? Investigate why volume fell.",
    },
    {
      title: "By Client tab",
      what: "Each client's case count, billed, paid, and outstanding for the period.",
      how: "Cases joined to clients, summed per client.",
      read: "Outstanding balances flag who needs collections. Big billed + small paid = warning sign.",
    },
    {
      title: "Revenue Alloc tab",
      what: "How the period's case value flows to staff salaries.",
      how: "Staff Commission Base = sum of (allocation unit price × tooth count) for every assigned case. From it: 20% Output Base, 10% Basic Base, 70% Remaining for the lab. Unassigned cases are excluded and shown separately as Extras.",
      read: "Technicians earn output by units they're assigned. Manager/Supervisor roles earn output across all assigned cases. Basic % is fixed by config.",
    },
    {
      title: "Trends tab",
      what: "Multi-month line view of revenue, expenses, profit.",
      how: "Aggregates the last 3/6/12 months from invoices and expenses.",
      read: "Direction matters more than absolute values — flat or rising is healthy.",
    },
  ],
};

export const TECH_PERFORMANCE_HELP: { intro: string; sections: HelpSection[] } = {
  intro: "Technician Performance shows how each technician is producing — units done, on-time rate, repeat rate, and earnings.",
  sections: [
    {
      title: "Cases & Units",
      what: "Total cases assigned to the technician and total tooth units they cover.",
      how: "Cases where assigned_technician_id = this tech in the period. Units = sum of tooth_number per case.",
      read: "Units > cases means they handle multi-unit jobs (bridges, dentures). Pure count understates workload.",
    },
    {
      title: "On-Time Rate",
      what: "Percentage of their delivered cases that met the due_date.",
      how: "(delivered cases with delivered_date ≤ due_date) ÷ total delivered × 100.",
      read: "Aim for 90%+. Below 70% means scheduling or capacity issue.",
    },
    {
      title: "Repeat / Remake Rate",
      what: "Share of their cases that came back as repeats or remakes.",
      how: "Cases where remark = Repeat/Remake or repeat_of_case_id is set, with original_technician_id matching this tech.",
      read: "Lower is better. Anything above ~5% deserves a quality conversation.",
    },
    {
      title: "Output Earnings",
      what: "What the technician earned from output (variable pay) in the period.",
      how: "For each assigned case: allocation unit price × 20% × output% × units. Shared allocations transfer a portion to the helper tech.",
      read: "Should track units. Big units, low earnings = check their output% in salary config.",
    },
    {
      title: "Basic Earnings",
      what: "Their fixed share of the basic pool.",
      how: "10% of the staff commission base × the technician's basic %.",
      read: "Basic is paid even on cases they didn't touch — that's the design.",
    },
    {
      title: "Total Earnings (and deductions)",
      what: "Final take-home after lateness, loans, and any bonuses.",
      how: "Basic + Output − Repeat penalty − Shared Debit + Shared Credit − Lateness − Loan + Bonus, never below 0.",
      read: "If Total drops sharply, scroll down — penalties or loans likely hit them.",
    },
  ],
};

export const SALARY_HELP: { intro: string; sections: HelpSection[] } = {
  intro: "Staff Salary Allocation turns the period's case value into each staff member's pay packet. Unassigned cases do NOT pay anyone — they sit in Extras.",
  sections: [
    {
      title: "Total Revenue",
      what: "The Staff Commission Base — the value of all assigned cases used for salary maths.",
      how: "Sum of (allocation unit price × tooth units) for every case assigned to a technician in the period. Allocation price comes from client-specific price → work type price → fallback case price.",
      read: "This is NOT invoice revenue. It's the salary-only valuation. Differs from Reports → Total Billed.",
    },
    {
      title: "Output Base (20%)",
      what: "The pool that funds variable pay (technicians earn from this).",
      how: "Total Revenue × 20%.",
      read: "Technicians earn from this in proportion to units they were assigned. Output% in their config controls their share.",
    },
    {
      title: "Basic Base (10%)",
      what: "The pool that funds fixed monthly pay.",
      how: "Total Revenue × 10%.",
      read: "Each staff's Basic% (set in Edit Percentages) determines their slice. The whole lab's Basic% must sum to 100%.",
    },
    {
      title: "Assigned Cases",
      what: "Number of cases that were assigned to a technician in the period.",
      how: "Count of unique ld_cases in the period where assigned_technician_id is set.",
      read: "Unassigned cases are excluded from all salary maths — assign them on the Cases page if they should pay someone.",
    },
    {
      title: "Salary Breakdown table",
      what: "Per-staff: Basic Salary, Output, Lateness, Loan, Total.",
      how: "Basic Salary = Basic Pool × Basic%. Output = sum across each assigned case (techs: unit price × 20% × output% × units; non-techs like Manager: case output pool × output%). Lateness/Loan = sum of deductions logged for the period. Total = Basic + Output − penalties + bonuses, never below 0.",
      read: "If Total looks wrong, click into the staff and check: are their %s right? Is a deduction logged? Are they assigned to enough cases?",
    },
    {
      title: "70% Remaining Breakdown",
      what: "What happens to the 70% that isn't basic or output.",
      how: "Total Revenue × 70%, split by the categories you set (rent, utilities, owner profit, etc.).",
      read: "The percentages must sum to 100% of the remaining pool. Edit categories under Settings.",
    },
    {
      title: "Work Type breakdowns",
      what: "Same maths, but split per work type so you can see which products fund payroll.",
      how: "For each work type: case count, units, total value, basic and output pools, and per-staff allocation from those pools.",
      read: "Helpful when planning capacity — drop a low-margin work type and watch how payroll funding shifts.",
    },
  ],
};

export const CLIENT_STATEMENTS_HELP: { intro: string; sections: HelpSection[] } = {
  intro: "Client Statements is the receivables view — what each client has been billed, paid, and owes you, plus their full transaction history.",
  sections: [
    {
      title: "Per-client header (Billed / Paid / Balance)",
      what: "Lifetime totals for the selected client.",
      how: "Billed = sum of all invoice totals for that client. Paid = sum of payments received. Balance = Billed − Paid − Credits.",
      read: "Positive balance = they owe you. Negative = credit on their account.",
    },
    {
      title: "Transaction list",
      what: "Chronological log of invoices, payments, and credit notes.",
      how: "Pulled from ld_invoices, ld_payments, and ld_credit_notes for the client, sorted by date.",
      read: "Reconcile by tracing the running balance. A missing payment shows up as a balance jump that never resolves.",
    },
    {
      title: "Aging / Outstanding indicators",
      what: "How long invoices have been unpaid.",
      how: "Unpaid invoices grouped by days since invoice_date.",
      read: "Anything 60+ days is collections territory. Phone, don't email.",
    },
  ],
};
