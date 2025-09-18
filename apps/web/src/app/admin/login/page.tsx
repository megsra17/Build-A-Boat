"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, LogIn } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE!;
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1";

export default function AdminLoginPage() {
  const r = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin/boats";

  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Invalid email or password.");
      const data = await res.json();

      if (remember) localStorage.setItem("admin_jwt", data.token);
      else sessionStorage.setItem("admin_jwt", data.token);
      localStorage.setItem("admin_user", JSON.stringify(data.user));
      document.cookie = `admin=ok; Path=/; Max-Age=${60 * 60 * 8}`;

      r.replace(next);
    } catch (e: unknown) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  function devBypass() {
    const token = "DEV_FAKE_TOKEN";
    if (remember) localStorage.setItem("admin_jwt", token);
    else sessionStorage.setItem("admin_jwt", token);
    localStorage.setItem("admin_user", JSON.stringify({ email, role: "admin" }));
    document.cookie = `admin=ok; Path=/; Max-Age=${60 * 60 * 8}`;
    r.replace(next);
  }

  return (
    <div
      className="relative min-h-screen w-full bg-cover bg-center"
      style={{ backgroundImage: "url('/login-bg.jpeg')" }}
    >
      {/* dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* login panel */}
      <main className="relative z-10 flex min-h-screen items-center justify-end px-6">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md space-y-6 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 p-8"
        >
          {/* Logo / Title */}
          <div className="flex items-center justify-center mb-4">
            <span className="text-3xl font-semibold tracking-wide text-white/90">
              vanderbilt
            </span>
          </div>

          <p className="text-sm text-white/70 text-center">
            Please enter your username and password below to sign in and manage your account.
          </p>

          {err && (
            <div className="text-sm text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
              {err}
            </div>
          )}

          {/* Email */}
          <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/40 px-3 py-2">
            <Mail className="size-4 text-white/60" />
            <input
              type="email"
              required
              placeholder="Username / Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent outline-none text-white placeholder:text-white/40"
            />
          </div>

          {/* Password */}
          <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/40 px-3 py-2">
            <Lock className="size-4 text-white/60" />
            <input
              type={showPw ? "text" : "password"}
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent outline-none text-white placeholder:text-white/40"
            />
            <button
              type="button"
              aria-label={showPw ? "Hide password" : "Show password"}
              onClick={() => setShowPw((s) => !s)}
              className="p-1 text-white/70 hover:text-white"
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between text-sm">
            <label className="inline-flex items-center gap-2 text-white/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-white/80"
              />
              Remember Me
            </label>
            <a href="/admin/forgot-password" className="text-amber-400/90 hover:text-amber-300">
              Forgot Password?
            </a>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={busy}
            className="group inline-flex items-center justify-center gap-2 w-full rounded-xl bg-amber-500/90 hover:bg-amber-400 px-4 py-2 text-black font-medium transition"
          >
            <LogIn className="size-4 opacity-80 group-hover:translate-x-0.5 transition" />
            {busy ? "Logging in…" : "Login"}
          </button>

          {/* Dev bypass */}
          {DEV_BYPASS && (
            <button
              type="button"
              onClick={devBypass}
              className="w-full rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2 text-white/80"
            >
              Dev bypass (no API)
            </button>
          )}
        </form>
      </main>
    </div>
  );
}
