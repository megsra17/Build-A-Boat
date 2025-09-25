"use client";

import {useEffect, useState} from "react";
import { RolesApi, Role } from "../../../lib/admin-api";
import { Search, Plus, X } from "lucide-react";
import { useRouter } from "next/router";
import { set } from "zod";

function Initial({ name }: { name: string }) {
  return <span className="inline-flex items-center justify-center size-7 rounded-full bg-orange-500 text-xs font-semibold">{(name[0]||"A").toUpperCase()}</span>;
}

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [search, setSearch] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [newOpen, setNewOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newSlug, setNewSlug] = useState("");

    async function load(){
        setBusy(true);
        setError("");
        try{
            const res = await RolesApi.list(search || undefined);
            setRoles(res.items);
        }catch(err: unknown){
            console.error(err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setBusy(false);
        }
    }

    useEffect(() =>{
        load();
    }, [])
    useEffect(() =>{
        const t = setTimeout(() => load(), 500);
        return () => clearTimeout(t);
    }, [search]);

    async function add(){
        if(!newName.trim()) return;
        try{
            await RolesApi.create({ name: newName.trim(), slug: newSlug.trim() || undefined });
            setNewOpen(false);
            setNewName("");
            setNewSlug("");
            load();
        }
        catch(err: unknown){
            console.error(err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        }
    }
    async function del(id: string){
        if(!confirm("Are you sure you want to delete this role? This action cannot be undone."))
            return;
        try{
            await RolesApi.delete(id);
            load();
        }
        catch(err: unknown){
            console.error(err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        }
    }

    return(
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Roles</h1>

            <div className="flex items-center justify-between">
                <div className="relative w-80">
                    <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-white/50"/>
                     <input className="w-full border border-white/20 bg-transparent py-1 pl-8 pr-2 text-sm text-white placeholder:text-white/50 focus:border-orange-500 focus:outline-none" placeholder="Search roles..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button onClick={() => setNewOpen(o => !o)} className="inline-flex items-center gap-2 rounded-full border border-amber-600/50 text-amber-400 px-3 py-1.5 hover:bg-amber-500/10">
                    <Plus className="size-4" /> New Role
                </button>
            </div>

            {newOpen && (
                <div className="flex items-center gap-3 rounded-md border border-white/10 bg-[#1f1f1f] p-3">
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Role name (e.g., Administrator)" className="flex-1 bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2" />
                <input value={newSlug} onChange={e=>setNewSlug(e.target.value)} placeholder="Slug (optional, e.g., admin)" className="w-64 bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2" />
                <button onClick={add} className="rounded-md bg-amber-600 hover:bg-amber-500 text-black px-3 py-2 text-sm">Save</button>
                <button onClick={()=>setNewOpen(false)} className="p-2 text-white/60 hover:text-white"><X className="size-4"/></button>
                </div>
            )}

            <div className="rounded-lg border border-white/10 bg-[#1f1f1f] overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-black/30 border-b border-white/10 text-white/80">
                        <tr>
                            <th className="text-left px-4 py-2 w-2/3">Name</th>
                            <th className="text-left px-4 py-2">Slug</th>
                            <th className="px-2 py-2 w-[40px]"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {roles.map((r,i) =>(
                           <tr key={r.id} className={`${i%2===0?"bg-white/[0.02]":""} border-b border-white/5`}>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Initial name={r.name} />
                                    <span>{r.name}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-white/80">{r.slug}</td>
                            <td className="px-2 py-3 text-right">
                                <button onClick={()=>del(r.id)} className="size-6 rounded-full border border-white/15 hover:bg-white/10" title="Delete">x</button>
                            </td>
                           </tr> 
                        ))}
                        {busy && <tr><td colSpan={3} className="px-4 py-6 text-center text-white/60">Loading…</td></tr>}
                    {!busy && roles.length===0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-white/60">No roles found.</td></tr>}
                    </tbody>
                </table>            
            </div>
        </div>
    )
}