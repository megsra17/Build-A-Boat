"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";

type UserInfo = { email: string; role?: string } | null;

function initialsFromEmail(email?: string) {
  if (!email) return "U";
  return email[0].toUpperCase();
}

export default function UserMenu({ user }: { user: UserInfo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click / Esc
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  function logout() {
    try {
      localStorage.removeItem("admin_jwt");
      localStorage.removeItem("admin_user");
      document.cookie = "admin=; Path=/; Max-Age=0";
    } catch {}
    window.location.href = "/admin/login";
  }

  const initials = initialsFromEmail(user?.email);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 bg-[#141414] rounded-full px-2 py-1 border border-white/10 hover:border-white/20"
      >
        <div className="size-6 rounded-full bg-orange-500 text-xs flex items-center justify-center">
          {initials}
        </div>
        <span className="text-sm pr-1">{user?.email ?? "Guest"}</span>
        <ChevronDown className={`size-4 opacity-70 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-[#121212] shadow-xl overflow-hidden"
        >
          <div className="px-3 py-2 text-xs text-white/60 border-b border-white/10">
            Signed in as <span className="text-white/80">{user?.email ?? "Guest"}</span>
          </div>

          <Link
            href="/admin/profile"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5"
            onClick={() => setOpen(false)}
          >
            <User className="size-4 opacity-80" />
            View Profile
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5"
          >
            <LogOut className="size-4 opacity-80" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
