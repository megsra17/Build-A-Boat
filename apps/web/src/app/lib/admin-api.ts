const API = process.env.NEXT_PUBLIC_API_BASE;

import { authFetch } from "../lib/auth-client";

export type Boat = { id: string; slug: string; name: string; basePrice: number; modelYear?: number | null; isActive: boolean; };
export type Category = { id: string; boatId: string; name: string; sortOrder: number; isRequired: boolean; };
export type OptionGroup = { id: string; categoryId: string; name: string; selectionType: string; minSelect: number; maxSelect: number; sortOrder: number; };
export type OptionItem = { id: string; optionGroupId: string; sku?: string|null; label: string; description?: string|null; priceDelta: number; imageUrl?: string|null; isDefault: boolean; isActive: boolean; sortOrder: number; };
export type Role = { id: string; name: string; slug: string; };

async function j<T>(r: Response){ if(!r.ok) throw new Error(await r.text()); return r.json() as Promise<T>; }

function authHeaders(): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  return t ? {Authorization: `Bearer ${t}`} : {};
}

export type UserRow = {
  id: string;
  email: string;
  role: string;
  username?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const SettingsApi = {
  getTimezone: () => authFetch(`${API}/api/admin/settings/timezone`, {cache: "no-store"}).then(j<{value: string}>).then(r => r.value),
  setTimezone: (value: string) =>
    authFetch(`${API}/api/admin/settings/system/timezone`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "system.timezone", value }),
    }).then(j<{ value: string }>),
}

export const UsersApi = {
  list: (opts?: {search?: string; page?: number; pageSize?: number}) =>{
    const p = new URLSearchParams();
    if(opts?.search) p.set("search", opts.search);
    if(opts?.page) p.set("page", opts.page.toString());
    if(opts?.pageSize) p.set("pageSize", opts.pageSize.toString());
    const qs = p.toString() ? `?${p.toString()}` : "";
    return fetch(`${API}/api/admin/users${qs}`, { cache: "no-store", headers: { ...authHeaders() } }).then(j);
  },
  create: (body: {
    email: string;
    username?: string;
    role: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    timezone?: string;
    avatarUrl?: string;
  }) =>
    authFetch(`${API}/api/admin/users`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) }).then(j<{id:string}>),
  update: (id: string, body: Partial<{ email: string; username: string; role: string; password: string; firstName: string; lastName: string; timezone: string; avatarUrl: string; }>) =>
    authFetch(`${API}/api/admin/users/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) }).then(j<{id:string}>),
  delete: (id: string) =>
    authFetch(`${API}/api/admin/users/${id}`, { method:"DELETE" }).then(async r => { if(!r.ok) throw new Error(await r.text()); }),
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

export const RolesApi = {
  list: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return authFetch(`${API}/api/admin/roles${qs}`, { cache: "no-store" }).then(j<{items: Role[]}>);
  },
  create: (body: { name: string; slug?: string }) =>
    authFetch(`${API}/api/admin/roles`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).then(j<Role>),
  update: (id: string, body: Partial<{ name: string; slug: string }>) =>
    authFetch(`${API}/api/admin/roles/${id}`, { method:"PATCH", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).then(j<Role>),
  delete: (id: string) =>
    authFetch(`${API}/api/admin/roles/${id}`, { method:"DELETE" }).then(async r => { if(!r.ok) throw new Error(await r.text()); }),
};