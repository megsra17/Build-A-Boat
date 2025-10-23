"use client";

import { useEffect, useMemo, useState } from "react";
import { BoatsApi, CategoriesApi } from "@/src/app/lib/admin-api";
import { Check, X, ChevronDown } from "lucide-react";

type Summary = {
  id: string;
  modelYear: number;
  name: string;
  category: string; // category name or id, adjust as needed
  msrp?: number | null;

  primaryImageUrl?: string | null;
  secondaryImageUrl?: string | null;
  sideImageUrl?: string | null;
  logoUrl?: string | null;

  builderLayerUrl?: string | null;
};

type Props = {
  boatId: string;
  initial: Summary;
  onUpdated?: (next: Summary) => void;
};

export default function BoatSummaryCard({ boatId, initial, onUpdated }: Props) {
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [value, setValue] = useState<Summary>(initial);
  const [form, setForm] = useState<Summary>(initial);

  // categories for dropdown
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await CategoriesApi.list({ page: 1, pageSize: 100 });
        setCategories(res.items.map((r: { name: string }) => r.name));
      } catch {
        setCategories([]);
      }
    })();
  }, []);

  useEffect(() => {
    setValue(initial);
    setForm(initial);
  }, [initial?.id]);

  function change<K extends keyof Summary>(key: K, v: Summary[K]) {
    setForm((f) => ({ ...f, [key]: v }));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const patch: Partial<Summary> = {
        modelYear: Number(form.modelYear),
        name: form.name?.trim(),
        category: form.category,
        msrp:
          form.msrp === undefined || form.msrp === null || form.msrp === ("" as any)
            ? null
            : Number(form.msrp),

        primaryImageUrl: form.primaryImageUrl?.trim() || null,
        secondaryImageUrl: form.secondaryImageUrl?.trim() || null,
        sideImageUrl: form.sideImageUrl?.trim() || null,
        logoUrl: form.logoUrl?.trim() || null,

        builderLayerUrl: form.builderLayerUrl?.trim() || null,
      };

      const updated = await BoatsApi.updateSummary(boatId, patch);
      setValue(updated);
      setForm(updated);
      setMode("read");
      onUpdated?.(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setForm(value);
    setMode("read");
    setErr(null);
  }

  return (
    <section className="rounded-lg border border-white/10 bg-[#0e0e0e] p-4 md:p-6 relative">
      {/* Title row */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          {/* little boat glyph could be an inline svg if you want */}
          ️🏁 <span>{value.modelYear} {value.name}</span>
        </h2>

        {/* edit controls, yellow circle icons */}
        {mode === "edit" ? (
          <div className="flex items-center gap-2">
            <IconCircle
              title="Cancel"
              onClick={cancel}
              className="border-yellow-400/60 text-yellow-300 hover:bg-yellow-500/10"
            >
              <X className="size-4" />
            </IconCircle>
            <IconCircle
              title="Save"
              onClick={save}
              disabled={busy}
              className="border-yellow-400/60 text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50"
            >
              <Check className="size-4" />
            </IconCircle>
          </div>
        ) : (
          <IconCircle
            title="Edit"
            onClick={() => setMode("edit")}
            className="border-yellow-400/60 text-yellow-300 hover:bg-yellow-500/10"
          >
            {/* pencil-ish: use X rotated? keep simple */}
            ✎
          </IconCircle>
        )}
      </div>

      {/* Basic Info row */}
      <h3 className="text-lg font-semibold mb-1">Basic Info</h3>
      {mode === "read" ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <ReadField label="Model Year" value={value.modelYear} />
          <ReadField label="Name" value={value.name} />
          <ReadField label="Category" value={value.category || "—"} />
          <ReadField label="MSRP" value={formatMoney(value.msrp)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <Labeled>
            <Label>Model Year</Label>
            <Input
              type="number"
              value={form.modelYear}
              onChange={(e) => change("modelYear", Number(e.target.value))}
            />
          </Labeled>
          <Labeled>
            <Label>Name</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => change("name", e.target.value)}
            />
          </Labeled>
          <Labeled>
            <Label>Category</Label>
            <Dropdown
              value={form.category ?? ""}
              onChange={(v) => change("category", v)}
              options={categories}
            />
          </Labeled>
          <Labeled>
            <Label>MSRP</Label>
            <Input
              type="number"
              step="0.01"
              value={form.msrp ?? ""}
              onChange={(e) =>
                change("msrp", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </Labeled>
        </div>
      )}

      {/* General Images */}
      <h3 className="text-lg font-semibold mb-3">General Images</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <ImagePicker
          label="Primary Image"
          url={mode === "edit" ? form.primaryImageUrl : value.primaryImageUrl}
          editable={mode === "edit"}
          onChange={(u) => change("primaryImageUrl", u)}
        />
        <ImagePicker
          label="Secondary Image"
          url={mode === "edit" ? form.secondaryImageUrl : value.secondaryImageUrl}
          editable={mode === "edit"}
          onChange={(u) => change("secondaryImageUrl", u)}
          circle // screenshot shows circular crop on secondary
        />
        <ImagePicker
          label="Side Image"
          url={mode === "edit" ? form.sideImageUrl : value.sideImageUrl}
          editable={mode === "edit"}
          onChange={(u) => change("sideImageUrl", u)}
        />
        <ImagePicker
          label="Graphic Logo"
          url={mode === "edit" ? form.logoUrl : value.logoUrl}
          editable={mode === "edit"}
          onChange={(u) => change("logoUrl", u)}
        />
      </div>

      {/* Builder Layers */}
      <div className="mt-10">
        <h3 className="text-lg font-semibold mb-2">Builder Layers</h3>
        {mode === "edit" ? (
          <div className="flex items-start gap-6">
            <button
              type="button"
              onClick={() => {
                // hook up your media selector; for now just prompt for URL
                const u = prompt("Enter builder layer image URL");
                if (u) change("builderLayerUrl", u);
              }}
              className="rounded-full border border-yellow-400/60 text-yellow-200 px-4 py-2 hover:bg-yellow-500/10"
            >
              Select Media
            </button>
            {form.builderLayerUrl && (
              <ThumbWithRemove
                url={form.builderLayerUrl}
                onRemove={() => change("builderLayerUrl", null)}
              />
            )}
          </div>
        ) : (
          value.builderLayerUrl && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value.builderLayerUrl}
                alt=""
                className="h-28 w-auto rounded-md border border-white/10 bg-black/30 object-contain"
              />
            </div>
          )
        )}
      </div>

      {err && <div className="mt-4 text-sm text-red-400">{err}</div>}
    </section>
  );
}

