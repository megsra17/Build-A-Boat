"use client";

import React, { useState, useEffect } from "react";
import {useRouter} from "next/navigation";
import {Plus, Check} from "lucide-react";

// Use Railway URL for production, localhost for development
const API = process.env.NODE_ENV === 'production' 
  ? "https://build-a-boat-production.up.railway.app"
  : "http://localhost:5001";

type Media = {
  Id: string;
  Url: string;
  label?: string | null;
  w?: number | null;
  h?: number | null;
};

export default function NewBoatPage() {
  const r = useRouter();

  //form state
  const [name, setName] = useState("");
  const [modelYear, setModelYear] = useState<number | undefined>(undefined);
  const [msrp, setMsrp] = useState<number | undefined>(undefined);
  const [categories, setCategories] = useState<{id: string, slug: string, name: string}[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [featDraft, setFeatDraft] = useState("");
  const [nextSlugNumber, setNextSlugNumber] = useState<number>(0);

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
  const [uploading, setUploading] = useState(false);

  // Fetch next available slug number
  useEffect(() => {
    (async () => {
      try{
        const jwt = typeof window !== "undefined" ? localStorage.getItem("jwt") || sessionStorage.getItem("jwt") : null;
        
        const res = await fetch(`${API}/admin/boat`, {
          headers: jwt ? {Authorization: `Bearer ${jwt}`} : {},
        });
        
        if(res.ok) {
          const data = await res.json();
          const boats = data.items || data || [];
          // Find the highest numeric slug and add 1
          const maxSlug = boats.reduce((max: number, boat: {slug?: string}) => {
            const slugNum = parseInt(boat.slug || "0");
            return isNaN(slugNum) ? max : Math.max(max, slugNum);
          }, -1);
          setNextSlugNumber(maxSlug + 1);
        } else {
          console.error("Failed to fetch boats:", res.status);
        }
      } catch (error) {
        console.error("Error fetching boats for slug generation:", error);
        // If fetch fails, start at 0
        setNextSlugNumber(0);
      }
    })();
  }, []);

  useEffect(() =>{
    //fetch media list for picker
    (async () => {
      try{
        const jwt = typeof window !== "undefined" ? localStorage.getItem("jwt") || sessionStorage.getItem("jwt") : null;

        const res = await fetch(`${API}/admin/media`, {
          headers: jwt ?{Authorization: `Bearer ${jwt}`} : {},
        });
        if(!res.ok) throw new Error(`Failed to load media: ${res.status}`);
        const data = await res.json();
        // Handle both direct array and { items: [...] } response formats
        const mediaArray = Array.isArray(data) ? data : (data.items || []);
        setMedia(mediaArray);
      } catch (error) {
        setErr(error instanceof Error ? error.message : String(error));
      }
    })();
  }, []);

  useEffect(() => {
  (async () => {
    try{
      const jwt = localStorage.getItem("jwt") || sessionStorage.getItem("jwt");
      const res = await fetch(`${API}/admin/category`, { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });
      if (!res.ok) return;
      const data = await res.json();
      // API returns { items: [...] }, so we need to extract the items array
      setCategories(data.items || []);
    }catch{}
  })();
}, []);

  function removeLayer(i: number){
    setLayers(l => l.filter((_, idx) => idx !== i));
  }

  async function uploadMedia(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const jwt = typeof window !== "undefined" ? localStorage.getItem("jwt") || sessionStorage.getItem("jwt") : null;
      
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API}/admin/media/upload`, {
        method: "POST",
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Upload failed: ${res.status} ${errorText}`);
      }

      const uploadedMedia = await res.json();
      
      // Add the new media to the list
      setMedia(prev => [uploadedMedia, ...prev]);
      
      return uploadedMedia;
    } catch (error) {
      console.error("Upload error:", error);
      setErr(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setUploading(false);
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input
    event.target.value = '';

    uploadMedia(file)
      .then((uploadedMedia) => {
        // Automatically select the uploaded image
        if (mediaOpen) {
          pick(uploadedMedia);
        }
      })
      .catch(console.error);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try{
      const jwt = typeof window !== "undefined" ? localStorage.getItem("jwt") || sessionStorage.getItem("jwt") : null;

      const body ={
        Slug: nextSlugNumber.toString(),
        Name: name,
        BasePrice: typeof msrp === "number" ? msrp : Number(msrp || 0),
        ModelYear: typeof modelYear === "number" ? modelYear : Number(modelYear || 0),
        PrimaryImageUrl: primary?.Url ?? null,
        SecondaryImageUrl: secondary?.Url ?? null,
        SideImageUrl: side?.Url ?? null,
        LogoImageUrl: logo?.Url ?? null,
        LayerMediaIds: layers.map(l => l.Id),
      }

      const res = await fetch(`${API}/admin/boat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? {Authorization: `Bearer ${jwt}`} : {}),
        },
        body: JSON.stringify(body),
      });

      if(!res.ok) {
        const text = await res.text();
        console.error("Create boat error response:", text);
        throw new Error(`Failed to create boat: ${res.status} ${text}`);
      }
      const result = await res.json();

      //created go back to list
      r.push("/admin/boat");
    } catch (error) {
      console.error("Submit error:", error);
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
    setErr(null); // Clear any upload errors
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
          <input 
            type="number"
            value={modelYear || ""}
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
              type="number"
              step="0.01"
              value={msrp || ""}
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
          {/* Slug is auto-generated from name, hidden from user */}
        </div>
      </section>

      {/* Images */}
      <section className="rounded-xl border border-white/10 bg-[#151515] p-6">
        <h2 className="text-xl font-semibold">General Images</h2>

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
          disabled={busy || !name || !modelYear}
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
            
            {/* Error Display */}
            {err && (
              <div className="mb-4 p-3 bg-red-600/20 border border-red-600 text-red-300 rounded">
                {err}
              </div>
            )}
            
            {/* Upload Section */}
            <div className="mb-6 p-4 rounded-lg border border-white/10 bg-black/20">
              <div className="flex items-center gap-4">
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-medium px-4 py-2 disabled:opacity-50">
                  <Plus className="size-4" />
                  {uploading ? "Uploading..." : "Upload New Image"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                <span className="text-sm text-white/60">
                  Select an image file to upload (JPEG, PNG, GIF, WebP - max 10MB)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 max-h-[65vh] overflow-auto">
              {media.length === 0 && !uploading && (
                <div className="col-span-full text-center text-white/60">
                  No media found. Upload an image above to get started.
                </div>
              )}
              {uploading && (
                <div className="col-span-full text-center text-white/60">
                  <div className="inline-flex items-center gap-2">
                    <div className="animate-spin size-4 border-2 border-amber-500 border-t-transparent rounded-full"></div>
                    Uploading image...
                  </div>
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