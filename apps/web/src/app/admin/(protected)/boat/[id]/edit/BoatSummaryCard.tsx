"use client";

import { useMemo, useState } from "react";
import { Check, X, PencilLine } from "lucide-react";

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

// Stub; replace with your lib
const BoatsApi = {
  update: async (id: string, body: any) => {
    const res = await fetch(`/api/admin/boats/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

function money(n?: number | null) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

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
  const [categoryId, setCategoryId] = useState<string | "">(boat.categoryId ?? "");
  const [msrp, setMsrp] = useState(boat.msrp ?? undefined);

  const [primary, setPrimary] = useState(boat.primaryImageUrl ?? "");
  const [secondary, setSecondary] = useState(boat.secondaryImageUrl ?? "");
  const [side, setSide] = useState(boat.sideImageUrl ?? "");
  const [logo, setLogo] = useState(boat.graphicLogoUrl ?? "");

  const catLabel = useMemo(
    () => categories.find(c => c.id === (boat.categoryId ?? ""))?.name ?? boat.categoryName ?? "—",
    [categories, boat.categoryId, boat.categoryName]
  );

  function enterEdit() {
    // seed form from current boat (safe if user cancelled previously)
    setModelYear(boat.modelYear ?? new Date().getFullYear());
    setName(boat.name ?? "");
    setCategoryId(boat.categoryId ?? "");
    setMsrp(boat.msrp ?? undefined);
    setPrimary(boat.primaryImageUrl ?? "");
    setSecondary(boat.secondaryImageUrl ?? "");
    setSide(boat.sideImageUrl ?? "");
    setLogo(boat.graphicLogoUrl ?? "");
    setErr(null);
    setEditing(true);
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
        modelYear: Number(modelYear),
        name: name.trim(),
        categoryId: categoryId || null,
        msrp: msrp ?? null,
        primaryImageUrl: primary || null,
        secondaryImageUrl: secondary || null,
        sideImageUrl: side || null,
        graphicLogoUrl: logo || null,
      };
      const updated = await BoatsApi.update(boat.id, payload);
      onUpdated?.(updated);
      setEditing(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save.");
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
            <svg width="20" height="20" viewBox="0 0 24 24" className="opacity-80"><path fill="currentColor" d="M3 19h18v2H3zm14-8l5 6H2l6-7l4 5zM7 7a3 3 0 1 1 6 0a3 3 0 0 1-6 0"/></svg>
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
          {/* hero / static image */}
          <div className="rounded-lg bg-black/40 aspect-[16/9] flex items-center justify-center overflow-hidden">
            {boat.heroImageUrl ? (
              <img src={boat.heroImageUrl} className="w-full h-full object-contain" alt="" />
            ) : (
              <div className="text-white/40 text-sm">No image</div>
            )}
          </div>

          {/* quick specs */}
          <dl className="grid grid-cols-[160px_1fr] gap-x-6 gap-y-3 text-[15px]">
            <dt className="text-white/50">Model Year:</dt><dd>{boat.modelYear ?? "—"}</dd>
            <dt className="text-white/50">Name:</dt><dd>{boat.name ?? "—"}</dd>
            <dt className="text-white/50">Category:</dt><dd>{catLabel}</dd>
            <dt className="text-white/50">MSRP:</dt><dd>{money(boat.msrp)}</dd>
            {/* Add Start Build Link here if you store it */}
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

        <Field label="Category">
          <div className="relative">
            <select
              className="w-full bg-transparent border-b border-white/30 focus:border-white/70 outline-none py-1 pr-6"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-0 top-1.5 text-white/60">▾</span>
          </div>
        </Field>

        <Field label="MSRP">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className="w-full bg-transparent border-b border-white/30 focus:border-white/70 outline-none py-1"
            value={msrp ?? ""}
            onChange={e => setMsrp(e.target.value === "" ? undefined : Number(e.target.value))}
            placeholder="e.g. 125000"
          />
        </Field>
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
            onClick={async () => {
              // TODO: open your media picker/uploader and get a URL
              // For now, prompt:
              const url = prompt("Paste image URL");
              if (url) onChange(url);
            }}
            className="flex flex-col items-center justify-center text-white/50 hover:text-white gap-2"
          >
            <svg width="54" height="54" viewBox="0 0 24 24"><path fill="currentColor" d="M20.79 10H19V7a5 5 0 0 0-10 0v3H6.21A3.21 3.21 0 0 0 3 13.21v2.58A3.21 3.21 0 0 0 6.21 19h14.58A3.21 3.21 0 0 0 24 15.79v-2.58A3.21 3.21 0 0 0 20.79 10M11 7a3 3 0 0 1 6 0v3h-6Zm10 8.79A1.21 1.21 0 0 1 19.79 17H6.21A1.21 1.21 0 0 1 5 15.79v-2.58A1.21 1.21 0 0 1 6.21 12H19.8a1.21 1.21 0 0 1 1.2 1.21Z"/></svg>
            <span className="text-xs">Upload / Select</span>
          </button>
        )}
      </div>
    </div>
  );
}
