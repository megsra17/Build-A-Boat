"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { BoatsApi, type Boat } from "@/app/lib/admin-api";
import {Search, Plus, RefreshCw, Copy, Trash2, Edit } from "lucide-react";
import Link from "next/link";

export default function BoatsPage() {
  const [rows, setRows] = useState<Boat[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showDupFor, setShowDupFor] = useState<Boat |null>(null);
  const [dupSlug, setDupSlug] = useState("");
  const [dupName, setDupName] = useState("");
  const [dupYear, setDupYear] = useState<number | undefined>(undefined);


  async function load() {
    setBusy(true);
    setError("");
    try{
      const res = await BoatsApi.list(search || undefined);
      setRows(res.items);
    } catch {
      setError("Failed to load boats");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      load();
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[search]);

  async function toggleActive(id: string) {
    try { await BoatsApi.toggleActive(id); load(); }
    catch(e: unknown){ 
      const message = e instanceof Error ? e.message : String(e);
      alert(message); 
    }
  }

  async function deleteBoat(id: string) {
    if(!confirm("Are you sure you want to delete this boat? This action cannot be undone.")) return;
    try { await BoatsApi.remove(id); load(); }
    catch(e: unknown){ 
      const message = e instanceof Error ? e.message : String(e);
      alert(message); 
    }
  }

  function openDup(b: Boat) {
    setShowDupFor(b);
    setDupSlug(`${b.slug}-copy`);
    setDupName(`${b.name} Copy`);
    setDupYear(b.modelYear ?? undefined);
  }

  async function doDuplicate() {
    if (!showDupFor) return;
    try {
      await BoatsApi.duplicate(showDupFor.id, {
        newSlug: dupSlug.trim(),
        newName: dupName.trim() || undefined,
        newModelYear: dupYear === undefined ? undefined : Number(dupYear)
      });
      setShowDupFor(null);
      load();
    } catch (e: unknown) { 
      const message = e instanceof Error ? e.message : String(e);
      alert(message); 
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Boats</h1>

      <div className="flex items-center justify-between">
        <div className="relative w-96">
          <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-2 rounded-md bg-[#121212] border border-white/10 text-sm outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>

        <Link href="/admin/boat/new" className="inline-flex items-center gap-2 rounded-full border border-amber-600/50 text-amber-400 px-3 py-1.5 hover:bg-amber-500/10">
          <Plus className="size-4" /> Add New
        </Link>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#1f1f1f] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/30 border-b border-white/10 text-white/80">
            <tr>
              <th className="text-left px-4 py-2 w-32">Model Year</th>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2 w-28">Status</th>
              <th className="px-2 py-2 w-[140px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr key={b.id} className={`${i%2===0?"bg-white/[0.02]":""} border-b border-white/5`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded bg-black/50 border border-white/10 overflow-hidden">
                      {b.heroImageUrl ? (
                        <Image src={b.heroImageUrl} alt="" width={32} height={32} className="w-8 h-8 object-cover" />
                      ) : (
                        <div className="w-8 h-8 flex items-center justify-center text-white/40">🚤</div>
                      )}
                    </div>
                    <span className="font-mono">{b.modelYear ?? "-"}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/boat/${b.id}`} className="hover:underline">{b.name}</Link>
                  <div className="text-white/50 text-xs">{b.slug}</div>
                </td>
                <td className="px-4 py-3">
                  {b.isActive ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-600/20 text-emerald-300 px-2 py-0.5 text-xs">Active</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-white/10 text-white/70 px-2 py-0.5 text-xs">Inactive</span>
                  )}
                </td>
                <td className="px-2 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      href={`/admin/boat/${b.id}`}
                      title="Edit"
                      className="p-1.5 rounded-full border border-white/15 hover:bg-white/10"
                    >
                      <Edit className="size-4" />
                    </Link>
                    <button
                      onClick={() => toggleActive(b.id)}
                      title="Toggle active"
                      className="p-1.5 rounded-full border border-white/15 hover:bg-white/10"
                    >
                      <RefreshCw className="size-4" />
                    </button>
                    <button
                      onClick={() => openDup(b)}
                      title="Duplicate"
                      className="p-1.5 rounded-full border border-white/15 hover:bg-white/10"
                    >
                      <Copy className="size-4" />
                    </button>
                    <button
                      onClick={() => deleteBoat(b.id)}
                      title="Delete"
                      className="p-1.5 rounded-full border border-white/15 hover:bg-white/10"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {busy && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-white/60">Loading…</td></tr>
            )}
            {!busy && rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-white/60">No boats found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Duplicate modal */}
      {showDupFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-[520px] rounded-lg border border-white/10 bg-[#1f1f1f] p-4">
            <h3 className="text-lg font-semibold mb-2">Duplicate “{showDupFor.name}”</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-white/70">New Slug</label>
                <input value={dupSlug} onChange={e=>setDupSlug(e.target.value)} className="w-full bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2" />
              </div>
              <div>
                <label className="text-sm text-white/70">New Name</label>
                <input value={dupName} onChange={e=>setDupName(e.target.value)} className="w-full bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2" />
              </div>
              <div>
                <label className="text-sm text-white/70">New Model Year</label>
                <input type="number" value={dupYear} onChange={e=>setDupYear(e.target.value ? Number(e.target.value) : undefined)} className="w-full bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>setShowDupFor(null)} className="px-3 py-1.5 rounded-md border border-white/15">Cancel</button>
              <button onClick={doDuplicate} className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-black">Create Copy</button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="text-red-400 text-sm">{error}</div>}
    </div>
  );
}
