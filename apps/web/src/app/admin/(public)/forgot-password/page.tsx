"use client";

import { useState } from "react";

// Use the same API detection logic as admin-api.ts
const getApiBase = () => {
  if (process.env.NODE_ENV === 'production') {
    const envUrl = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL;
    return envUrl || 'https://build-a-boat-production.up.railway.app';
  }
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5199";
};

const API = getApiBase();export default function AdminForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        try{
            const res = await fetch(`${API}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if(!res.ok) throw new Error(data?.message || "Failed to send reset email.");
            setMessage("If that email is registered, a password reset link has been sent.");
        }
        catch(e: unknown) {
            setErr(String(e instanceof Error ? e.message : e));
        }
    }

    return(
    <div
      className="relative min-h-screen w-full bg-cover bg-center"
      style={{ backgroundImage: "url('/login-bg.jpeg')" }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <main className="relative z-10 flex min-h-screen items-center justify-end px-6">
        <form onSubmit={submit} className="w-full max-w-md bg-white/10 p-6 rounded-xl text-white">
             <h1 className="text-xl font-semibold mb-4">Forgot Password</h1>
            {err && <p className="text-red-400">{err}</p>}
            {message && <p className="text-green-400">{message}</p>}
            <input className="w-full p-2 mb-4 rounded bg-black/30 border border-white/20"
             type="email"
             placeholder="Enter email"
            value={email}
             onChange={(e) => setEmail(e.target.value)}
            required/>
         <button className="w-full bg-amber-500 hover:bg-amber-500 text-black rounded py-2" type="submit">Submit</button>
         <button className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-white rounded py-2" type="button" onClick={() => window.location.href = "/admin/login"}>Back to Login</button>
         </form>
      </main>
    </div>
);
}

