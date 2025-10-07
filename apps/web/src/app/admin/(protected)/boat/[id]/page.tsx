"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { BoatsApi, type BoatSummary, type BoatConfigNode } from "@/app/lib/admin-api";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";

// small icon button
function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="inline-flex items-center justify-center size-7 rounded-full border border-white/15 hover:bg-white/10 text-white/80"
    >
      {children}
    </button>
  );
}

// ----- immutable tree utilities -----
function insertChild(tree: BoatConfigNode[], parentId: string, child: BoatConfigNode): BoatConfigNode[] {
  return tree.map(n => {
    if (n.id === parentId) {
      const kids = n.children ? [child, ...n.children] : [child];
      return { ...n, children: kids };
    }
    if (n.children) return { ...n, children: insertChild(n.children, parentId, child) };
    return n;
  });
}
function replaceNode(tree: BoatConfigNode[], updated: BoatConfigNode): BoatConfigNode[] {
  return tree.map(n => {
    if (n.id === updated.id) return { ...n, name: updated.name, children: updated.children ?? n.children };
    if (n.children) return { ...n, children: replaceNode(n.children, updated) };
    return n;
  });
}
function deleteNode(tree: BoatConfigNode[], id: string): BoatConfigNode[] {
  return tree
    .filter(n => n.id !== id)
    .map(n => (n.children ? { ...n, children: deleteNode(n.children, id) } : n));
}

type Expanded = Record<string, boolean>;

