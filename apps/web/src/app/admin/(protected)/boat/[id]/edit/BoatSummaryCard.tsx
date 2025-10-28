"use client";

import { useState, useEffect } from "react";
import { Check, X, PencilLine} from "lucide-react";
import FolderBrowser from "@/app/components/FolderBrowser";

// Adjust to your types
type Category = { id: string; name: string };
type Boat = {
  id: string;
  slug: string;
  modelYear?: number | null;
  name: string;
  basePrice: number;
  isActive: boolean;
  categoryId?: string | null;
  categoryName?: string;
  msrp?: number | null;
  heroImageUrl?: string | null;        
  primaryImageUrl?: string | null;     
  secondaryImageUrl?: string | null;
  sideImageUrl?: string | null;
  logoImageUrl?: string | null;
  graphicLogoUrl?: string | null;
};

// Get API base URL
const getApiBase = () => {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_API_BASE || 'https://build-a-boat-production.up.railway.app';
  }
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5199";
};

// Stub; replace with your lib
const BoatsApi = {
  update: async (id: string, body: unknown) => {
    const apiUrl = getApiBase();
    const jwt = typeof window !== 'undefined' ? (localStorage.getItem("jwt") || sessionStorage.getItem("jwt")) : null;
    
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }
    
    const res = await fetch(`${apiUrl}/admin/boat/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

export default function BoatTopSection({
  boat,
  categories,
  onUpdated, // callback(boat) when saved
}: {
  boat: Boat;
  categories: Category[];
  onUpdated?: (b: Boat) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // local form state for edit mode
  const [modelYear, setModelYear] = useState(boat.modelYear ?? new Date().getFullYear());
  const [name, setName] = useState(boat.name ?? "");
  const [basePrice, setBasePrice] = useState(boat.basePrice ?? 0);
  const [boatCategories, setBoatCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const [primary, setPrimary] = useState(boat.primaryImageUrl ?? "");
  const [secondary, setSecondary] = useState(boat.secondaryImageUrl ?? "");
  const [side, setSide] = useState(boat.sideImageUrl ?? "");
  const [logo, setLogo] = useState(boat.graphicLogoUrl ?? "");

  useEffect(() => {
    // Fetch boat's categories when component mounts
    (async () => {
      try {
        const jwt = typeof window !== 'undefined' ? (localStorage.getItem("jwt") || sessionStorage.getItem("jwt")) : null;
        const apiUrl = getApiBase();
        const res = await fetch(`${apiUrl}/admin/boat/${boat.id}/category`, {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        });
        if (res.ok) {
          const cats = await res.json();
          setBoatCategories(Array.isArray(cats) ? cats : cats?.items || []);
        }
      } catch (e) {
        console.error("Failed to fetch categories:", e);
      }
    })();
  }, [boat.id]);

  function enterEdit() {
    // seed form from current boat (safe if user cancelled previously)
    setModelYear(boat.modelYear ?? new Date().getFullYear());
    setName(boat.name ?? "");
    setBasePrice(boat.basePrice ?? 0);
    setPrimary(boat.primaryImageUrl ?? "");
    setSecondary(boat.secondaryImageUrl ?? "");
    setSide(boat.sideImageUrl ?? "");
    setLogo(boat.graphicLogoUrl ?? "");
    setSelectedCategoryId("");
    setErr(null);
    setEditing(true);
  }

  async function assignCategory() {
    if (!selectedCategoryId) return;
    
    // Check if already assigned
    if (boatCategories.some(c => c.id === selectedCategoryId)) {
      setErr("Category already assigned to this boat");
      return;
    }
    
    try {
      const jwt = typeof window !== 'undefined' ? (localStorage.getItem("jwt") || sessionStorage.getItem("jwt")) : null;
      const apiUrl = getApiBase();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (jwt) {
        headers["Authorization"] = `Bearer ${jwt}`;
      }
      
      // Find the category details from the available categories
      const categoryToAssign = categories.find(c => c.id === selectedCategoryId);
      if (!categoryToAssign) {
        throw new Error("Category not found");
      }
      
      // Create a new category record for this boat by updating the existing category
      const payload = {
        boatId: boat.id,
        name: categoryToAssign.name,
        sortOrder: boatCategories.length,
        isRequired: false,
      };
      
      
      const res = await fetch(`${apiUrl}/admin/category`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        const newCat = await res.json();
        setBoatCategories([...boatCategories, newCat]);
        setSelectedCategoryId("");
      } else {
        const errorText = await res.text();
        console.error("Failed to assign category:", errorText);
        throw new Error(errorText || `HTTP ${res.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to assign category";
      console.error(msg);
      setErr(msg);
    }
  }

  async function deleteCategory(categoryId: string) {
    try {
      const jwt = typeof window !== 'undefined' ? (localStorage.getItem("jwt") || sessionStorage.getItem("jwt")) : null;
      const apiUrl = getApiBase();
      const headers: Record<string, string> = {};
      if (jwt) {
        headers["Authorization"] = `Bearer ${jwt}`;
      }
      
      const res = await fetch(`${apiUrl}/admin/category/${categoryId}`, {
        method: "DELETE",
        headers,
      });
      
      if (res.ok) {
        setBoatCategories(boatCategories.filter(c => c.id !== categoryId));
      } else {
        const errorText = await res.text();
        console.error("Failed to delete category:", errorText);
        throw new Error(errorText || `HTTP ${res.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete category";
      console.error(msg);
      setErr(msg);
    }
  }

  function cancel() {
    setEditing(false);
    setErr(null);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        slug: boat.slug,
        name: name.trim(),
        basePrice: Number(basePrice) || 0,
        modelYear: Number(modelYear),
        features: null, // or array of strings if needed
        primaryImageUrl: primary || null,
        secondaryImageUrl: secondary || null,
        sideImageUrl: side || null,
        logoImageUrl: logo || null,
      };
      
      const updated = await BoatsApi.update(boat.id, payload);
      
      // Refetch categories to ensure they're up to date
      const jwt = typeof window !== 'undefined' ? (localStorage.getItem("jwt") || sessionStorage.getItem("jwt")) : null;
      const apiUrl = getApiBase();
      const catRes = await fetch(`${apiUrl}/admin/boat/${boat.id}/category`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      });
      if (catRes.ok) {
        const cats = await catRes.json();
        const catList = Array.isArray(cats) ? cats : cats?.items || [];
        setBoatCategories(catList);
      }
      
      onUpdated?.(updated);
      setEditing(false);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Failed to save.";
      console.error("Save error:", errorMessage);
      setErr(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  // READ-ONLY MODE
  if (!editing) {
    return (
      <section className="relative rounded-lg bg-[#111] border border-white/10 p-5">
        {/* header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white/90">
            <h2 className="text-xl font-semibold">{boat.modelYear} {boat.name}</h2>
          </div>
          <button
            onClick={enterEdit}
            className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 px-3 py-1.5 text-sm"
            aria-label="Edit top section"
          >
            <PencilLine className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-[380px_1fr] gap-8">
          {/* Primary image */}
          <div className="rounded-lg bg-black/40 aspect-[16/9] flex items-center justify-center overflow-hidden">
            {boat.primaryImageUrl ? (
              <img src={boat.primaryImageUrl} className="w-full h-full object-contain" alt="" />
            ) : (
              <div className="text-white/40 text-sm">No image</div>
            )}
          </div>

          {/* quick specs */}
          <dl className="grid grid-cols-[160px_1fr] gap-x-6 gap-y-3 text-[15px]">
            <dt className="text-white/50">Model Year:</dt><dd>{boat.modelYear ?? "—"}</dd>
            <dt className="text-white/50">Name:</dt><dd>{boat.name ?? "—"}</dd>
            <dt className="text-white/50">MSRP:</dt><dd>${boat.basePrice?.toLocaleString() ?? "—"}</dd>
            <dt className="text-white/50">Categories:</dt>
            <dd>
              {Array.isArray(boatCategories) && boatCategories.length > 0
                ? boatCategories.map((c: Category) => c.name).join(", ")
                : "—"}
            </dd>
          </dl>
        </div>
      </section>
    );
  }

  // EDIT MODE
  return (
    <section className="relative rounded-lg bg-[#0f0f0f] border border-yellow-500/30 p-5">
      {/* header actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white/90">Basic Info</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={cancel}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 px-3 py-1.5 text-sm"
            aria-label="Cancel edits"
          >
            <X className="size-4" /> Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-yellow-500 text-black hover:bg-yellow-400 px-3 py-1.5 text-sm"
            aria-label="Save changes"
          >
            <Check className="size-4" /> {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {err && <div className="mb-3 text-sm text-red-300 bg-red-900/30 border border-red-600/40 rounded px-3 py-2">{err}</div>}

      {/* inputs row */}
      <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8">
        <Field label="Model Year">
          <input
            type="number"
            className="w-full bg-transparent border-b border-white/30 focus:border-white/70 outline-none py-1"
            value={modelYear}
            onChange={e => setModelYear(Number(e.target.value))}
          />
        </Field>

        <Field label="Name">
          <input
            type="text"
            className="w-full bg-transparent border-b border-white/30 focus:border-white/70 outline-none py-1"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Field>

        <Field label="MSRP / Base Price">
          <input
            type="number"
            className="w-full bg-transparent border-b border-white/30 focus:border-white/70 outline-none py-1"
            value={basePrice}
            onChange={e => setBasePrice(Number(e.target.value))}
          />
        </Field>
      </div>

      {/* Category management */}
      <div className="mt-8 pt-6 border-t border-white/10">
        <h3 className="text-lg font-medium text-white/90 mb-4">Categories</h3>
        
        {/* Display existing categories */}
        {boatCategories.length > 0 && (
          <div className="mb-4">
            <div className="space-y-2">
              {boatCategories.map((cat: Category) => (
                <div key={cat.id} className="flex items-center justify-between bg-black/30 rounded px-3 py-2 border border-white/10">
                  <span className="text-white/80">{cat.name}</span>
                  <button
                    type="button"
                    onClick={() => deleteCategory(cat.id)}
                    disabled={busy}
                    className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-900/20 transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Assign existing category */}
        <div className="flex gap-2">
          <select
            value={selectedCategoryId}
            onChange={e => setSelectedCategoryId(e.target.value)}
            className="flex-1 bg-black/50 border-b border-white/30 focus:border-white/70 outline-none py-1 text-white"
          >
            <option value="">Select a category to add...</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id} disabled={boatCategories.some(bc => bc.id === cat.id)}>
                {cat.name} {boatCategories.some(bc => bc.id === cat.id) ? "(already assigned)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={assignCategory}
            disabled={busy || !selectedCategoryId}
            className="px-4 py-1 rounded bg-yellow-600/40 text-yellow-300 hover:bg-yellow-600/60 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition"
          >
            Add
          </button>
        </div>
      </div>

      {/* image pickers – only shown in edit mode */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-white/90 mb-4">General Images</h3>
        <div className="grid md:grid-cols-4 sm:grid-cols-2 gap-8">
          <ImagePicker label="Primary Image" value={primary} onChange={setPrimary} />
          <ImagePicker label="Secondary Image" value={secondary} onChange={setSecondary} />
          <ImagePicker label="Side Image" value={side} onChange={setSide} />
          <ImagePicker label="Graphic Logo" value={logo} onChange={setLogo} round />
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <div className="text-white/60 mb-1">{label}</div>
      {children}
    </label>
  );
}

// Replace this with your actual uploader/select component.
// Keeping UX: preview when set, cloud-upload “drop” state when empty,
// and a small remove button.
function ImagePicker({
  label,
  value,
  onChange,
  round,
}: {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  round?: boolean;
}) {
  const [showBrowser, setShowBrowser] = useState(false);
  const jwt = typeof window !== 'undefined' ? (localStorage.getItem("jwt") || sessionStorage.getItem("jwt")) : null;

  const getApiBase = () => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      return process.env.NEXT_PUBLIC_API_BASE || 'https://build-a-boat-production.up.railway.app';
    }
    return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5199";
  };

  const apiUrl = getApiBase();

  const handleSelectImage = (media: { url: string; fileName?: string }) => {
    onChange(media.url);
    setShowBrowser(false);
  };

  return (
    <div>
      <div className="text-white/70 text-sm mb-2">{label}</div>
      <div
        className={[
          "relative bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden",
          round ? "rounded-full size-56" : "rounded-xl aspect-square",
        ].join(" ")}
      >
        {value ? (
          <>
            <img src={value} className="w-full h-full object-cover" alt="" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-2 right-2 size-7 rounded-full bg-black/70 hover:bg-black/60 border border-white/20 text-white"
              title="Remove"
            >
              ×
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowBrowser(true)}
            className="flex flex-col items-center justify-center text-white/50 hover:text-white gap-2"
          >
            <svg width="54" height="54" viewBox="0 0 24 24"><path fill="currentColor" d="M20.79 10H19V7a5 5 0 0 0-10 0v3H6.21A3.21 3.21 0 0 0 3 13.21v2.58A3.21 3.21 0 0 0 6.21 19h14.58A3.21 3.21 0 0 0 24 15.79v-2.58A3.21 3.21 0 0 0 20.79 10M11 7a3 3 0 0 1 6 0v3h-6Zm10 8.79A1.21 1.21 0 0 1 19.79 17H6.21A1.21 1.21 0 0 1 5 15.79v-2.58A1.21 1.21 0 0 1 6.21 12H19.8a1.21 1.21 0 0 1 1.2 1.21Z"/></svg>
            <span className="text-xs">Upload / Select</span>
          </button>
        )}
      </div>

      <FolderBrowser
        isOpen={showBrowser}
        onClose={() => setShowBrowser(false)}
        onSelect={handleSelectImage}
        apiUrl={apiUrl}
        jwt={jwt}
      />
    </div>
  );
}
