"use client";

import { useEffect, useState } from "react";
import { Plus, Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { BoatCategoriesApi, BoatsApi, type BoatCategoryRow, type Boat } from "@/app/lib/admin-api";

function initialsFromName(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "C";
}

export default function CategoriesPage() {
  const [rows, setRows] = useState<BoatCategoryRow[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryBoats, setCategoryBoats] = useState<Record<string, Boat[]>>({});

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const [categoriesRes, boatsRes] = await Promise.all([
        BoatCategoriesApi.list({ search }),
        BoatsApi.list()
      ]);
      setRows(categoriesRes.items ?? []);
      setBoats(boatsRes.items ?? []);
    } catch (e) {
      console.error("Error loading data:", e);
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
      const created = await BoatCategoriesApi.create({ 
        Name: newName.trim(),
        SortOrder: rows.length
      });
      setRows((r) => [created, ...r]);
      setNewName("");
      setAdding(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this boat category? This action cannot be undone.")) return;
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id)); // optimistic
    try {
      await BoatCategoriesApi.remove(id);
    } catch (e) {
      // rollback
      setRows(prev);
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function expandCategory(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    
    setExpandedId(id);
    
    // Load boats for this category if not already loaded
    if (!categoryBoats[id]) {
      try {
        const res = await BoatCategoriesApi.getBoats(id);
        setCategoryBoats(prev => ({ ...prev, [id]: res.boats }));
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    }
  }

  async function addBoatToCategory(boatCategoryId: string, boatId: string) {
    try {
      await BoatCategoriesApi.addBoat(boatCategoryId, boatId);
      const res = await BoatCategoriesApi.getBoats(boatCategoryId);
      setCategoryBoats(prev => ({ ...prev, [boatCategoryId]: res.boats }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeBoatFromCategory(boatCategoryId: string, boatId: string) {
    try {
      await BoatCategoriesApi.removeBoat(boatCategoryId, boatId);
      const res = await BoatCategoriesApi.getBoats(boatCategoryId);
      setCategoryBoats(prev => ({ ...prev, [boatCategoryId]: res.boats }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
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
              <label className="block text-sm text-white/70 mb-2">Boat Category Name</label>
              <input
                autoFocus
                value={newName}
                placeholder="Boat category name…"
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-[#151515] border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-white/10"
              />
            </div>
            
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setAdding(false);
                  setNewName("");
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
                Save Boat Category
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
            const isExpanded = expandedId === c.id;
            const boatsInCat = categoryBoats[c.id] ?? [];
            const unassignedBoats = boats.filter(b => !boatsInCat.some(cb => cb.id === b.id));
            
            return (
              <li key={c.id}>
                <div className="px-4">
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => expandCategory(c.id)}
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4 text-white/60" />
                        ) : (
                          <ChevronRight className="size-4 text-white/60" />
                        )}
                      </button>
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

                  {/* Expanded boats list */}
                  {isExpanded && (
                    <div className="pb-4 pl-12 space-y-3">
                      {/* Boats in category */}
                      {boatsInCat.length > 0 && (
                        <div>
                          <div className="text-xs text-white/60 mb-2">Boats in this category</div>
                          <div className="space-y-2">
                            {boatsInCat.map(boat => (
                              <div key={boat.id} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                                <span className="text-sm">{boat.name}</span>
                                <button
                                  onClick={() => removeBoatFromCategory(c.id, boat.id)}
                                  className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Available boats to add */}
                      {unassignedBoats.length > 0 && (
                        <div>
                          <div className="text-xs text-white/60 mb-2">Add boats</div>
                          <div className="space-y-2">
                            {unassignedBoats.map(boat => (
                              <div key={boat.id} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                                <span className="text-sm">{boat.name}</span>
                                <button
                                  onClick={() => addBoatToCategory(c.id, boat.id)}
                                  className="text-xs px-2 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10"
                                >
                                  Add
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}

          {!busy && rows.length === 0 && (
            <li className="px-4 py-8 text-center text-white/60">No boat categories found.</li>
          )}
          {busy && (
            <li className="px-4 py-8 text-center text-white/60">Loading…</li>
          )}
        </ul>
      </div>
    </div>
  );
}
