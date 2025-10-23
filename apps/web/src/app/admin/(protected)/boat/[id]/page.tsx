"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BoatsApi, type Boat } from "@/app/lib/admin-api";
import BoatSummaryCard from "./edit/BoatSummaryCard";

const getApiBase = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_API_BASE || 'https://build-a-boat-production.up.railway.app';
  }
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5199";
};

const API = getApiBase();

export default function EditBoatPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [boat, setBoat] = useState<(Boat & { categoryId?: string | null }) | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await BoatsApi.getById(id);
        setBoat(res);
        
        // Fetch categories
        const jwt = localStorage.getItem("jwt") || sessionStorage.getItem("jwt");
        const catRes = await fetch(`${API}/admin/category`, {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        });
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData?.items || []);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  }, [id]);

  if (busy) return <div className="text-white/70">Loading…</div>;
  if (err) return <div className="text-red-400">{err}</div>;
  if (!boat) return null;

  return (
    <div className="space-y-6">
      <BoatSummaryCard
        boat={boat}
        categories={categories}
        onUpdated={(next) => setBoat(next)}
      />
      {/* The rest of the editor (configurations, etc.) goes below */}
    </div>
  );
}
