"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { BoatsApi, type Boat } from "@/app/lib/admin-api";

// Extended boat type for the detail view (API might return more fields than the base type)
type ExtendedBoat = Boat & {
  features?: string[] | string;
  primaryImageUrl?: string;
  secondaryImageUrl?: string;
  sideImageUrl?: string;
  logoImageUrl?: string;
};

export default function BoatDetailPage() {
  const router = useRouter();
  const params = useParams();
  const boatId = params.id as string;
  
  const [boat, setBoat] = useState<ExtendedBoat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBoat = async () => {
      try {
        setLoading(true);
        // For now, we'll need to get the boat from the list since there's no individual boat endpoint
        const response = await BoatsApi.list();
        const foundBoat = response.items.find((b: Boat) => b.id === boatId);
        
        if (foundBoat) {
          setBoat(foundBoat as ExtendedBoat);
        } else {
          setError("Boat not found");
        }
      } catch {
        setError("Failed to load boat");
      } finally {
        setLoading(false);
      }
    };

    if (boatId) {
      loadBoat();
    }
  }, [boatId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading boat details...</div>
      </div>
    );
  }

  if (error || !boat) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-red-300">{error || "Boat not found"}</div>
        <button 
          onClick={() => router.push("/admin/boat")}
          className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400"
        >
          Back to Boats
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => router.push("/admin/boat")}
            className="px-3 py-1 border border-white/20 rounded-lg text-white/70 hover:text-white"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-semibold">{boat.name}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs ${
            boat.isActive 
              ? 'bg-emerald-600/20 text-emerald-300' 
              : 'bg-white/10 text-white/70'
          }`}>
            {boat.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#151515] p-6">
            <h2 className="text-lg font-semibold mb-4">Boat Information</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-white/70 mb-1">Name</label>
                <div className="text-white">{boat.name}</div>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Slug</label>
                <div className="text-white/80 font-mono">{boat.slug}</div>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Model Year</label>
                <div className="text-white">{boat.modelYear || 'Not set'}</div>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Base Price</label>
                <div className="text-white">
                  {boat.basePrice 
                    ? `$${boat.basePrice.toLocaleString()}` 
                    : 'Not set'
                  }
                </div>
              </div>
            </div>
          </div>

          {boat.features && (
            <div className="rounded-xl border border-white/10 bg-[#151515] p-6">
              <h2 className="text-lg font-semibold mb-4">Features</h2>
              <div className="space-y-2">
                {Array.isArray(boat.features) ? (
                  boat.features.map((feature: string, index: number) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                      <span className="text-white/80">{feature}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-white/60">No features listed</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#151515] p-6">
            <h2 className="text-lg font-semibold mb-4">Images</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Primary', url: boat.primaryImageUrl },
                { label: 'Secondary', url: boat.secondaryImageUrl },
                { label: 'Side', url: boat.sideImageUrl },
                { label: 'Logo', url: boat.logoImageUrl },
              ].map((image) => (
                <div key={image.label} className="space-y-2">
                  <div className="text-sm text-white/70">{image.label}</div>
                  <div className="aspect-square rounded-lg border border-white/10 overflow-hidden bg-black/40">
                    {image.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={image.url} 
                        alt={`${image.label} image`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/40">
                        No image
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button 
          onClick={() => router.push("/admin/boat")}
          className="px-4 py-2 border border-white/20 rounded-lg text-white/70 hover:text-white"
        >
          Close
        </button>
        <button 
          className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400"
          onClick={() => {
            // TODO: Implement edit functionality
            alert("Edit functionality coming soon!");
          }}
        >
          Edit Boat
        </button>
      </div>
    </div>
  );
}
