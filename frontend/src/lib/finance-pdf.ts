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
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) return false;

  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 24px; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
  h2 { font-size: 13px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #333; border-bottom: 2px solid #111; padding-bottom: 4px; }
  .sub { text-align: center; color: #555; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #bbb; padding: 7px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 700; }
  .summary { border: 1px solid #111; padding: 12px; margin-top: 8px; }
  .summary-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #ccc; }
  .summary-row:last-child { border-bottom: none; font-weight: 700; font-size: 14px; padding-top: 8px; }
  .bill-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .bill-card { border: 1px solid #bbb; padding: 8px; background: #fff; page-break-inside: avoid; }
  .bill-card img { width: 100%; max-height: 320px; object-fit: contain; background: #fff; display: block; }
  .bill-name { font-size: 10px; color: #555; margin-top: 6px; text-align: center; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 28px; }
  .sign-line { border-top: 1px solid #111; padding-top: 6px; font-size: 11px; text-align: center; }
  @media print { body { padding: 12px; } }
</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 400);
  return true;
}

export function downloadFinancePdf(expenses: Expense[], advances: Advance[], refunds: Refund[]) {
  const html = buildFinanceReportHtml(expenses, advances, refunds);
  if (!printFinanceReport(html)) {
    return false;
  }
  return true;
}
