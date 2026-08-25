import { SimpleCrudPage } from "../components/SimpleCrudPage";

interface Customer {
  id: string;
  name: string;
  idNumber: string | null;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  balance: string;
}

export function CustomersPage() {
  return (
    <SimpleCrudPage<Customer>
      title="Customers"
      endpoint="/customers"
      fields={[
        { name: "name", label: "Full name", required: true },
        { name: "idNumber", label: "ID number", required: true },
        { name: "phone", label: "Phone" },
        { name: "email", label: "Email", type: "email" },
        { name: "address", label: "Address", type: "textarea" },
        { name: "dateOfBirth", label: "Date of birth", type: "date" },
        { name: "nextOfKinName", label: "Next of kin name" },
        { name: "nextOfKinPhone", label: "Next of kin phone" },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      columns={[
        { header: "Name", render: (c) => c.name },
        { header: "ID Number", render: (c) => c.idNumber || "—" },
        { header: "Phone", render: (c) => c.phone || "—" },
        { header: "Email", render: (c) => c.email || "—" },
        { header: "Date of birth", render: (c) => (c.dateOfBirth ? new Date(c.dateOfBirth).toLocaleDateString() : "—") },
        {
          header: "Next of kin",
          render: (c) => (c.nextOfKinName ? `${c.nextOfKinName}${c.nextOfKinPhone ? ` (${c.nextOfKinPhone})` : ""}` : "—"),
        },
        { header: "Account balance", render: (c) => Number(c.balance).toFixed(2) },
      ]}
      emptyLabel="No customers yet."
    />
  );
}
