"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { BoatsApi, type Boat } from "@/app/lib/admin-api";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function EditBoatPage() {
  const router = useRouter();
  const params = useParams();
  const boatId = params.id as string;

  const [boat, setBoat] = useState<Boat | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [modelYear, setModelYear] = useState<number | undefined>(undefined);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [features, setFeatures] = useState("");
  const [primaryImageUrl, setPrimaryImageUrl] = useState("");
  const [secondaryImageUrl, setSecondaryImageUrl] = useState("");
  const [sideImageUrl, setSideImageUrl] = useState("");
  const [logoImageUrl, setLogoImageUrl] = useState("");

  useEffect(() => {
    loadBoat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boatId]);

  async function loadBoat() {
    try {
      setLoading(true);
      setError("");
      
      // Get the boat from the boats list API since we don't have a single boat endpoint
      const res = await BoatsApi.list();
      const foundBoat = res.items.find(b => b.id === boatId);
      
      if (!foundBoat) {
        setError("Boat not found");
        return;
      }

      setBoat(foundBoat);
      
      // Populate form fields
      setName(foundBoat.name);
      setSlug(foundBoat.slug);
      setModelYear(foundBoat.modelYear ?? undefined);
      setBasePrice(foundBoat.basePrice);
      setIsActive(foundBoat.isActive);
      setHeroImageUrl(foundBoat.heroImageUrl || "");
      
      // For the new fields, we'll need to fetch from a detailed endpoint if available
      // For now, initialize as empty
      setFeatures("");
      setPrimaryImageUrl("");
      setSecondaryImageUrl("");
      setSideImageUrl("");
      setLogoImageUrl("");
      
    } catch (err) {
      setError("Failed to load boat");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await BoatsApi.update(boatId, {
        Slug: slug.trim(),
        Name: name.trim(),
        BasePrice: basePrice,
        ModelYear: modelYear || new Date().getFullYear(),
        Features: features.trim() ? features.split('\n').filter(f => f.trim()) : null,
        PrimaryImageUrl: primaryImageUrl.trim() || null,
        SecondaryImageUrl: secondaryImageUrl.trim() || null,
        SideImageUrl: sideImageUrl.trim() || null,
        LogoImageUrl: logoImageUrl.trim() || null,
        LayerMediaIds: null
      });

      router.push("/admin/boat");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save boat";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/boat" className="p-2 rounded-full border border-white/15 hover:bg-white/10">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-3xl font-semibold">Loading...</h1>
        </div>
      </div>
    );
  }

  if (error && !boat) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/boat" className="p-2 rounded-full border border-white/15 hover:bg-white/10">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-3xl font-semibold">Error</h1>
        </div>
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/boat" className="p-2 rounded-full border border-white/15 hover:bg-white/10">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-3xl font-semibold">Edit Boat</h1>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || !slug.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium"
        >
          <Save className="size-4" />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {error && (
        <div className="text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="space-y-6">
          <div className="rounded-lg border border-white/10 bg-[#1f1f1f] p-6">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Boat Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#151515] border border-white/10 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Enter boat name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Slug *
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-2 bg-[#151515] border border-white/10 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="boat-slug"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Model Year
                </label>
                <input
                  type="number"
                  value={modelYear || ""}
                  onChange={(e) => setModelYear(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 bg-[#151515] border border-white/10 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Base Price
                </label>
                <input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-[#151515] border border-white/10 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="50000"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-amber-600 bg-[#151515] border-white/10 rounded focus:ring-amber-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-white/70">
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="rounded-lg border border-white/10 bg-[#1f1f1f] p-6">
            <h2 className="text-xl font-semibold mb-4">Features</h2>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Features (JSON or text)
              </label>
              <textarea
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-[#151515] border border-white/10 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                placeholder="Enter boat features..."
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="space-y-6">
          <div className="rounded-lg border border-white/10 bg-[#1f1f1f] p-6">
            <h2 className="text-xl font-semibold mb-4">Images</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Hero Image URL
                </label>
                <input
                  type="url"
                  value={heroImageUrl}
                  onChange={(e) => setHeroImageUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#151515] border border-white/10 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="https://example.com/hero.jpg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Primary Image URL
                </label>
                <input
                  type="url"
                  value={primaryImageUrl}
                  onChange={(e) => setPrimaryImageUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#151515] border border-white/10 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="https://example.com/primary.jpg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Secondary Image URL
                </label>
                <input
                  type="url"
                  value={secondaryImageUrl}
                  onChange={(e) => setSecondaryImageUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#151515] border border-white/10 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="https://example.com/secondary.jpg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Side Image URL
                </label>
                <input
                  type="url"
                  value={sideImageUrl}
                  onChange={(e) => setSideImageUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#151515] border border-white/10 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="https://example.com/side.jpg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Logo Image URL
                </label>
                <input
                  type="url"
                  value={logoImageUrl}
                  onChange={(e) => setLogoImageUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#151515] border border-white/10 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="https://example.com/logo.jpg"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
