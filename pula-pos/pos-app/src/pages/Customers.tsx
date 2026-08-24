import { SimpleCrudPage } from "../components/SimpleCrudPage";

interface Customer { id: string; name: string; phone: string | null; email: string | null; balance: string; }

export function CustomersPage() {
  return (
    <SimpleCrudPage<Customer>
      title="Customers"
      endpoint="/customers"
      fields={[
        { name: "name", label: "Full name", required: true },
        { name: "phone", label: "Phone" },
        { name: "email", label: "Email", type: "email" },
        { name: "address", label: "Address", type: "textarea" },
      ]}
      columns={[
        { header: "Name", render: (c) => c.name },
        { header: "Phone", render: (c) => c.phone || "—" },
        { header: "Email", render: (c) => c.email || "—" },
        { header: "Account balance", render: (c) => Number(c.balance).toFixed(2) },
      ]}
      emptyLabel="No customers yet."
    />
  );
}
