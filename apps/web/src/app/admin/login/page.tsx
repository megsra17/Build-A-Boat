"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
    const r = useRouter();
    const [email, setEmail] = useState("admin@example.com");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string| null>(null);
    const API = process.env.NEXT_PUBLIC_API_BASE;

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        try{
            const res = await fetch(`${API}/api/login`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ email, password })
            });
            if(!res.ok) throw new Error(await res.text());
            const data = await res.json();
            //store tokens
            localStorage.setItem("admin_token", data.token);
            localStorage.setItem("admin_user", JSON.stringify(data.user));
            r.push("/admin/boats");
        }
        catch (e: unknown) {
         setError(String(e instanceof Error ? e.message : e));
        }
    }

    return(
        <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm border rounded p-6 space-y-4">
        <h1 className="text-xl font-semibold">Admin Login</h1>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input className="w-full border rounded p-2" value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input type="password" className="w-full border rounded p-2" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <button className="w-full bg-black text-white rounded p-2">Sign in</button>
      </form>
    </main>
    );
}