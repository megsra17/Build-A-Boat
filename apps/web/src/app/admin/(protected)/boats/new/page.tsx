"use client";

import React, { useState, useEffect, useMemo } from "react";
import {useRouter} from "next/navigation";
import {Plus, Check, ChevronDown} from "lucide-react";
import { number, set } from "zod";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5199";

type Media = {
  Id: string;
  Url: string;
  label?: string | null;
  w?: number | null;
  h?: number | null;
};

function toSlug(s: string){
  return s.trim().toLowerCase().replace(/[^a-z09]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function NewBoatPage() {
  const r = useRouter();

  //form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [modelYear, setModelYear] = useState<number | undefined>(undefined);
  const [msrp, setMsrp] = useState<number | undefined>(undefined);
  const [categories, setCategories] = useState<{id: string, slug: string, name: string}[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [featDraft, setFeatDraft] = useState("");
  const [features, setFeatures] = useState<string[]>([]);

  //images (store media Ids or Urls)
  const [primary, setPrimary] = useState<Media | null>(null);
  const [secondary, setSecondary] = useState<Media | null>(null);
  const [side, setSide] = useState<Media | null>(null);
  const [logo, setLogo] = useState<Media | null>(null);

//builder layers (ordered)
  const [layers, setLayers] = useState<Media[]>([]); 

  //media picker
  const [mediaOpen, setMediaOpen] = useState<null | {
    target: "primary" | "secondary" | "side" | "logo" | "layers";
  }>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  //derive slug from name if user hasnt manually edited it
  useEffect(() =>{
    setSlug(prev => (prev ? prev : toSlug(name)));
  }, [name]);

  useEffect(() =>{
    //fetch media list for picker
    (async () => {
      try{
        const jwt = typeof window !== "undefined" ? localStorage.getItem("jwt") || sessionStorage.getItem("jwt") : null;

        const res = await fetch(`${API}/admin/media`, {
          headers: jwt ?{Authorization: `Bearer ${jwt}`} : {},
        });
        if(!res.ok) throw new Error(`Failed to load media: ${res.status}`);
        const data = await res.json() as Media[]; 
        setMedia(data);
      } catch (error) {
        setErr(error instanceof Error ? error.message : String(error));
      }
    })();
  }, []);

  useEffect(() => {
  (async () => {
    try{
      const jwt = localStorage.getItem("jwt") || sessionStorage.getItem("jwt");
      const res = await fetch(`${API}/admin/categories`, { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });
      if (!res.ok) return;
      setCategories(await res.json());
    }catch{}
  })();
}, []);


  function addFeature() {
    const val = featDraft.trim();
    if(!val) return;
    setFeatures(f => Array.from(new Set([...f, val])));
    setFeatDraft("");
  }

  function removeFeature(f: string) {
    setFeatures(fs => fs.filter(x => x !== f));
  }

  function pickMedia(m: Media) {
    if(!mediaOpen) return;
    if(mediaOpen.target === "layers"){
      setLayers(l => [...l,m]);
    }else{
      const setter = mediaOpen.target === "primary" ? setPrimary
        : mediaOpen.target === "secondary" ? setSecondary
        : mediaOpen.target === "side" ? setSide
        : setLogo;
      setter(m);
    }
    setMediaOpen(null);
  }

  function removeLayer(i: number){
    setLayers(l => l.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try{
      const jwt = typeof window !== "undefined" ? localStorage.getItem("jwt") || sessionStorage.getItem("jwt") : null;

      const body ={
        Slug: slug || toSlug(name),
        Name: name,
        ModelYear: typeof modelYear === "number" ? modelYear : Number(modelYear || 0),
        Categories: selectedCategory ? [selectedCategory] : null,
        Features: features,
        PrimaryImageUrl: primary?.Url ?? null,
        SecondaryImageUrl: secondary?.Url ?? null,
        SideImageUrl: side?.Url ?? null,
        LogoImageUrl: logo?.Url ?? null,
        BuilderLayers: layers.map(l => l.Id),
      }

      const res = await fetch(`${API}/admin/boats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? {Authorization: `Bearer ${jwt}`} : {}),
        },
        body: JSON.stringify(body),
      });

      if(!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to create boat: ${res.status} ${text}`);
      }

      //created go back to list
      r.push("/admin/boats");
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
    
  function pick(m: Media): void {
    if (!mediaOpen) return;
    if (mediaOpen.target === "layers") {
      setLayers(l => [...l, m]);
    } else {
      const setter = mediaOpen.target === "primary" ? setPrimary
        : mediaOpen.target === "secondary" ? setSecondary
        : mediaOpen.target === "side" ? setSide
        : setLogo;
      setter(m);
    }
    setMediaOpen(null);
  }
  return (
    <form onSubmit={submit} className="space-y-8">
      <header className="flex items-center gap-3">
        <span className="text-2xl font-semibold">Add New Boat</span>
        {busy && <span className="text-sm text-white/50">Saving...</span>}
      </header>

      {err && <div className="p-3 bg-red-600/20 border border-red-600 text-red-300 rounded">{err}</div>}

      <section className="rounded-xl border border-white/10 bg-[#1515115] p-6">
      <h2 className="text-xl font-semibold mb-6">Boat Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label className="block text-sm text-white/70 mb-2">Model Year</label>
          <input inputMode="numeric"
          value={modelYear}
          onChange={(e) => setModelYear(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 outline-none"
          />
        </div>

        <div className="md:col-span-2">
            <label className="block text-sm text-white/70 mb-2">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-2">MSRP</label>
            <input
              inputMode="decimal"
              value={msrp}
              onChange={(e) => setMsrp(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-2">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 outline-none"
            >
              <option value="">(none)</option>
            {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-2">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(toSlug(e.target.value))}
              className="w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 outline-none font-mono text-sm"
            />
          </div>
        </div>
      </section>

      {/* Features + Images */}
      <section className="rounded-xl border border-white/10 bg-[#151515] p-6">
        <h2 className="text-xl font-semibold">General Images/Features</h2>

        <div className="mt-6">
          <label className="block text-sm text-white/70 mb-2">Features</label>
          <div className="flex items-center gap-2">
            <input
              value={featDraft}
              onChange={(e) => setFeatDraft(e.target.value)}
              placeholder="Add a feature…"
              className="w-72 rounded-md bg-black/40 border border-white/15 px-3 py-2 outline-none"
            />
            <button
              type="button"
              onClick={addFeature}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 text-amber-300 px-3 py-1 hover:bg-amber-500/10"
            >
              <Plus className="size-4" />
              Add
            </button>
          </div>

          {!!features.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              {features.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => removeFeature(f)}
                  className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-sm hover:bg-white/10"
                  title="Remove"
                >
                  {f}
                  <span className="ml-2 opacity-70">×</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          {([
            { label: "Primary Image", key: "primary", val: primary },
            { label: "Secondary Image", key: "secondary", val: secondary },
            { label: "Side Image", key: "side", val: side },
            { label: "Graphic Logo", key: "logo", val: logo },
          ] as const).map((it) => (
            <div key={it.key}>
              <div className="mb-2 text-white/80">{it.label}</div>
              <button
                type="button"
                onClick={() => setMediaOpen({ target: it.key })}
                className="group w-full aspect-square rounded-full bg-black/60 border border-white/10 flex items-center justify-center overflow-hidden"
                title="Select media"
              >
                {it.val ? (
                  // preview
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.val.Url}
                    alt={it.val.label ?? it.label}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-white/40">Select</div>
                )}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Builder Layers */}
      <section className="rounded-xl border border-white/10 bg-[#151515] p-6">
        <h2 className="text-xl font-semibold mb-4">Builder Layers</h2>
        <button
          type="button"
          onClick={() => setMediaOpen({ target: "layers" })}
          className="rounded-full border border-amber-500/40 text-amber-300 px-4 py-2 hover:bg-amber-500/10"
        >
          Select Media
        </button>

        {!!layers.length && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3">
            {layers.map((m, i) => (
              <div key={`${m.Id}-${i}`} className="relative rounded-lg overflow-hidden border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.Url} alt={m.label ?? ""} className="w-full h-24 object-cover" />
                <button
                  type="button"
                  onClick={() => removeLayer(i)}
                  className="absolute top-1 right-1 size-6 rounded-full bg-black/70 border border-white/20 text-white/80"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button
          disabled={busy || !name || !modelYear || !msrp}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-medium px-4 py-2 disabled:opacity-50"
        >
          <Check className="size-4" />
          Save Boat
        </button>
      </div>

      {/* Media Picker */}
      {mediaOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex">
          <div className="m-auto w-[90vw] max-w-5xl rounded-xl border border-white/10 bg-[#141414] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg">Select Media</div>
              <button onClick={() => setMediaOpen(null)} className="size-8 rounded-full border border-white/20">
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 max-h-[65vh] overflow-auto">
              {media.length === 0 && (
                <div className="col-span-full text-center text-white/60">
                  No media found. (Add a `/api/admin/media` endpoint or seed media.)
                </div>
              )}
              {media.map((m) => (
                <button
                  key={m.Id}
                  type="button"
                  onClick={() => pick(m)}
                  className="rounded-lg overflow-hidden border border-white/10 hover:border-amber-400"
                  title={m.label ?? ""}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.Url} alt={m.label ?? ""} className="w-full h-28 object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}