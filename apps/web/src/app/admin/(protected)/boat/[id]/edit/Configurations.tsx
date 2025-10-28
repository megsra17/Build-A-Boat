"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Copy, X, GripVertical, ChevronDown, ChevronRight } from "lucide-react";

type Option = { id: string; name: string };
type Category = { id: string; name: string; options: Option[]; collapsed?: boolean };
type Group = { id: string; name: string; collapsed?: boolean; categories: Category[] };

type BoatConfig = { boatId: string; groups: Group[] };

// Get API base URL
const getApiBase = () => {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_API_BASE || 'https://build-a-boat-production.up.railway.app';
  }
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5199";
};

const Api = {
  createGroup: async (boatId: string, name: string, sortOrder: number) => {
    const jwt = typeof window !== 'undefined' ? (localStorage.getItem("jwt") || sessionStorage.getItem("jwt")) : null;
    const apiUrl = getApiBase();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }
    
    const res = await fetch(`${apiUrl}/admin/groups`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        boatId,
        name,
        sortOrder,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  updateGroup: async (groupId: string, name: string, sortOrder?: number) => {
    const jwt = typeof window !== 'undefined' ? (localStorage.getItem("jwt") || sessionStorage.getItem("jwt")) : null;
    const apiUrl = getApiBase();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }
    
    const body: Record<string, any> = { name };
    if (sortOrder !== undefined) {
      body.sortOrder = sortOrder;
    }
    
    const res = await fetch(`${apiUrl}/admin/groups/${groupId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  deleteGroup: async (groupId: string) => {
    const jwt = typeof window !== 'undefined' ? (localStorage.getItem("jwt") || sessionStorage.getItem("jwt")) : null;
    const apiUrl = getApiBase();
    const headers: Record<string, string> = {};
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }
    
    const res = await fetch(`${apiUrl}/admin/groups/${groupId}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
  },

  createCategory: async (groupId: string, name: string, sortOrder: number) => {
    const jwt = typeof window !== 'undefined' ? (localStorage.getItem("jwt") || sessionStorage.getItem("jwt")) : null;
    const apiUrl = getApiBase();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }
    
    const res = await fetch(`${apiUrl}/admin/category`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        groupId,
        name,
        sortOrder,
        isRequired: false,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  updateCategory: async (categoryId: string, name: string) => {
    const jwt = typeof window !== 'undefined' ? (localStorage.getItem("jwt") || sessionStorage.getItem("jwt")) : null;
    const apiUrl = getApiBase();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }
    
    const res = await fetch(`${apiUrl}/admin/category/${categoryId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  deleteCategory: async (categoryId: string) => {
    const jwt = typeof window !== 'undefined' ? (localStorage.getItem("jwt") || sessionStorage.getItem("jwt")) : null;
    const apiUrl = getApiBase();
    const headers: Record<string, string> = {};
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }
    
    const res = await fetch(`${apiUrl}/admin/category/${categoryId}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
  },
};

export default function Configurations({
  boatId,
  initial,
}: {
  boatId: string;
  initial: BoatConfig;
}) {
  const [cfg, setCfg] = useState<BoatConfig>(initial);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    initial.groups[0]?.id ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const selected = useMemo(
    () => cfg.groups.find(g => g.id === selectedGroupId) ?? null,
    [cfg.groups, selectedGroupId]
  );

  // ---------- helpers
  const uid = () => crypto.randomUUID();

  function updateCfg(mut: (c: BoatConfig) => void) {
    setCfg(prev => {
      const next = structuredClone(prev);
      mut(next);
      return next;
    });
  }

  // ---------- group ops
  async function addGroup() {
    setBusy(true);
    setErr(null);
    try {
      const newGroup = await Api.createGroup(boatId, "New Group", cfg.groups.length);
      updateCfg(c => {
        c.groups.push({ id: newGroup.id, name: newGroup.name, categories: [] });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add group";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  async function renameGroup(id: string, name: string) {
    setBusy(true);
    setErr(null);
    try {
      await Api.updateGroup(id, name);
      updateCfg(c => {
        const g = c.groups.find(x => x.id === id);
        if (g) g.name = name;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to rename group";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  async function removeGroup(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await Api.deleteGroup(id);
      updateCfg(c => { c.groups = c.groups.filter(x => x.id !== id); });
      if (selectedGroupId === id) setSelectedGroupId(cfg.groups[0]?.id ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete group";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  function handleGroupDragStart(id: string) {
    setDraggedGroupId(id);
  }

  function handleGroupDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.currentTarget.classList.add("bg-white/5");
  }

  function handleGroupDragLeave(e: React.DragEvent) {
    e.currentTarget.classList.remove("bg-white/5");
  }

  async function handleGroupDrop(targetId: string) {
    if (!draggedGroupId || draggedGroupId === targetId) {
      setDraggedGroupId(null);
      return;
    }

    const draggedIndex = cfg.groups.findIndex(g => g.id === draggedGroupId);
    const targetIndex = cfg.groups.findIndex(g => g.id === targetId);

    if (draggedIndex < 0 || targetIndex < 0) {
      setDraggedGroupId(null);
      return;
    }

    // Reorder groups locally
    const newGroups = [...cfg.groups];
    const [removed] = newGroups.splice(draggedIndex, 1);
    newGroups.splice(targetIndex, 0, removed);

    updateCfg(c => {
      c.groups = newGroups;
    });

    // Update sort order for affected groups in database
    setBusy(true);
    try {
      for (let i = 0; i < newGroups.length; i++) {
        const group = newGroups[i];
        // Only update the dragged group and the target group since order changed
        if (group.id === draggedGroupId || group.id === targetId) {
          await Api.updateGroup(group.id, group.name, i);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to reorder groups";
      setErr(msg);
      // Revert to previous state on error
      updateCfg(c => {
        c.groups = cfg.groups;
      });
    } finally {
      setBusy(false);
      setDraggedGroupId(null);
    }
  }

  // ---------- category ops
  async function addCategory(groupId: string) {
    setBusy(true);
    setErr(null);
    try {
      const selected = cfg.groups.find(g => g.id === groupId);
      if (!selected) return;
      const newCat = await Api.createCategory(groupId, "New Category", selected.categories.length);
      updateCfg(c => {
        const g = c.groups.find(x => x.id === groupId);
        if (g) {
          g.categories.push({ id: newCat.id, name: newCat.name, options: [] });
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add category";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  function cloneCategory(groupId: string, catId: string) {
    updateCfg(c => {
      const g = c.groups.find(x => x.id === groupId);
      if (!g) return;
      const i = g.categories.findIndex(x => x.id === catId);
      if (i < 0) return;
      const copy = structuredClone(g.categories[i]);
      copy.id = uid();
      copy.name = copy.name + " (Copy)";
      g.categories.splice(i + 1, 0, copy);
    });
  }

  async function renameCategory(groupId: string, catId: string, name: string) {
    setBusy(true);
    setErr(null);
    try {
      await Api.updateCategory(catId, name);
      updateCfg(c => {
        const cat = c.groups.find(g=>g.id===groupId)?.categories.find(x=>x.id===catId);
        if (cat) cat.name = name;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to rename category";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(groupId: string, catId: string) {
    setBusy(true);
    setErr(null);
    try {
      await Api.deleteCategory(catId);
      updateCfg(c => {
        const g = c.groups.find(x => x.id === groupId);
        if (g) g.categories = g.categories.filter(x => x.id !== catId);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete category";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  function toggleCategory(groupId: string, catId: string) {
    updateCfg(c => {
      const cat = c.groups.find(g=>g.id===groupId)?.categories.find(x=>x.id===catId);
      if (cat) cat.collapsed = !cat.collapsed;
    });
  }

  // ---------- option ops
  function addOption(groupId: string, catId: string) {
    updateCfg(c => {
      const cat = c.groups.find(g=>g.id===groupId)?.categories.find(x=>x.id===catId);
      if (!cat) return;
      cat.options.push({ id: uid(), name: "New Option" });
    });
  }
  function renameOption(groupId: string, catId: string, optId: string, name: string) {
    updateCfg(c => {
      const opt = c.groups.find(g=>g.id===groupId)?.categories.find(x=>x.id===catId)?.options.find(o=>o.id===optId);
      if (opt) opt.name = name;
    });
  }
  function removeOption(groupId: string, catId: string, optId: string) {
    updateCfg(c => {
      const cat = c.groups.find(g=>g.id===groupId)?.categories.find(x=>x.id===catId);
      if (!cat) return;
      cat.options = cat.options.filter(o => o.id !== optId);
    });
  }

  return (
    <section className="rounded-lg border border-white/10 bg-[#1a1a1a]">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-lg">
          <span className="text-white/80">🧩 Configurations</span>
          {busy && <span className="text-xs text-white/50">saving…</span>}
          {err && <span className="text-xs text-red-400">{err}</span>}
        </div>
      </div>

      <div className="grid grid-cols-[340px_1fr]">
        {/* LEFT: groups */}
        <div className="border-r border-white/10">
          {cfg.groups.map(g => {
            const active = g.id === selectedGroupId;
            const isDragging = g.id === draggedGroupId;
            return (
              <div 
                key={g.id} 
                draggable
                onDragStart={() => handleGroupDragStart(g.id)}
                onDragOver={handleGroupDragOver}
                onDragLeave={handleGroupDragLeave}
                onDrop={() => handleGroupDrop(g.id)}
                className={`px-3 py-2 border-b border-white/10 cursor-move transition-colors ${
                  active ? "bg-[#2a2a2a]" : "bg-transparent"
                } ${isDragging ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <button
                    className="flex items-center gap-2 text-left w-full"
                    onClick={() => setSelectedGroupId(g.id)}
                  >
                    <GripVertical className="size-4 text-white/40" />
                    <span className="text-white/80">{g.name}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      const name = prompt("Rename group", g.name);
                      if (name) renameGroup(g.id, name);
                    }} title="Rename" className="icon-btn">
                      <Pencil className="size-4"/>
                    </button>
                    <button onClick={() => removeGroup(g.id)} title="Delete" className="icon-btn">
                      <X className="size-4"/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="p-3">
            <button onClick={addGroup}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-sm hover:bg-white/10">
              <Plus className="size-4" /> Add Group
            </button>
          </div>
        </div>

        {/* RIGHT: selected group detail */}
        <div className="p-4">
          {!selected ? (
            <div className="text-white/50 text-sm">Select a group…</div>
          ) : (
            <div className="rounded border border-white/10 bg-[#1b1b1b]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h3 className="text-lg">{selected.name}</h3>
                <button onClick={() => addCategory(selected.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-sm hover:bg-white/10">
                  <Plus className="size-4" /> Add Category
                </button>
              </div>

              <div className="divide-y divide-white/10">
                {selected.categories.map(cat => (
                  <div key={cat.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleCategory(selected.id, cat.id)} className="icon-btn">
                          {cat.collapsed ? <ChevronRight className="size-4"/> : <ChevronDown className="size-4" />}
                        </button>
                        <span className="font-medium">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => addOption(selected.id, cat.id)} title="Add Option" className="icon-btn">
                          <Plus className="size-4"/>
                        </button>
                        <button onClick={() => cloneCategory(selected.id, cat.id)} title="Duplicate Category" className="icon-btn">
                          <Copy className="size-4"/>
                        </button>
                        <button onClick={() => {
                          const name = prompt("Rename category", cat.name);
                          if (name) renameCategory(selected.id, cat.id, name);
                        }} title="Rename" className="icon-btn">
                          <Pencil className="size-4"/>
                        </button>
                        <button onClick={() => removeCategory(selected.id, cat.id)} title="Delete" className="icon-btn">
                          <Trash2 className="size-4"/>
                        </button>
                      </div>
                    </div>

                    {!cat.collapsed && (
                      <ul className="mt-3 space-y-2">
                        {cat.options.map(opt => (
                          <li key={opt.id} className="flex items-center justify-between rounded bg-black/20 px-3 py-2 border border-white/10">
                            <div className="flex items-center gap-2">
                              <GripVertical className="size-4 opacity-50" />
                              <span>{opt.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => {
                                const name = prompt("Rename option", opt.name);
                                if (name) renameOption(selected.id, cat.id, opt.id, name);
                              }} title="Rename" className="icon-btn">
                                <Pencil className="size-4"/>
                              </button>
                              <button onClick={() => removeOption(selected.id, cat.id, opt.id)} title="Delete" className="icon-btn">
                                <X className="size-4"/>
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .icon-btn { @apply rounded-full border border-white/15 p-1.5 hover:bg-white/10 text-white/80; }
      `}</style>
    </section>
  );
}