export default function BoatEditorPage() {
  const params = useParams<{ id: string }>();
  const boatId = params?.id as string;

  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [boat, setBoat] = useState<BoatSummary | null>(null);
  const [tree, setTree] = useState<BoatConfigNode[]>([]);
  const [expanded, setExpanded] = useState<Expanded>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setBusy(true);
      setErr(null);
      try {
        const res = await BoatsApi.get(boatId);
        if (!mounted) return;
        setBoat(res.boat);
        setTree(res.tree ?? []);
        // expand top level groups by default
        const exp: Expanded = {};
        for (const g of res.tree ?? []) exp[g.id] = true;
        setExpanded(exp);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setBusy(false);
      }
    })();
    return () => { mounted = false; };
  }, [boatId]);

  // --- summary editing helpers ---
  async function saveSummary(patch: Partial<BoatSummary>) {
    if (!boat) return;
    setSaving(true);
    setBoat({ ...boat, ...patch }); // optimistic
    try {
      const updated = await BoatsApi.updateSummary(boatId, patch);
      setBoat(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // ---- tree helpers ----
  function toggle(id: string) {
    setExpanded((m) => ({ ...m, [id]: !m[id] }));
  }
  async function addGroup() {
    const name = prompt("New group name");
    if (!name) return;
    const created = await BoatsApi.addNode(boatId, null, "group", name);
    setTree((t) => [created, ...t]);
    setExpanded((m) => ({ ...m, [created.id]: true }));
  }
  async function addChild(parentId: string, type: BoatConfigNode["type"]) {
    const name = prompt(`New ${type} name`);
    if (!name) return;
    const created = await BoatsApi.addNode(boatId, parentId, type, name);
    // insert into tree
    setTree((prev) => insertChild(prev, parentId, created));
  }
  async function rename(nodeId: string, current: string) {
    const name = prompt("Rename", current);
    if (!name || name === current) return;
    const updated = await BoatsApi.renameNode(boatId, nodeId, name);
    setTree((prev) => replaceNode(prev, updated));
  }
  async function remove(nodeId: string) {
    if (!confirm("Delete this item (and all children)?")) return;
    const snapshot = tree;
    setTree((prev) => deleteNode(prev, nodeId));
    try {
      await BoatsApi.deleteNode(boatId, nodeId);
    } catch (e) {
      setTree(snapshot); // rollback
      alert(e instanceof Error ? e.message : String(e));
    }
  }
  async function move(nodeId: string, dir: "up" | "down") {
    try {
      const res = await BoatsApi.moveNode(boatId, nodeId, dir);
      setTree(res.tree);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  if (busy) return <div className="text-white/70">Loading…</div>;
  if (err) return <div className="text-red-400">{err}</div>;
  if (!boat) return null;

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <section className="rounded-lg border border-white/10 bg-[#1f1f1f] p-4">
        <div className="flex items-start gap-6">
          <div className="w-[280px] h-[170px] relative rounded-md overflow-hidden bg-black/40 border border-white/10">
            {boat.heroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={boat.heroUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-white/40">No Image</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
            <LabelValue label="Model Year" value={boat.modelYear} onEdit={(v)=> saveSummary({ modelYear: Number(v) })}/>
            <LabelValue label="Name" value={boat.name} onEdit={(v)=> saveSummary({ name: v })}/>
            <LabelValue label="Category" value={boat.category} onEdit={(v)=> saveSummary({ category: v })}/>
            <LabelValue label="MSRP" value={boat.msrp ?? ""} onEdit={(v)=> saveSummary({ msrp: Number(v) })}/>
            <LabelValue label="Features" value={boat.features ?? ""} long onEdit={(v)=> saveSummary({ features: v })}/>
            <LabelValue label="Start Build Link" value={boat.startBuildUrl ?? ""} long onEdit={(v)=> saveSummary({ startBuildUrl: v })}/>
          </div>

          <div className="ml-auto text-white/60 text-sm">{saving ? "Saving…" : null}</div>
        </div>
      </section>

      {/* Configurations */}
      <section className="rounded-lg border border-white/10">
        <div className="px-4 py-3 border-b border-white/10 bg-[#1b1b1b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white/90 font-medium">Configurations</span>
          </div>
          <button onClick={addGroup} className="rounded-full border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 px-3 py-1 text-sm">
            Add Group
          </button>
        </div>

        <div className="p-3">
          {tree.length === 0 && <div className="text-white/60 text-sm">No groups yet.</div>}
          <ul className="space-y-3">
            {tree.map((g, i) => (
              <NodeRow
                key={g.id}
                node={g}
                depth={0}
                expanded={!!expanded[g.id]}
                onToggle={() => toggle(g.id)}
                onAddChild={(t) => addChild(g.id, t)}
                onRename={(name) => rename(g.id, name)}
                onDelete={() => remove(g.id)}
                onMoveUp={() => move(g.id, "up")}
                onMoveDown={() => move(g.id, "down")}
                renderChildren={(children) =>
                  children?.map((c) => (
                    <NodeRecursive
                      key={c.id}
                      node={c}
                      depth={1}
                      expanded={expanded}
                      toggle={toggle}
                      addChild={addChild}
                      rename={rename}
                      remove={remove}
                      move={move}
                    />
                  ))
                }
              />
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

// ---------- helpers / components ----------

function LabelValue({
  label, value, long, onEdit
}: { label: string; value: any; long?: boolean; onEdit: (next: string)=>void }) {
  return (
    <div className={`col-span-${long ? "2" : "1"}`}>
      <div className="text-white/60">{label}:</div>
      <div className="flex items-center gap-2">
        <div className="whitespace-pre-wrap">{String(value ?? "").trim() || "—"}</div>
        <IconBtn title="Edit" onClick={() => {
          const v = prompt(`Edit ${label}`, String(value ?? ""));
          if (v !== null) onEdit(v);
        }}>
          <Pencil className="size-4" />
        </IconBtn>
      </div>
    </div>
  );
}

function NodeRecursive({
  node, depth, expanded, toggle, addChild, rename, remove, move
}: {
  node: BoatConfigNode; depth: number; expanded: Expanded;
  toggle: (id: string)=> void;
  addChild: (parentId: string, type: BoatConfigNode["type"]) => void;
  rename: (nodeId: string, current: string) => void;
  remove: (nodeId: string)=> void;
  move: (nodeId: string, dir:"up"|"down")=> void;
}) {
  return (
    <NodeRow
      node={node}
      depth={depth}
      expanded={!!expanded[node.id]}
      onToggle={() => toggle(node.id)}
      onAddChild={(t)=> addChild(node.id, t)}
      onRename={(name)=> rename(node.id, name)}
      onDelete={()=> remove(node.id)}
      onMoveUp={()=> move(node.id, "up")}
      onMoveDown={()=> move(node.id, "down")}
      renderChildren={(children)=>
        children?.map((ch)=>(
          <NodeRecursive
            key={ch.id}
            node={ch}
            depth={depth+1}
            expanded={expanded}
            toggle={toggle}
            addChild={addChild}
            rename={rename}
            remove={remove}
            move={move}
          />
        ))
      }
    />
  );
}

function NodeRow({
  node, depth, expanded, onToggle, onAddChild, onRename, onDelete, onMoveUp, onMoveDown, renderChildren
}: {
  node: BoatConfigNode;
  depth: number;
  expanded: boolean;
  onToggle: ()=>void;
  onAddChild: (t: BoatConfigNode["type"])=>void;
  onRename: (current: string)=>void;
  onDelete: ()=>void;
  onMoveUp: ()=>void;
  onMoveDown: ()=>void;
  renderChildren: (children?: BoatConfigNode[]) => React.ReactNode;
}) {
  const canHaveChildren = node.type !== "option";
  const pad = 8 + depth * 20;

  return (
    <li className="rounded border border-white/10">
      <div className="flex items-center gap-2 px-3 py-2" style={{ paddingLeft: pad }}>
        {/* chevron */}
        {canHaveChildren ? (
          <button onClick={onToggle} className="text-white/70 hover:text-white">
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <div className="size-4" />
        )}

        <div className="font-medium">
          {node.name}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {/* move */}
          <IconBtn title="Move up" onClick={onMoveUp}><ArrowUp className="size-4" /></IconBtn>
          <IconBtn title="Move down" onClick={onMoveDown}><ArrowDown className="size-4" /></IconBtn>

          {/* add children */}
          {canHaveChildren && (
            <>
              <IconBtn title="Add category" onClick={()=> onAddChild("category")}><Plus className="size-4" /></IconBtn>
              <IconBtn title="Add option" onClick={()=> onAddChild("option")}><Plus className="size-4" /></IconBtn>
            </>
          )}

          {/* rename/delete */}
          <IconBtn title="Rename" onClick={()=> onRename(node.name)}><Pencil className="size-4" /></IconBtn>
          <IconBtn title="Delete" onClick={onDelete}><Trash2 className="size-4" /></IconBtn>
        </div>
      </div>

      {/* children */}
      {expanded && canHaveChildren && node.children && node.children.length > 0 && (
        <ul className="px-2 pb-2 space-y-2">
          {renderChildren(node.children)}
        </ul>
      )}
    </li>
  );
}