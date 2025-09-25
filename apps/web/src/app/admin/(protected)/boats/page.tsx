"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminApi, Boat } from "@/app/lib/admin-api";
import { useForm } from "react-hook-form";
import Link from "next/link";

const queryClient = new QueryClient();

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <BoatsScreen />
    </QueryClientProvider>
  );
}

function BoatsScreen() {
 const { data: boats, isLoading, error } = useQuery({
    queryKey: ["boats"],
    queryFn: () => AdminApi.listBoats()
});
const [editingBoat, setEditingBoat] = useState<Boat | null>(null);

return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Boats</h1>
        <button
          className="px-2 py-2 rounded bg-black text-white"
          onClick={() => setEditingBoat({ id: "", slug: "", name: "", basePrice: 0, modelYear: null, isActive: true })}
        >
          + New Boat
        </button>
      </div>

      {isLoading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error loading boats.</p>}

      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Slug</th>
            <th className="p-2 text-left">Base Price</th>
            <th className="p-2 text-left">Model Year</th>
            <th className="p-2 text-left">Active</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {boats?.map((b) => (
            <BoatRow key={b.id} boat={b} onEdit={() => setEditingBoat(b)} />
          ))}
          {!boats?.length && !isLoading && (
            <tr>
              <td className="p-4 text-center text-gray-500" colSpan={6}>
                No boats yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editingBoat && <BoatForm initial={editingBoat} onClose={() => setEditingBoat(null)} />}
    </main>
);
}

function BoatRow({ boat, onEdit }: { boat: Boat; onEdit: () => void }) {
    const queryClient = useQueryClient();
    const deleteMutation = useMutation({
        mutationFn: () => AdminApi.delete(`/api/admin/boats/${boat.id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["boats"] })
    });
    
    return (
        <tr className="border-t">
            <td className="p-2">{boat.name}</td>
            <td className="p-2">{boat.slug}</td>
            <td className="p-2">${boat.basePrice.toFixed(2)}</td>
            <td className="p-2">{boat.modelYear || "-"}</td>
            <td className="p-2 text-center">
                <span className={`px-2 py-1 rounded text-xs ${boat.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                {boat.isActive ? "Yes" : "No"}
                </span>
            </td>
            <td className="p-2 space-x-2">
                <button className="px-2 py-1 rounded bg-gray-200" onClick={onEdit}>Edit</button>
                <Link href={`/admin/categories/${boat.id}`} className="px-2 py-1 rounded bg-blue-200">Categories</Link>
                <button className="text-red-600" onClick={() => confirm("Delete boat?") && deleteMutation.mutate()} disabled={deleteMutation.isPending}>
          Delete
        </button>
            </td>
        </tr>
    );  
}

type BoatFormData = {
    id: string;
    slug: string;
    name: string;
    basePrice: number;
    modelYear?: number | null;
    isActive: boolean;
}

function BoatForm({ initial, onClose }: { initial: Boat; onClose: () => void }) {
    const queryClient = useQueryClient();
    const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm<BoatFormData>({ defaultValues:  {
        id: initial.id,
        slug: initial.slug,
        name: initial.name,
        basePrice: initial.basePrice,
        modelYear: initial.modelYear || undefined,
        isActive: initial.isActive
    } });
    const save = useMutation({
    mutationFn: (data: BoatFormData) => AdminApi.upsertBoat(data.id || undefined, {
      slug: data.slug,
        name: data.name,
        basePrice: Number(data.basePrice),
        modelYear: data.modelYear ? Number(data.modelYear) : null,
        isActive: data.isActive
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["boats"] }); onClose(); }
  });
  
  return(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
        <form onSubmit={handleSubmit(data => save.mutate(data))} className="bg-white w-full max-w-lg p-6 rounded space-y-4">
            <h2 className="text-lg font-semibold">{initial.id ? "Edit Boat" : "New Boat"}</h2>
            <div>
                <label className="block text-sm mb-1">Name</label>
                <input type="text" {...register("name", { required: "Name is required" })} className="w-full border p-2 rounded" />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>
            <div>
                <label className="block text-sm mb-1">Slug</label>
                <input type="text" {...register("slug", { required: "Slug is required" })} className="w-full border p-2 rounded" />
                {errors.slug && <p className="text-red-500 text-sm mt-1">{errors.slug.message}</p>}
            </div>
            <div>
                <label className="block text-sm mb-1">Base Price</label>
                <input type="number" step="0.01" {...register("basePrice", { required: "Base Price is required", valueAsNumber: true })} className="w-full border p-2 rounded" />
                {errors.basePrice && <p className="text-red-500 text-sm mt-1">{errors.basePrice.message}</p>}
            </div>
            <div>
                <label className="block text-sm mb-1">Model Year</label>
                <input type="number" {...register("modelYear", { valueAsNumber: true })} className="w-full border p-2 rounded" />
                {errors.modelYear && <p className="text-red-500 text-sm mt-1">{errors.modelYear.message}</p>}
            </div>
            <div className="flex items-center space-x-2">
                <input type="checkbox" {...register("isActive")} className="h-4 w-4" />
                <label className="text-sm">Is Active</label>
            </div>
            <div className="flex items-center space-x-4">
                <button type="submit" disabled={!isDirty || save.isPending} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
                    {save.isPending ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={() => { reset(); onClose(); }} className="px-4 py-2 rounded border">
                    Cancel
                </button>
            </div>
        </form>
    </div>
  )
}