/* ---------- little building blocks ---------- */

function IconCircle({
  children,
  onClick,
  title,
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-grid place-items-center size-9 rounded-full border ${className}`}
    >
      {children}
    </button>
  );
}

function Labeled({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-white/60 mb-2">{children}</div>;
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md bg-[#141414] border border-white/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/10 ${props.className ?? ""}`}
    />
  );
}

function ReadField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-white/60 mb-2">{label}</div>
      <div className="border-b border-white/20 pb-1">{value ?? "—"}</div>
    </div>
  );
}

function Dropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-md bg-[#141414] border border-white/15 px-3 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-white/10"
      >
        {options.length === 0 && <option value="">—</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-4 text-white/60" />
    </div>
  );
}

function ImagePicker({
  label,
  url,
  editable,
  onChange,
  circle,
}: {
  label: string;
  url?: string | null;
  editable: boolean;
  onChange: (next: string | null) => void;
  circle?: boolean;
}) {
  const has = !!url;

  return (
    <div>
      <div className="text-white/80 mb-2">{label}</div>
      <div
        className={`relative ${circle ? "size-64" : "w-72 h-56"} max-w-full overflow-hidden ${
          circle ? "rounded-full" : "rounded-xl"
        } border border-white/10 bg-black/40 grid place-items-center`}
      >
        {has ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url!}
              alt=""
              className={`h-full w-full object-contain ${circle ? "rounded-full" : ""}`}
            />
            {editable && (
              <button
                type="button"
                title="Remove"
                onClick={() => onChange(null)}
                className="absolute -top-2 -right-2 grid place-items-center size-8 rounded-full border border-red-400/60 text-red-300 bg-black/60 hover:bg-red-500/10"
              >
                <X className="size-4" />
              </button>
            )}
          </>
        ) : (
          <>
            <CloudGlyph />
            {editable && (
              <button
                type="button"
                onClick={() => {
                  const u = prompt("Enter image URL");
                  if (u) onChange(u);
                }}
                className="absolute inset-0"
                aria-label="Choose image"
                title="Choose image"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ThumbWithRemove({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div className="relative inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="h-28 w-auto rounded-md border border-white/10 bg-black/30 object-contain"
      />
      <button
        type="button"
        title="Remove"
        onClick={onRemove}
        className="absolute -top-2 -left-2 grid place-items-center size-8 rounded-full border border-red-400/60 text-red-300 bg-black/60 hover:bg-red-500/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function CloudGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-16 h-16 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 18h9a4 4 0 0 0 0-8 5 5 0 0 0-9.58-1.5A4.5 4.5 0 0 0 7 18Z" />
      <path d="m12 13 0-6" />
      <path d="m9.5 9.5 2.5-2.5 2.5 2.5" />
    </svg>
  );
}

function formatMoney(v?: number | null) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `$${v}`;
  }
}
