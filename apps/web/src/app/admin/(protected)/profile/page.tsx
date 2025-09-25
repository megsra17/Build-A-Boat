"use client";
import { useEffect, useState } from "react";

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        try {
            setUser(JSON.parse(localStorage.getItem("admin_user") || "null"));
        } catch { }
    }, []);

    return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Your Profile</h1>
      <div className="rounded-lg border border-white/10 bg-[#1f1f1f] p-4 text-white/80">
        <div><span className="text-white/60">Name:</span> {user?.name ?? "-"}</div>
        <div><span className="text-white/60">Email:</span> {user?.email ?? "-"}</div>
        <div><span className="text-white/60">Timezone:</span> {user?.timezone ?? "-"}</div>
      </div>
    </div>
  );
}