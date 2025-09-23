"use client";

import { useEffect, useMemo, useState } from "react";
import { UsersApi, UserRow } from "../../lib/admin-api";
import { Search, X } from "lucide-react";
import { useRouter } from "next/router";

function initials(name?: string) {
    if(name && name.trim()){
        const parts = name.trim().split(/\s+/);
        return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
    }
    return "A";
}

function formatDate(iso: string) {
    try{
        const d = new Date(iso);
        return d.toLocaleString(undefined, { month:"2-digit", day:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
    }catch{
        return iso;
    }
}

export default function UsersPage() {
    const [rows, setRows] = useState<UserRow[]>([]);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [busy, setBusy] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 25;
    const router = useRouter();

    async function load(){
        setBusy(true);
        try{
            const res = await UsersApi.list({ search, page, pageSize }) as { items: UserRow[], total: number };
            setRows(res.items);
            setTotal(res.total);
        } catch(e){
            console.error(e);
        } finally {
            setBusy(false);
        }
    }

    useEffect(() =>{
        load();
    }, [page]);
    useEffect(() =>{
        const t = setTimeout(() => {
            setPage(1);
            load();
        }, 500);
        return () => clearTimeout(t);
    }, [search]);

    const pages = Math.max(1, Math.ceil(total / pageSize));

    async function deleteUser(id: string) {
        if(!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
        await UsersApi.delete(id);
        load();
    }

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Users</h1>

            <div className="flex items-center justify-between">
                <div className="relative w-80">
                    <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-white/50" />
                    <input value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-8 pr-8 py-2 rounded-md bg-[#121212] border border-white/20 text-sm outline-none focus:ring-2 focus:ring-white/10"/>
                    {search && (
                         <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                        <X className="size-4" />
                        </button>
                    )}
                </div>
                <button onClick={() => router.push("/admin/users/new")} className="rounded-md bg-amber-600 hover:bg-amber-500 text-black font-medium px-3 py-2 text-sm">Add User</button>
            </div>

            {/* Table */}
      <div className="rounded-lg border border-white/10 bg-[#1f1f1f] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/30 border-b border-white/10 text-white/80">
            <tr>
              <th className="text-left px-4 py-2 w-1/5">Name</th>
              <th className="text-left px-4 py-2 w-1/5">Username</th>
              <th className="text-left px-4 py-2 w-1/5">Email</th>
              <th className="text-left px-4 py-2 w-1/5">Role</th>
              <th className="text-left px-4 py-2 w-1/5">Created</th>
              <th className="px-2 py-2 w-[60px]">Updated</th>
              <th className="px-2 py-2 w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u, i) => {
              const name = u.username || u.email.split("@")[0];
              const even = i % 2 === 0;
              return (
                <tr key={u.id} className={`${even ? "bg-white/[0.02]" : ""} border-b border-white/5`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center size-7 rounded-full bg-emerald-500 text-xs font-semibold">
                        {initials(name)}
                      </span>
                      <span>{name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-white/80">{u.username ?? ""}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3">{formatDate(u.createdAt.toISOString())}</td>
                  <td className="px-2 py-3">{formatDate(u.updatedAt.toISOString())}</td>
                  <td className="px-2 py-3 text-right">
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="size-6 rounded-full border border-white/15 hover:bg-white/10"
                      title="Delete user"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
            {!busy && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-white/60">No users found.</td></tr>
            )}
            {busy && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-white/60">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-2 text-sm text-white/70">
        <span>{(rows.length ? (page - 1) * pageSize + 1 : 0)}–{(page - 1) * pageSize + rows.length} of {total}</span>
        <div className="ml-auto flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 rounded border border-white/10 disabled:opacity-40">Prev</button>
          <span>Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))} className="px-2 py-1 rounded border border-white/10 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}