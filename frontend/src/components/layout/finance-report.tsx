import type { Advance, Expense, Refund } from "@/lib/store";
import { inr } from "@/lib/format";

type Props = {
  expenses: Expense[];
  advances: Advance[];
  refunds: Refund[];
  generatedAt?: string;
  className?: string;
};

export function FinanceReport({ expenses, advances, refunds, generatedAt, className = "" }: Props) {
  const totalExpense = expenses.reduce((a, b) => a + b.amount, 0);
  const totalAdvance = advances.reduce((a, b) => a + b.amount, 0);
  const totalRefund = refunds.reduce((a, b) => a + b.amount, 0);
  const balance = totalAdvance - totalExpense + totalRefund;
  const allBills = expenses.flatMap((e) => e.bills.map((b) => ({ ...b, expense: e })));
  const date = generatedAt ?? new Date().toLocaleDateString("en-IN");

  return (
    <div className={`finance-report space-y-4 text-sm ${className}`}>
      <div className="border-b-2 border-foreground pb-3 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Talent Quest for India</div>
        <h1 className="text-xl font-bold">Finance Settlement Report</h1>
        <div className="text-xs text-muted-foreground">Generated on {date}</div>
      </div>

      <section>
        <h2 className="mb-2 border-b border-border pb-1 text-xs font-bold uppercase tracking-wide">Advance Details</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="border border-border p-2 text-left">Date</th>
              <th className="border border-border p-2 text-left">Received From</th>
              <th className="border border-border p-2 text-left">UTR</th>
              <th className="border border-border p-2 text-left">Amount</th>
              <th className="border border-border p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {advances.length === 0 ? (
              <tr><td colSpan={5} className="border border-border p-2 text-muted-foreground">No advances recorded</td></tr>
            ) : advances.map((a) => (
              <tr key={a.id}>
                <td className="border border-border p-2">{a.date}</td>
                <td className="border border-border p-2">{a.receivedFrom}</td>
                <td className="border border-border p-2">{a.utr}</td>
                <td className="border border-border p-2 font-semibold">{inr(a.amount)}</td>
                <td className="border border-border p-2">{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 border-b border-border pb-1 text-xs font-bold uppercase tracking-wide">Expense Details</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="border border-border p-2 text-left">Date</th>
              <th className="border border-border p-2 text-left">Category</th>
              <th className="border border-border p-2 text-left">Description</th>
              <th className="border border-border p-2 text-left">From</th>
              <th className="border border-border p-2 text-left">To</th>
              <th className="border border-border p-2 text-left">Breakfast</th>
              <th className="border border-border p-2 text-left">Lunch</th>
              <th className="border border-border p-2 text-left">Dinner</th>
              <th className="border border-border p-2 text-left">Refreshment</th>
              <th className="border border-border p-2 text-left">Amount</th>
              <th className="border border-border p-2 text-left">Bills</th>
              <th className="border border-border p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan={12} className="border border-border p-2 text-muted-foreground">No expenses recorded</td></tr>
            ) : expenses.map((e) => (
              <tr key={e.id}>
                <td className="border border-border p-2">{e.date}</td>
                <td className="border border-border p-2">{e.category}</td>
                <td className="border border-border p-2">{e.description ?? "—"}</td>
                <td className="border border-border p-2">{e.travelFrom ?? "—"}</td>
                <td className="border border-border p-2">{e.travelTo ?? "—"}</td>
                <td className="border border-border p-2">{e.breakfast != null ? inr(e.breakfast) : "—"}</td>
                <td className="border border-border p-2">{e.lunch != null ? inr(e.lunch) : "—"}</td>
                <td className="border border-border p-2">{e.dinner != null ? inr(e.dinner) : "—"}</td>
                <td className="border border-border p-2">{e.refreshment != null ? inr(e.refreshment) : "—"}</td>
                <td className="border border-border p-2 font-semibold">{inr(e.amount)}</td>
                <td className="border border-border p-2">{e.bills.length}</td>
                <td className="border border-border p-2">{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 border-b border-border pb-1 text-xs font-bold uppercase tracking-wide">Refund Details</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="border border-border p-2 text-left">Date</th>
              <th className="border border-border p-2 text-left">UTR</th>
              <th className="border border-border p-2 text-left">Txn</th>
              <th className="border border-border p-2 text-left">Amount</th>
              <th className="border border-border p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {refunds.length === 0 ? (
              <tr><td colSpan={5} className="border border-border p-2 text-muted-foreground">No refunds recorded</td></tr>
            ) : refunds.map((r) => (
              <tr key={r.id}>
                <td className="border border-border p-2">{r.date}</td>
                <td className="border border-border p-2">{r.utr}</td>
                <td className="border border-border p-2">{r.txn}</td>
                <td className="border border-border p-2 font-semibold">{inr(r.amount)}</td>
                <td className="border border-border p-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border-2 border-foreground p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide">Settlement Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-dashed border-border pb-2"><span>Total Advance</span><b>{inr(totalAdvance)}</b></div>
          <div className="flex justify-between border-b border-dashed border-border pb-2"><span>Total Expenses</span><b>{inr(totalExpense)}</b></div>
          <div className="flex justify-between border-b border-dashed border-border pb-2"><span>Total Refund</span><b>{inr(totalRefund)}</b></div>
          <div className="flex justify-between pt-1 text-base"><span>Balance Amount</span><b className="text-primary">{inr(balance)}</b></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>Total bills attached</span><b>{allBills.length}</b></div>
        </div>
      </section>

      {allBills.length > 0 && (
        <section>
          <h2 className="mb-2 border-b border-border pb-1 text-xs font-bold uppercase tracking-wide">Attached Bills</h2>
          <div className="bill-grid grid grid-cols-1 gap-3 sm:grid-cols-2">
            {allBills.map((b) => (
              <div key={b.id} className="bill-card rounded-lg border border-border bg-white p-2">
                {b.url ? (
                  <img src={b.url} alt={b.name} className="mx-auto max-h-72 w-full object-contain bg-white" />
                ) : null}
                <div className="bill-name mt-2 text-center text-[10px] text-muted-foreground">
                  {b.name} · {b.expense.category} · {inr(b.expense.amount)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="signatures grid grid-cols-2 gap-8 pt-4">
        <div><div className="mb-10" /><div className="sign-line border-t border-foreground pt-2 text-center text-xs">Volunteer Signature</div></div>
        <div><div className="mb-10" /><div className="sign-line border-t border-foreground pt-2 text-center text-xs">Coordinator Signature</div></div>
      </section>
    </div>
  );
}
