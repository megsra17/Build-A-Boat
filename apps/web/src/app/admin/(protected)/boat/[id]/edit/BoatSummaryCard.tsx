"use client";

import { useEffect, useMemo, useState } from "react";
import { BoatsApi } from "@/app/lib/admin-api";
import { Pencil, Check, X } from "lucide-react";

export type BoatSummary = {
  id: string;
  modelYear: number;
  name: string;
  category: string;
  msrp?: number | null;
  features?: string | null;
  startBuildUrl?: string | null;
  heroUrl?: string | null;
};

type Props = {
  boatId: string;
  initial: BoatSummary; // pass from page load for instant paint
  onUpdated?: (next: BoatSummary) => void; // optional: notify parent
};

export default function BoatSummaryCard({ boatId, initial, onUpdated }: Props) {
  const [view, setView] = useState<"read" | "edit">("read");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [boat, setBoat] = useState<BoatSummary>(initial);

  // local edit state (so we can cancel)
  const [form, setForm] = useState<BoatSummary>(initial);

  useEffect(() => {
    setBoat(initial);
    setForm(initial);
  }, [initial?.id]);

  function onChange<K extends keyof BoatSummary>(key: K, value: BoatSummary[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      // PATCH only changed fields (optional; simple: send all)
      const patch: Partial<BoatSummary> = {
        modelYear: Number(form.modelYear),
        name: form.name?.trim(),
        category: form.category?.trim(),
        startBuildUrl: form.startBuildUrl?.trim() || null,
        msrp: form.msrp !== undefined && form.msrp !== null ? Number(form.msrp) : null,
        features: form.features?.trim() || null,
        heroUrl: form.heroUrl?.trim() || null,
      };

      const updated = await BoatsApi.updateSummary(boatId, patch);
      setBoat(updated);
      setForm(updated);
      setView("read");
      onUpdated?.(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setForm(boat);
    setView("read");
    setErr(null);
  }

  return (
    <section className="rounded-lg border border-white/10 bg-[#111] p-4 md:p-6">
      <div className="flex items-start gap-6">
        {/* Image */}
        <div className="w-[360px] max-w-full">
          <div className="aspect-[16/9] w-full overflow-hidden rounded-md border border-white/10 bg-black/40">
            {form.heroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.heroUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/40 text-sm">
                No Image
              </div>
            )}
          </div>

          {view === "edit" && (
            <div className="mt-2">
              <label className="block text-xs text-white/60 mb-1">Hero Image URL</label>
              <input
                value={form.heroUrl ?? ""}
                onChange={(e) => onChange("heroUrl", e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md bg-[#141414] border border-white/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/10"
              />
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {boat.modelYear} {boat.name}
            </h2>

            {view === "read" ? (
              <button
                onClick={() => setView("edit")}
                className="inline-flex items-center gap-2 rounded-full border border-yellow-400/50 text-yellow-300 px-3 py-1.5 hover:bg-yellow-500/10"
                aria-label="Edit"
                title="Edit"
              >
                <Pencil className="size-4" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  disabled={busy}
                  onClick={save}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 text-emerald-300 px-3 py-1.5 hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  <Check className="size-4" /> Save
                </button>
                <button
                  disabled={busy}
                  onClick={cancel}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 text-white/80 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
                >
                  <X className="size-4" /> Cancel
                </button>
              </div>
            )}
          </div>

          {err && <div className="mt-3 text-sm text-red-400">{err}</div>}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 text-sm">
            <Row
              label="Model Year"
              read={boat.modelYear}
              edit={
                <input
                  type="number"
                  value={form.modelYear ?? 0}
                  onChange={(e) => onChange("modelYear", Number(e.target.value))}
                  className="w-full rounded-md bg-[#141414] border border-white/15 px-3 py-2 outline-none focus:ring-2 focus:ring-white/10"
                />
              }
              mode={view}
            />
            <Row
              label="Name"
              read={boat.name}
              edit={
                <input
                  value={form.name ?? ""}
                  onChange={(e) => onChange("name", e.target.value)}
                  className="w-full rounded-md bg-[#141414] border border-white/15 px-3 py-2 outline-none focus:ring-2 focus:ring-white/10"
                />
              }
              mode={view}
            />
            <Row
              label="Category"
              read={boat.category}
              edit={
                <input
                  value={form.category ?? ""}
                  onChange={(e) => onChange("category", e.target.value)}
                  className="w-full rounded-md bg-[#141414] border border-white/15 px-3 py-2 outline-none focus:ring-2 focus:ring-white/10"
                />
              }
              mode={view}
            />
            <Row
              label="MSRP"
              read={formatMoney(boat.msrp)}
              edit={
                <input
                  type="number"
                  step="0.01"
                  value={form.msrp ?? ""}
                  onChange={(e) => onChange("msrp", e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full rounded-md bg-[#141414] border border-white/15 px-3 py-2 outline-none focus:ring-2 focus:ring-white/10"
                />
              }
              mode={view}
            />
            <Row
              label="Start Build Link"
              long
              read={boat.startBuildUrl ? (
                <a href={boat.startBuildUrl} target="_blank" className="text-amber-300 hover:underline">
                  {boat.startBuildUrl}
                </a>
              ) : "—"}
              edit={
                <input
                  value={form.startBuildUrl ?? ""}
                  onChange={(e) => onChange("startBuildUrl", e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-md bg-[#141414] border border-white/15 px-3 py-2 outline-none focus:ring-2 focus:ring-white/10"
                />
              }
              mode={view}
            />
            <Row
              label="Features"
              long
              read={boat.features ?? "—"}
              edit={
                <textarea
                  rows={3}
                  value={form.features ?? ""}
                  onChange={(e) => onChange("features", e.target.value)}
                  className="w-full rounded-md bg-[#141414] border border-white/15 px-3 py-2 outline-none focus:ring-2 focus:ring-white/10"
                />
              }
              mode={view}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  read,
  edit,
  mode,
  long,
}: {
  label: string;
  read: React.ReactNode;
  edit: React.ReactNode;
  mode: "read" | "edit";
  long?: boolean;
}) {
  return (
    <div className={long ? "md:col-span-2" : ""}>
      <div className="text-white/60 mb-1">{label}:</div>
      <div className="text-white">{mode === "read" ? read : edit}</div>
    </div>
  );
}

function formatMoney(v?: number | null) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  } catch {
    return `$${v}`;
  }
}
