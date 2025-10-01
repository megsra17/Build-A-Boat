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
        <div><span className="text-white/60">Email:</span> {user?.Email ?? "-"}</div>
        <div><span className="text-white/60">Role:</span> {user?.Role ?? "-"}</div>
        <div><span className="text-white/60">Username:</span> {user?.Username ?? "-"}</div>
        <div><span className="text-white/60">First Name:</span> {user?.FirstName ?? "-"}</div>
        <div><span className="text-white/60">Last Name:</span> {user?.LastName ?? "-"}</div>
        <div><span className="text-white/60">Timezone:</span> {user?.Timezone ?? "-"}</div>
      </div>
    </div>
  );
}