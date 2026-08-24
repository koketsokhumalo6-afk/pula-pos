import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";

interface Category {
  id: string;
  name: string;
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  function load() {
    api.get<Category[]>("/categories").then(setCategories).catch(() => {});
  }

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    setAddError(null);
    setAdding(true);
    try {
      await api.post("/categories", { name });
      setNewName("");
      load();
    } catch (err) {
      setAddError(err instanceof ApiRequestError ? err.message : "Failed to add category");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditError(null);
  }

  async function saveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    setEditError(null);
    try {
      await api.put(`/categories/${id}`, { name });
      setEditingId(null);
      load();
    } catch (err) {
      setEditError(err instanceof ApiRequestError ? err.message : "Failed to rename category");
    }
  }

  async function removeCategory(c: Category) {
    if (!confirm(`Remove "${c.name}" from the category list? Products already using it keep their category — this only affects the list.`)) return;
    await api.del(`/categories/${c.id}`);
    load();
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Categories</h2>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <label>Add a category</label>
        <div className="gap-8">
          <input
            style={{ flex: 1 }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Beverages, Meat, Prescriptions"
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <button className="btn btn-primary" onClick={addCategory} disabled={adding || !newName.trim()}>
            + Add
          </button>
        </div>
        {addError && <div className="error-text">{addError}</div>}
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Category</th><th></th></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>
                  {editingId === c.id ? (
                    <input
                      style={{ maxWidth: 260 }}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(c.id)}
                      autoFocus
                    />
                  ) : (
                    c.name
                  )}
                  {editingId === c.id && editError && <div className="error-text">{editError}</div>}
                </td>
                <td>
                  {editingId === c.id ? (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(c.id)}>Save</button>{" "}
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => startEdit(c)}>Rename</button>{" "}
                      <button className="btn btn-danger btn-sm" onClick={() => removeCategory(c)}>Remove</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!categories.length && (
          <p className="muted" style={{ padding: 12 }}>
            No categories yet — add one above, then pick it from the Category dropdown when adding or editing a product.
          </p>
        )}
      </div>
    </div>
  );
}
