import type { Advance, Expense, Refund } from "@/lib/store";
import { inr } from "@/lib/format";

export function buildFinanceReportHtml(expenses: Expense[], advances: Advance[], refunds: Refund[]) {
  const totalExpense = expenses.reduce((a, b) => a + b.amount, 0);
  const totalAdvance = advances.reduce((a, b) => a + b.amount, 0);
  const totalRefund = refunds.reduce((a, b) => a + b.amount, 0);
  const balance = totalAdvance - totalExpense + totalRefund;
  const allBills = expenses.flatMap((e) => e.bills.map((b) => ({ ...b, expense: e })));
  const date = new Date().toLocaleDateString("en-IN");
  const row = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `
    <div class="sub">Talent Quest for India</div>
    <h1>Finance Settlement Report</h1>
    <div class="sub">Generated on ${date}</div>

    <h2>Advance Details</h2>
    <table><thead><tr><th>Date</th><th>Received From</th><th>UTR</th><th>Amount</th><th>Status</th></tr></thead><tbody>
      ${advances.length ? advances.map((a) => row([a.date, esc(a.receivedFrom), esc(a.utr), inr(a.amount), a.status])).join("") : row(["—", "—", "—", "—", "No advances"])}
    </tbody></table>

    <h2>Expense Details</h2>
    <table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Submitted By</th><th>Amount</th><th>Bills</th><th>Status</th></tr></thead><tbody>
      ${expenses.length ? expenses.map((e) => row([e.date, e.category, esc(e.description), esc(e.submittedBy), inr(e.amount), String(e.bills.length), e.status])).join("") : row(["—", "—", "—", "—", "—", "—", "No expenses"])}
    </tbody></table>

    <h2>Refund Details</h2>
    <table><thead><tr><th>Date</th><th>UTR</th><th>Txn</th><th>Amount</th><th>Status</th></tr></thead><tbody>
      ${refunds.length ? refunds.map((r) => row([r.date, esc(r.utr), esc(r.txn), inr(r.amount), r.status])).join("") : row(["—", "—", "—", "—", "No refunds"])}
    </tbody></table>

    <div class="summary">
      <h2 style="margin-top:0">Settlement Summary</h2>
      <div class="summary-row"><span>Total Advance</span><span>${inr(totalAdvance)}</span></div>
      <div class="summary-row"><span>Total Expenses</span><span>${inr(totalExpense)}</span></div>
      <div class="summary-row"><span>Total Refund</span><span>${inr(totalRefund)}</span></div>
      <div class="summary-row"><span>Balance Amount</span><span>${inr(balance)}</span></div>
    </div>

    ${allBills.length ? `<h2>Attached Bills</h2><div class="bill-grid">${allBills.map((b) => `
      <div class="bill-card">
        ${b.url ? `<img src="${b.url}" alt="${esc(b.name)}" />` : ""}
        <div class="bill-name">${esc(b.name)} · ${b.expense.category} · ${inr(b.expense.amount)}</div>
        ${b.originalUrl && b.originalUrl !== b.url ? `<div class="bill-name" style="font-size:9px;color:#999">Edge-cropped version (Original preserved)</div>` : ""}
      </div>`).join("")}</div>` : ""}

    <div class="signatures">
      <div class="sign-line">Volunteer Signature</div>
      <div class="sign-line">Coordinator Signature</div>
    </div>
  `;
}

export function printFinanceReport(html: string, title = "Finance Settlement Report") {
  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) throw new Error("Print frame unavailable");
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:12px}</style></head><body>${html}</body></html>`);
    doc.close();

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 500);
      }
    };

    // Safety fallback in case onload doesn't fire
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 500);
    }, 600);

    return true;
  } catch (err) {
    console.error("Print failed:", err);
    return false;
  }
}

export function downloadFinancePdf(expenses: Expense[], advances: Advance[], refunds: Refund[]) {
  const html = buildFinanceReportHtml(expenses, advances, refunds);
  return printFinanceReport(html);
}
