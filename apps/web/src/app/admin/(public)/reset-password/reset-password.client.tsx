"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordClient() {
  const sp = useSearchParams();               
  const token = sp.get("token") || "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  
  // Use the same API detection logic as admin-api.ts
  const getApiBase = () => {
    if (process.env.NODE_ENV === 'production') {
      const envUrl = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL;
      return envUrl || 'https://build-a-boat-production.up.railway.app';
    }
    return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5199";
  };

  const API = getApiBase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMessage(null);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to reset password.");
      setMessage("Your password has been updated. You can now sign in.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md bg-[#1f1f1f] border border-white/10 rounded-xl p-6 text-white">
        <h1 className="text-xl font-semibold mb-4">Reset Password</h1>
        {err && <p className="text-red-400 mb-3">{err}</p>}
        {message && <p className="text-emerald-400 mb-3">{message}</p>}
        <input
          type="password"
          className="w-full p-2 mb-4 rounded bg-black/30 border border-white/20"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="w-full bg-amber-500 hover:bg-amber-400 text-black rounded py-2" type="submit">
          Update Password
        </button>
      </form>
    </main>
  );
}
