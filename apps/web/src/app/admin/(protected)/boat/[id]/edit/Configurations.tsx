"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Copy, X, GripVertical, ChevronDown, ChevronRight } from "lucide-react";

type Option = { id: string; name: string };
type Category = { id: string; name: string; options: Option[]; collapsed?: boolean };
type Group = { id: string; name: string; collapsed?: boolean; categories: Category[] };

type BoatConfig = { boatId: string; groups: Group[] };

// Replace these with real API calls
const Api = {
  save: async (boatId: string, cfg: BoatConfig) => cfg, // stub
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

  async function persist() {
    setBusy(true);
    try { await Api.save(boatId, cfg); } finally { setBusy(false); }
  }

  // ---------- group ops
  function addGroup() {
    updateCfg(c => {
      const g: Group = { id: uid(), name: "New Group", categories: [] };
      c.groups.push(g);
    });
  }
  function renameGroup(id: string, name: string) {
    updateCfg(c => { const g = c.groups.find(x => x.id === id); if (g) g.name = name; });
  }
  function removeGroup(id: string) {
    updateCfg(c => { c.groups = c.groups.filter(x => x.id !== id); });
    if (selectedGroupId === id) setSelectedGroupId(cfg.groups[0]?.id ?? "");
  }
  function toggleGroup(id: string) {
    updateCfg(c => { const g = c.groups.find(x => x.id === id); if (g) g.collapsed = !g.collapsed; });
  }

  // ---------- category ops
  function addCategory(groupId: string) {
    updateCfg(c => {
      const g = c.groups.find(x => x.id === groupId);
      if (!g) return;
      g.categories.push({ id: uid(), name: "New Category", options: [] });
    });
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
  function renameCategory(groupId: string, catId: string, name: string) {
    updateCfg(c => {
      const cat = c.groups.find(g=>g.id===groupId)?.categories.find(x=>x.id===catId);
      if (cat) cat.name = name;
    });
  }
  function removeCategory(groupId: string, catId: string) {
    updateCfg(c => {
      const g = c.groups.find(x => x.id === groupId);
      if (g) g.categories = g.categories.filter(x => x.id !== catId);
    });
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
        </div>
        <button
          onClick={persist}
          className="text-xs rounded-full border border-white/20 px-3 py-1 hover:bg-white/10"
        >
          Save
        </button>
      </div>

      <div className="grid grid-cols-[340px_1fr]">
        {/* LEFT: groups */}
        <div className="border-r border-white/10">
          {cfg.groups.map(g => {
            const active = g.id === selectedGroupId;
            return (
              <div key={g.id} className={`px-3 py-2 border-b border-white/10 ${active ? "bg-[#2a2a2a]" : "bg-transparent"}`}>
                <div className="flex items-center justify-between">
                  <button
                    className="flex items-center gap-2 text-left w-full"
                    onClick={() => setSelectedGroupId(g.id)}
                  >
                    <span className="text-white/80">{g.name}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleGroup(g.id)} title="Collapse/Expand" className="icon-btn">
                      {g.collapsed ? <ChevronRight className="size-4"/> : <ChevronDown className="size-4" />}
                    </button>
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
