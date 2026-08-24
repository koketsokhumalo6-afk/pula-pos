import { SimpleCrudPage } from "../components/SimpleCrudPage";

interface Supplier { id: string; name: string; phone: string | null; email: string | null; balance: string; }

export function SuppliersPage() {
  return (
    <SimpleCrudPage<Supplier>
      title="Suppliers"
      endpoint="/suppliers"
      fields={[
        { name: "name", label: "Supplier name", required: true },
        { name: "phone", label: "Phone" },
        { name: "email", label: "Email", type: "email" },
        { name: "address", label: "Address", type: "textarea" },
      ]}
      columns={[
        { header: "Name", render: (s) => s.name },
        { header: "Phone", render: (s) => s.phone || "—" },
        { header: "Email", render: (s) => s.email || "—" },
        { header: "Balance owed", render: (s) => Number(s.balance).toFixed(2) },
      ]}
      emptyLabel="No suppliers yet."
    />
  );
}
