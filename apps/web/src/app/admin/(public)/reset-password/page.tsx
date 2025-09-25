"use client";

import {useState} from "react";
import { useSearchParams, useRouter } from "next/navigation"; 

const API = process.env.NEXT_PUBLIC_API_BASE!;

export default function ResetPasswordPage() {
    const sp = useSearchParams();
    const r = useRouter();
    const token = sp.get("token");

    const [password, setPassword] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        try{
            const res = await fetch(`${API}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if(!res.ok) throw new Error(data?.message || "Failed to reset password.");
            setMsg("Password has been reset. Redirecting to login...");
            setTimeout(() => r.replace("/admin/login"), 3000);
        }
        catch(e: unknown) {
            setErr(String(e instanceof Error ? e.message : e));
        }
    }

    return(
        <main className="flex min-h-screen items-center justify-center bg-black/80">
            <form
            onSubmit={submit}
            className="w-full max-w-md bg-white/10 p-6 rounded-xl text-white">
                <h1 className="text-xl font-semibold mb-4">Reset Password</h1>
                {err && <p className="mb-4 text-red-400">{err}</p>}
                {msg && <p className="mb-4 text-green-400">{msg}</p>}
                <input type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 mb-4 rounded bg/black/30 border border-white/20"
                required/>
                <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black rounded py-2">Reset Password</button>
            </form>
        </main>
    )
}