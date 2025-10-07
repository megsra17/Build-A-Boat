"use client";

import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { CategoriesApi, BoatsApi, type CategoryRow, type Boat } from "@/app/lib/admin-api";

function initialsFromName(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "C";
}

export default function CategoriesPage() {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isRequired, setIsRequired] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const [categoriesRes, boatsRes] = await Promise.all([
        CategoriesApi.list({ search }),
        BoatsApi.list()
      ]);
      setRows(categoriesRes.items ?? []);
      setBoats(boatsRes.items ?? []);
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function addCategory() {
    if (!newName.trim()) return;
    setErr(null);
    try {
      // Use the first available boat as default, or a special default ID
      const defaultBoatId = boats.length > 0 ? boats[0].id : "00000000-0000-0000-0000-000000000000";
      
      const created = await CategoriesApi.create({ 
        Name: newName.trim(),
        BoatId: defaultBoatId,
        SortOrder: sortOrder,
        IsRequired: isRequired
      });
      setRows((r) => [created, ...r]);
      setNewName("");
      setSortOrder(0);
      setIsRequired(false);
      setAdding(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this category? This action cannot be undone.")) return;
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id)); // optimistic
    try {
      await CategoriesApi.remove(id);
    } catch (e) {
      // rollback
      setRows(prev);
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-4">
      {/* Search + Add */}
      <div className="flex items-center justify-between">
        <div className="relative w-[480px] max-w-full">
          <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-8 py-2 rounded-md bg-[#222] border-b border-white/30 text-sm outline-none focus:border-white/60"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 px-4 py-2"
        >
          <Plus className="size-4" />
          Add New
        </button>
      </div>

      {/* Inline Add Row */}
      {adding && (
        <div className="rounded-lg border border-white/10 bg-[#1f1f1f] p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Category Name</label>
              <input
                autoFocus
                value={newName}
                placeholder="Category name…"
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-[#151515] border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-white/10"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">Sort Order</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="w-full bg-[#151515] border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-white/10"
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="isRequired"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="rounded border-white/10 bg-[#151515]"
                />
                <label htmlFor="isRequired" className="text-sm text-white/70">
                  Required category
                </label>
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                  setSortOrder(0);
                  setIsRequired(false);
                }}
                className="px-4 py-2 rounded border border-white/15 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={addCategory}
                disabled={!newName.trim()}
                className="px-4 py-2 rounded bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}

      {err && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
          {err}
        </div>
      )}

      {/* Table-like list */}
      <div className="rounded-lg border border-white/10 bg-[#1f1f1f] overflow-hidden">
        <div className="px-4 py-2 text-sm bg-black/30 border-b border-white/10 grid grid-cols-[1fr_44px]">
          <div className="text-white/80">Name</div>
          <div />
        </div>

        <ul className="divide-y divide-white/5">
          {rows.map((c) => {
            const name = c.name ?? "(unnamed)";
            return (
              <li key={c.id} className="px-4">
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center size-12 rounded-full bg-orange-500 text-white text-lg font-semibold">
                      {initialsFromName(name)}
                    </span>
                    <div className="text-base">{name}</div>
                  </div>

                  <button
                    title="Delete"
                    onClick={() => deleteRow(c.id)}
                    className="size-8 rounded-full border border-white/15 hover:bg-white/10 text-white/80"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}

          {!busy && rows.length === 0 && (
            <li className="px-4 py-8 text-center text-white/60">No categories found.</li>
          )}
          {busy && (
            <li className="px-4 py-8 text-center text-white/60">Loading…</li>
          )}
        </ul>
      </div>
    </div>
  );
}
