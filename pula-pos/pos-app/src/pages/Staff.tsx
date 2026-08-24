import { SimpleCrudPage } from "../components/SimpleCrudPage";

interface Staff { id: string; name: string; email: string; role: string; status: string; }

export function StaffPage() {
  return (
    <SimpleCrudPage<Staff>
      title="Staff"
      endpoint="/staff"
      fields={[
        { name: "name", label: "Full name", required: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "password", label: "Temporary password", required: true },
        { name: "role", label: "Role", type: "select", required: true, options: [
          { value: "ADMIN", label: "Admin" },
          { value: "MANAGER", label: "Manager" },
          { value: "CASHIER", label: "Cashier" },
        ] },
      ]}
      columns={[
        { header: "Name", render: (s) => s.name },
        { header: "Email", render: (s) => s.email },
        { header: "Role", render: (s) => <span className="badge badge-green">{s.role}</span> },
        { header: "Status", render: (s) => <span className={`badge ${s.status === "ACTIVE" ? "badge-green" : "badge-gray"}`}>{s.status}</span> },
      ]}
      emptyLabel="No staff added yet."
    />
  );
}
