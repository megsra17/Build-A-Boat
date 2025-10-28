"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BoatsApi, type Boat } from "@/app/lib/admin-api";
import BoatSummaryCard from "./edit/BoatSummaryCard";
import Configurations from "./edit/Configurations";

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
  const [boat, setBoat] = useState<(Boat & { categoryId?: string | null; config?: { groups: any[] } }) | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [groups, setGroups] = useState<any[]>([]);

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

        // Fetch groups for boat
        const groupsRes = await fetch(`${API}/admin/boat/${id}/groups`, {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        });
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json();
          setGroups(groupsData || []);
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
       <Configurations
        boatId={boat.id}
        initial={{
            boatId: boat.id,
            groups: (groups && Array.isArray(groups) && groups.length > 0) ? groups.map((g: any) => ({
              id: g.id,
              name: g.name,
              categories: (g.categories && Array.isArray(g.categories)) ? g.categories.map((c: any) => ({
                id: c.id,
                name: c.name,
                options: []
              })) : []
            })) : [
              { id: crypto.randomUUID(), name: "Exterior", categories: [] },
            ],
        }}
        />
    </div>
  );
}
