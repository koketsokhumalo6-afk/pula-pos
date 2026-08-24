import { SimpleCrudPage } from "../components/SimpleCrudPage";
import { dateTime } from "../lib/format";

interface Expense { id: string; category: string; description: string | null; amount: string; date: string; }

export function ExpensesPage() {
  return (
    <SimpleCrudPage<Expense>
      title="Expenses"
      endpoint="/expenses"
      fields={[
        { name: "category", label: "Category", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "amount", label: "Amount", type: "number", required: true },
        { name: "date", label: "Date", type: "date" },
      ]}
      columns={[
        { header: "Category", render: (e) => e.category },
        { header: "Description", render: (e) => e.description || "—" },
        { header: "Amount", render: (e) => Number(e.amount).toFixed(2) },
        { header: "Date", render: (e) => dateTime(e.date) },
      ]}
      emptyLabel="No expenses recorded yet."
    />
  );
}
