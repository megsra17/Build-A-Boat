"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { BoatsApi, type Boat as BaseBoat } from "@/app/lib/admin-api";

// Extended Boat type with all the properties we need
type ExtendedBoat = BaseBoat & {
  features?: string | null;
  primaryImageUrl?: string | null;
  secondaryImageUrl?: string | null;
  sideImageUrl?: string | null;
  logoImageUrl?: string | null;
};

export default function BoatEditPage() {
  const params = useParams<{ id: string }>();
  const boatId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [boat, setBoat] = useState<ExtendedBoat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchBoat = async () => {
      if (!boatId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Use the new getById function to fetch the boat
        const boatData = await BoatsApi.getById(boatId);
        
        if (mounted) {
          // Convert the base boat to our extended type
          const extendedBoat: ExtendedBoat = {
            ...boatData,
            features: null, // API might not have these yet
            primaryImageUrl: null,
            secondaryImageUrl: null,
            sideImageUrl: null,
            logoImageUrl: null,
          };
          
          setBoat(extendedBoat);
        }
      } catch (err) {
        console.error('Error fetching boat:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load boat');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchBoat();
    
    return () => {
      mounted = false;
    };
  }, [boatId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading boat details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!boat) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Boat not found</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black overflow-hidden flex flex-col">
      {/* Top Header/Info Section */}
      <div className="bg-gradient-to-r from-black/80 to-black/40 border-b border-white/10 p-8">
        <div className="flex items-start gap-8 justify-between">
          {/* Left Side - Boat Info */}
          <div className="flex-1">
            <div className="flex items-baseline gap-3 mb-6">
              <h1 className="text-4xl font-bold text-white">{boat.modelYear}</h1>
              <h2 className="text-4xl font-light text-white/90">{boat.name}</h2>
            </div>
            
            <div className="space-y-2 text-white/70 text-sm">
              <div>
                <span className="font-medium">Model Year:</span>
                <span className="ml-3 font-mono text-white">{boat.modelYear}</span>
              </div>
              <div>
                <span className="font-medium">Name:</span>
                <span className="ml-3 text-white">{boat.name}</span>
              </div>
              <div>
                <span className="font-medium">Category:</span>
                <span className="ml-3 text-white">Crossovers</span>
              </div>
              <div>
                <span className="font-medium">Start Build Link:</span>
                <span className="ml-3 text-amber-400 font-mono text-xs break-all">
                  https://boatbuilder.everglades.com/start/{boat.slug}
                </span>
              </div>
            </div>
          </div>
          
          {/* Right Side - Boat Image */}
          {boat.primaryImageUrl && (
            <div className="w-80 h-64 rounded-lg overflow-hidden border border-white/20 bg-black/40 flex-shrink-0">
              <img
                src={boat.primaryImageUrl}
                alt={boat.name}
                className="w-full h-full object-contain bg-black"
              />
            </div>
          )}
        </div>
      </div>

      {/* Placeholder for more sections */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* More sections will go here */}
        </div>
      </div>
    </div>
  );
}
