"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Cog, Gauge, Users, Ship, Shield } from "lucide-react";
import UserMenu from "../components/UserMenu";

const nav = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/roles", label: "Roles", icon: Shield },
  { href: "/admin/boats", label: "Boats", icon: Ship },
  { href: "/admin/settings", label: "Settings", icon: Cog },
];

interface User {
    id: string;
    email: string;
    role: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if(stored){
        try{
        setUser(JSON.parse(stored));
        } catch {

        } 
    }
  }, []);

  const initials = user?.email ? user.email.charAt(0).toUpperCase() : "A";

  return (
    <div className="min-h-screen bg-[#2c2c2c] text-white">
      {/* Top bar */}
      <header className="h-12 bg-[#1e1e1e] border-b border-white/10 flex items-center justify-between px-3">
        <div className="flex items-center gap-3">
          <img src="/logo-light.svg" onError={(e)=>((e.target as HTMLImageElement).style.display="none")} alt="" className="h-6" />
        </div>
        <UserMenu user={user} />
      </header>

      {/* Body */}
      <div className="grid grid-cols-[220px_1fr] gap-0">
        {/* Sidebar */}
        <aside className="bg-[#171717] border-r border-white/10 min-h-[calc(100vh-3rem)]">
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-full bg-orange-500 text-sm flex items-center justify-center">{initials}</div>
              <div>
                <div className="text-xs text-white/70">Signed in</div>
                <div className="text-sm">{user?.email ?? "Guest"}</div>
              </div>
            </div>
          </div>

          <nav className="px-2 py-3 space-y-1">
            {nav.map((item) => {
              const active = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center justify-between rounded px-3 py-2 text-sm border
                    ${active
                      ? "border-amber-600/50 bg-[#1f1f1f]"
                      : "border-transparent hover:border-white/10 hover:bg-white/5"}`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 opacity-80" />
                    {item.label}
                  </span>
                  {/* tiny right icon spot, matching your screenshot */}
                  <span className={`size-5 rounded-full border ${active ? "border-amber-600/60" : "border-white/10"} opacity-70`} />
                </Link>
              );
            })}
          </nav>

          <div className="p-3 text-xs text-white/40 mt-auto">
            <div className="border-t border-white/10 pt-3">© {new Date().getFullYear()} Vanderbilt</div>
          </div>
        </aside>

        {/* Content */}
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
}
