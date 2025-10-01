"use client";

import { useEffect, useState } from "react";
import { Fan } from "lucide-react";

// Use the same API detection logic as admin-api.ts
const getApiBase = () => {
  if (process.env.NODE_ENV === 'production') {
    const envUrl = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL;
    const railwayUrl = 'https://build-a-boat-production.up.railway.app';
    
    console.log("Dashboard - Production environment detected");
    console.log("Dashboard - NEXT_PUBLIC_API_BASE:", process.env.NEXT_PUBLIC_API_BASE);
    console.log("Dashboard - Using URL:", envUrl || railwayUrl);
    
    return envUrl || railwayUrl;
  }
  
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5199";
};

const API = getApiBase();

export default function AdminHome() {
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() =>{
  async function load() {
    try{
      const token = localStorage.getItem("jwt");
      
      console.log("Dashboard - API URL:", API);
      console.log("Dashboard - Token exists:", !!token);
      console.log("Dashboard - Token length:", token?.length || 0);
      
      if (!token) {
        console.error("No authentication token found");
        return;
      }

      const url = `${API}/admin/users/count`;
      console.log("Dashboard - Calling URL:", url);

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log("Dashboard - Response status:", res.status);
      console.log("Dashboard - Response headers:", Object.fromEntries(res.headers.entries()));
      
      if(!res.ok) {
        const errorText = await res.text();
        console.error("API Error:", errorText);
        throw new Error(`Failed to fetch user count: ${res.status}`);
      }
      
      const data = await res.json();
      console.log("Dashboard - User count data:", data);
      setUserCount(data.count);
    }
    catch(err){
      console.error("Load error:", err);
    }
  }
  load();
  }, []);

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
            <div className="text-6xl font-light tracking-tight">{userCount !== null ? userCount : "..."}</div>
            <Fan className="absolute right-4 bottom-2 size-16 text-white/15" />
          </div>
        </section>
      </div>
    </div>
  );
}
