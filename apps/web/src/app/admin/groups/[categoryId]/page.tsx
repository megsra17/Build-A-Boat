"use client";
import { use, useEffect, useMemo, useState } from "react";
import {useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {AdminApi, OptionGroup} from "@/app/lib/admin-api";
import {useForm} from "react-hook-form";

const queryClient = new QueryClient();

export default function Page({ params }: { params: { categoryId: string } }) {
  return (
    <QueryClientProvider client={queryClient}>
      <GroupsScreen categoryId={params.categoryId} />
    </QueryClientProvider>
  );
}

function GroupsScreen({ categoryId }: { categoryId: string }) {
    const {data: groups} = useQuery({
      queryKey: ["groups", categoryId],
      queryFn: () => AdminApi.listGroups(categoryId)
    });
    const [editingGroup, setEditingGroup] = useState<OptionGroup|null>(null);

    return (
        <main className="max-w-5xl mx=auto p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Option Groups</h1>
                <button className="px-2 py-2 rounded bg-black text-white" onClick={() => setEditingGroup({id: "", categoryId, name:"", selectionType: "single", minSelect: 0, maxSelect:1, sortOrder:0})}>+ New Group</button>
            </div>

            <table className="w-full text-sm border">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Selection Type</th>
                        <th className="p-2 text-left">Min Select</th>
                        <th className="p-2 text-left">Max Select</th>
                        <th className="p-2 text-left">Sort Order</th>
                        <th className="p-2 text-left">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {groups?.map(g =>(
                        <tr key={g.id} className="border-t">
                            <td className="p-2">{g.name}</td>
                            <td className="p-2">{g.selectionType}</td>
                            <td className="p-2">{g.minSelect}</td>
                            <td className="p-2">{g.maxSelect}</td>
                            <td className="p-2">{g.sortOrder}</td>
                            <td className="p-2">
                                <button className="px-2 py-1 rounded bg-gray-200" onClick={() => setEditingGroup(g)}>Edit</button>
                            </td>
                        </tr>
                    ))}
                    {!groups?.length &&(
                        <tr><td className="p-4 text-center text-gray-500" colSpan={6}>No groups yet.</td></tr>
                    )}
                </tbody>
            </table>
            {editingGroup && <GroupForm initial={editingGroup} onClose={() => setEditingGroup(null)} />}
        </main>
    );
}

function GroupForm({ initial, onClose }: { initial: OptionGroup; onClose: () => void }) {
    const queryClient = useQueryClient();
    const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm<OptionGroup>({ defaultValues: initial });
    const save = useMutation({
    mutationFn: (data: OptionGroup) => AdminApi.upsertGroup(data.id || undefined, {
      categoryId: data.categoryId,
      name: data.name,
      selectionType: data.selectionType,
      minSelect: Number(data.minSelect),
      maxSelect: Number(data.maxSelect),
      sortOrder: Number(data.sortOrder)
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["groups", initial.categoryId] }); onClose(); }
  });

  return(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
        <form onSubmit={handleSubmit(data => save.mutate(data))} className="bg-white w-full max-w-lg p-6 rounded space-y-4">
            <h2 className="text-lg font-semibold">{initial.id ? "Edit Group" : "New Group"}</h2>
            <div>
                <label className="block text-sm mb-1">Name</label>
                <input type="text" {...register("name", { required: "Name is required" })} className="w-full border p-2 rounded" />

            </div>
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm mb-1">Selection Type</label>
                    <select className="w-full border round p-2" {...register("selectionType", {required: "Selection Type is required" })}> 
                        <option value="single">Single</option>
                        <option value="multiple">Multiple</option>
                        <option value="toggle">Toggle</option>
                        <option value="numeric">Numeric</option>
                        <option value="color">Color</option>
                        <option value="swatch">Swatch</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm mb-1">Min Select</label>
                    <input type="number" {...register("minSelect", { required: "Min Select is required", valueAsNumber: true })} className="w-full border p-2 rounded" />
                </div>
                <div>
                    <label className="block text-sm mb-1">Max Select</label>
                    <input type="number" {...register("maxSelect", { required: "Max Select is required", valueAsNumber: true })} className="w-full border p-2 rounded" />
                </div>
                <div>
                    <label className="block text-sm mb-1">Sort Order</label>
                    <input type="number" {...register("sortOrder", { required: "Sort Order is required", valueAsNumber: true })} className="w-full border p-2 rounded" />
                </div>
                <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200">Cancel</button>
                    <button disabled={save.isPending} className="px-3 py-2 rounded bg-black text-white">{initial.id ? "Save" : "Create"}</button>
                </div>
            </div>
        </form>
    </div>
  )
}