const API = process.env.NEXT_PUBLIC_API_BASE;

export type Boat = { id: string; slug: string; name: string; basePrice: number; modelYear?: number | null; isActive: boolean; };
export type Category = { id: string; boatId: string; name: string; sortOrder: number; isRequired: boolean; };
export type OptionGroup = { id: string; categoryId: string; name: string; selectionType: string; minSelect: number; maxSelect: number; sortOrder: number; };
export type OptionItem = { id: string; optionGroupId: string; sku?: string|null; label: string; description?: string|null; priceDelta: number; imageUrl?: string|null; isDefault: boolean; isActive: boolean; sortOrder: number; };

async function j<T>(r: Response){ if(!r.ok) throw new Error(await r.text()); return r.json() as Promise<T>; }

function authHeaders(): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  return t ? {Authorization: `Bearer ${t}`} : {};
}

export const AdminApi = {
  listBoats: () =>
    fetch(`${API}/api/admin/boats`, { cache: "no-store", headers: { ...authHeaders() } }).then(j),
  upsertBoat: (id: string | undefined, body: Omit<Boat, 'id'>) =>
    fetch(`${API}/api/admin/boats${id ? "/" + id : ""}`, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    }).then(j),
  listCategories: (boatId: string) => fetch(`${API}/api/admin/boats/${boatId}/categories`, { cache: "no-store" }).then(j<Category[]>),
  upsertCategory: (id: string|undefined, body: Omit<Category,"id">) =>
    fetch(`${API}/api/admin/categories${id?"/"+id:""}`, { method: id?"PATCH":"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).then(j<Category>),
  listGroups: (categoryId: string) => fetch(`${API}/api/admin/categories/${categoryId}/groups`, { cache: "no-store" }).then(j<OptionGroup[]>),
  upsertGroup: (id: string|undefined, body: Omit<OptionGroup,"id">) =>
    fetch(`${API}/api/admin/option-groups${id?"/"+id:""}`, { method: id?"PATCH":"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).then(j<OptionGroup>),
  listOptions: (groupId: string) => fetch(`${API}/api/admin/groups/${groupId}/options`, { cache: "no-store" }).then(j<OptionItem[]>),
  upsertOption: (id: string|undefined, body: Omit<OptionItem,"id">) =>
    fetch(`${API}/api/admin/options${id?"/"+id:""}`, { method: id?"PATCH":"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).then(j<OptionItem>),
  delete: (path: string) =>
    fetch(`${API}${path}`, { method: "DELETE", headers: { ...authHeaders() } }).then((r) => {
      if (!r.ok) throw new Error("Delete failed");
    })
};