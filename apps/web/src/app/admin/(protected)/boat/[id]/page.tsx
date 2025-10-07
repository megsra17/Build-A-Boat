"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Save, ArrowLeft, Trash2 } from "lucide-react";
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
  const router = useRouter();
  const boatId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [boat, setBoat] = useState<ExtendedBoat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ExtendedBoat>>({});

  useEffect(() => {
    let mounted = true;
    
    const fetchBoat = async () => {
      if (!boatId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('Fetching boat with ID:', boatId);
        
        // Use the new getById function to fetch the boat
        const boatData = await BoatsApi.getById(boatId);
        console.log('Boat data received:', boatData);
        
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
          setFormData(extendedBoat);
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

  const handleSave = async () => {
    if (!boat || !formData) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Use the existing BoatsApi.update function
      const updatedBoat = await BoatsApi.update(boatId, formData);
      setBoat({ ...boat, ...updatedBoat });
      
      // Show success message
      alert('Boat updated successfully!');
      
    } catch (err) {
      console.error('Error updating boat:', err);
      setError(err instanceof Error ? err.message : 'Failed to update boat');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!boat) return;
    
    if (!confirm(`Are you sure you want to delete "${boat.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      // Use the existing BoatsApi.remove function
      await BoatsApi.remove(boatId);
      
      alert('Boat deleted successfully!');
      router.push('/admin/boat');
      
    } catch (err) {
      console.error('Error deleting boat:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete boat');
    }
  };

  const updateFormData = (field: keyof ExtendedBoat, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/boat')}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Boats
          </button>
          <h1 className="text-2xl font-bold text-white">Edit Boat: {boat.name}</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <Trash2 className="size-4" />
            Delete
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
          >
            <Save className="size-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="text-red-400">{error}</div>
        </div>
      )}

      {/* Basic Information */}
      <section className="rounded-lg border border-white/10 bg-[#1f1f1f] p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => updateFormData('name', e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-blue-500 focus:outline-none"
                placeholder="Enter boat name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Slug</label>
              <input
                type="text"
                value={formData.slug || ''}
                onChange={(e) => updateFormData('slug', e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-blue-500 focus:outline-none font-mono text-sm"
                placeholder="boat-slug"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Base Price</label>
              <input
                type="number"
                value={formData.basePrice || ''}
                onChange={(e) => updateFormData('basePrice', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-blue-500 focus:outline-none"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Model Year</label>
              <input
                type="number"
                value={formData.modelYear || ''}
                onChange={(e) => updateFormData('modelYear', parseInt(e.target.value) || null)}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-blue-500 focus:outline-none"
                placeholder="2024"
                min="1900"
                max="2050"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Status</label>
              <div className={`inline-flex px-3 py-2 rounded-lg text-sm font-medium ${
                boat.isActive 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {boat.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">ID</label>
              <div className="text-white/60 font-mono text-xs bg-black/20 px-3 py-2 rounded-lg">
                {boat.id}
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <label className="block text-sm font-medium text-white/70 mb-2">Features</label>
          <textarea
            value={formData.features || ''}
            onChange={(e) => updateFormData('features', e.target.value)}
            className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-blue-500 focus:outline-none"
            placeholder="Enter boat features (JSON format or text)"
            rows={3}
          />
        </div>
      </section>

      {/* Images */}
      <section className="rounded-lg border border-white/10 bg-[#1f1f1f] p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Images</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Hero Image URL</label>
              <input
                type="url"
                value={formData.heroImageUrl || ''}
                onChange={(e) => updateFormData('heroImageUrl', e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-blue-500 focus:outline-none"
                placeholder="https://example.com/hero.jpg"
              />
              {formData.heroImageUrl && (
                <div className="mt-2 w-full h-32 relative rounded-lg overflow-hidden bg-black/40 border border-white/10">
                  <img 
                    src={formData.heroImageUrl} 
                    alt="Hero preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Primary Image URL</label>
              <input
                type="url"
                value={formData.primaryImageUrl || ''}
                onChange={(e) => updateFormData('primaryImageUrl', e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-blue-500 focus:outline-none"
                placeholder="https://example.com/primary.jpg"
              />
              {formData.primaryImageUrl && (
                <div className="mt-2 w-full h-32 relative rounded-lg overflow-hidden bg-black/40 border border-white/10">
                  <img 
                    src={formData.primaryImageUrl} 
                    alt="Primary preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Secondary Image URL</label>
              <input
                type="url"
                value={formData.secondaryImageUrl || ''}
                onChange={(e) => updateFormData('secondaryImageUrl', e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-blue-500 focus:outline-none"
                placeholder="https://example.com/secondary.jpg"
              />
              {formData.secondaryImageUrl && (
                <div className="mt-2 w-full h-32 relative rounded-lg overflow-hidden bg-black/40 border border-white/10">
                  <img 
                    src={formData.secondaryImageUrl} 
                    alt="Secondary preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Side Image URL</label>
              <input
                type="url"
                value={formData.sideImageUrl || ''}
                onChange={(e) => updateFormData('sideImageUrl', e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-blue-500 focus:outline-none"
                placeholder="https://example.com/side.jpg"
              />
              {formData.sideImageUrl && (
                <div className="mt-2 w-full h-32 relative rounded-lg overflow-hidden bg-black/40 border border-white/10">
                  <img 
                    src={formData.sideImageUrl} 
                    alt="Side preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Logo Image URL</label>
              <input
                type="url"
                value={formData.logoImageUrl || ''}
                onChange={(e) => updateFormData('logoImageUrl', e.target.value)}
                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-blue-500 focus:outline-none"
                placeholder="https://example.com/logo.jpg"
              />
              {formData.logoImageUrl && (
                <div className="mt-2 w-full h-32 relative rounded-lg overflow-hidden bg-black/40 border border-white/10">
                  <img 
                    src={formData.logoImageUrl} 
                    alt="Logo preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
