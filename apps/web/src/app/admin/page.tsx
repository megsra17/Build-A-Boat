"use client";

import { Fan } from "lucide-react";

export default function AdminHome() {
  return (
    <div className="space-y-4">
      {/* Page title matches top bar “Login” in screenshot */}
      <h1 className="text-2xl font-semibold">Login</h1>

      {/* Stat card row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <section className="rounded-lg border border-white/10 bg-[#1f1f1f] overflow-hidden">
          <header className="px-3 py-2 border-b border-white/10 text-sm text-white/80">
            Active Users
          </header>
          <div className="relative p-6 h-28 flex items-center">
            <div className="text-6xl font-light tracking-tight">7</div>
            <Fan className="absolute right-4 bottom-2 size-16 text-white/15" />
          </div>
        </section>
      </div>
    </div>
  );
}
