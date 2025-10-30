// Determine API base URL with fallbacks for different environments
const getApiBase = () => {
  // Always prioritize the Railway URL for production, since Vercel env vars might not be set
  if (process.env.NODE_ENV === 'production') {
    // Try environment variables first, but always fall back to Railway
    const envUrl = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL;
    const railwayUrl = 'https://build-a-boat-production.up.railway.app';
    
    return envUrl || railwayUrl;
  }
  
  // For development
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5199";
};

let API = getApiBase();

// Safety check to ensure API is never undefined
if (!API || API === 'undefined') {
  const fallbackUrl = 'https://build-a-boat-production.up.railway.app';
  API = fallbackUrl;
}

import { string } from "zod";
import { authFetch } from "../lib/auth-client";
import { features } from "process";

export type Boat = { id: string; slug: string; name: string; basePrice: number; modelYear?: number | null; isActive: boolean; heroImageUrl?: string|null; primaryImageUrl?: string|null; secondaryImageUrl?: string|null; sideImageUrl?: string|null; logoImageUrl?: string|null; boatCategoryId?: string | null; };
export type Category = { id: string; groupId?: string | null; name: string; sortOrder: number; isRequired: boolean; };
export type OptionGroup = { id: string; categoryId: string; name: string; selectionType: string; minSelect: number; maxSelect: number; sortOrder: number; };
export type OptionItem = { id: string; optionGroupId: string; sku?: string|null; label: string; description?: string|null; priceDelta: number; imageUrl?: string|null; isDefault: boolean; isActive: boolean; sortOrder: number; };
export type Role = { id: string; name: string; slug: string; };

async function j<T>(r: Response): Promise<T> { 
  if (!r.ok) {
    const text = await r.text();
    console.error("API Error Response:", text);
    throw new Error(`API Error ${r.status}: ${text.substring(0, 200)}...`);
  }
  
  const contentType = r.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await r.text();
    console.error("Non-JSON response:", text.substring(0, 200));
    throw new Error(`Expected JSON but got: ${contentType}. Response: ${text.substring(0, 100)}...`);
  }
  
  return r.json() as Promise<T>; 
}

function authHeaders(): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
  return t ? {Authorization: `Bearer ${t}`} : {};
}

export type UserRow = {
  id: string;
  email: string;
  role: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
}

export type CategoryRow = {
  id: string;
  name: string;
  slug?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BoatCategoryRow = {
  id: string;
  name: string;
  sortOrder: number;
}

export type BoatSummary = {
  id: string;
  modelYear: number;
  name: string;
  category: string;
  msrp?: number | null;
  features?: string | null;
  startBuildUrl?: string | null;
  heroUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type BoatConfigNode = {
  id: string;
  name: string;
  type: "group" | "category" | "option";
  children?: BoatConfigNode[];
}

export const SettingsApi = {
  getTimezone: () => authFetch(`${API}/admin/settings/timezone`, {cache: "no-store"}).then(j<{value: string}>).then(r => r.value),
  setTimezone: (value: string) =>
    authFetch(`${API}/admin/settings/system/timezone`, {
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
    return fetch(`${API}/admin/users${qs}`, { cache: "no-store", headers: { ...authHeaders() } }).then(j);
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
    authFetch(`${API}/admin/users`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) }).then(j<{id:string}>),
  update: (id: string, body: Partial<{ email: string; username: string; role: string; password: string; firstName: string; lastName: string; timezone: string; avatarUrl: string; }>) =>
    authFetch(`${API}/admin/users/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) }).then(j<{id:string}>),
  delete: (id: string) =>
    authFetch(`${API}/admin/users/${id}`, { method:"DELETE" }).then(async r => { if(!r.ok) throw new Error(await r.text()); }),
}

export const AdminApi = {
  listBoats: () =>
    fetch(`${API}/admin/boat`, { cache: "no-store", headers: { ...authHeaders() } }).then(j),
  upsertBoat: (id: string | undefined, body: Omit<Boat, 'id'>) =>
    fetch(`${API}/admin/boat${id ? "/" + id : ""}`, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    }).then(j),
  listCategories: (boatId: string) => fetch(`${API}/admin/boat/${boatId}/category`, { cache: "no-store" }).then(j<Category[]>),
  upsertCategory: (id: string|undefined, body: Omit<Category,"id">) =>
    fetch(`${API}/admin/category${id?"/"+id:""}`, { method: id?"PATCH":"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).then(j<Category>),
  listGroups: (categoryId: string) => fetch(`${API}/admin/category/${categoryId}/groups`, { cache: "no-store" }).then(j<OptionGroup[]>),
  upsertGroup: (id: string|undefined, body: Omit<OptionGroup,"id">) =>
    fetch(`${API}/admin/option-groups${id?"/"+id:""}`, { method: id?"PATCH":"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).then(j<OptionGroup>),
  listOptions: (groupId: string) => fetch(`${API}/admin/groups/${groupId}/options`, { cache: "no-store" }).then(j<OptionItem[]>),
  upsertOption: (id: string|undefined, body: Omit<OptionItem,"id">) =>
    fetch(`${API}/admin/options${id?"/"+id:""}`, { method: id?"PATCH":"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).then(j<OptionItem>),
  delete: (path: string) =>
    fetch(`${API}${path}`, { method: "DELETE", headers: { ...authHeaders() } }).then((r) => {
      if (!r.ok) throw new Error("Delete failed");
    })
};

export const RolesApi = {
  list: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return authFetch(`${API}/admin/roles${qs}`, { cache: "no-store" }).then(j<{items: Role[]}>);
  },
  create: (body: { name: string; slug?: string }) =>
    authFetch(`${API}/admin/roles`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).then(j<Role>),
  update: (id: string, body: Partial<{ name: string; slug: string }>) =>
    authFetch(`${API}/admin/roles/${id}`, { method:"PATCH", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).then(j<Role>),
  delete: (id: string) =>
    authFetch(`${API}/admin/roles/${id}`, { method:"DELETE" }).then(async r => { if(!r.ok) throw new Error(await r.text()); }),
};

export const BoatsApi = {
  list: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return authFetch(`${API}/admin/boat${qs}`, { cache:"no-store" })
      .then(j<{items:Boat[]}>);
  },
  create: (b: {slug:string; name:string; basePrice:number; modelYear?:number|null}) =>
    authFetch(`${API}/admin/boat`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(b)
    }).then(j<Boat>),
  update: (id:string, b: Partial<Pick<Boat,"slug"|"name"|"basePrice"|"modelYear"|"heroImageUrl">>) =>
    authFetch(`${API}/admin/boat/${id}`, {
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(b)
    }).then(j<Boat>),
  remove: (id:string) =>
    authFetch(`${API}/admin/boat/${id}`, { method:"DELETE" })
      .then(async r => { if(!r.ok) throw new Error(await r.text()); }),

  toggleActive: (id:string) =>
    authFetch(`${API}/admin/boat/${id}/toggle-active`, { method:"POST" })
      .then(j<{id:string; isActive:boolean}>),

  duplicate: (id:string, body:{ newSlug:string; newName?:string; newModelYear?:number }) =>
    authFetch(`${API}/admin/boat/${id}/duplicate`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)
    }).then(j<Boat>),
  
  // Simple function to get a single boat by ID for editing
  getById: (id:string) =>
    authFetch(`${API}/admin/boat/${id}`, {
      headers:{"Content-Type":"application/json"},
      cache:"no-store"
    }).then(j<Boat>),
    
    
    async updateSummary(id: string, patch: Partial<BoatSummary>){
    const r = await fetch(`${API}/admin/boat/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(patch),
    });
    return j<BoatSummary>(r);
  },

  // --- tree mutations ---
  async addNode(boatId: string, parentId: string | null, type: BoatConfigNode["type"], name: string){
    const r = await fetch(`${API}/admin/boat/${boatId}/config/nodes`,{
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ parentId, type, name }),
    });
    return j<BoatConfigNode>(r);
  },
  async renameNode(boatId: string, nodeId: string, name: string){
    const r = await fetch(`${API}/admin/boat/${boatId}/config/nodes/${nodeId}`,{
      method:"PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name }),
    });
    return j<BoatConfigNode>(r);
  },
  async deleteNode(boatId: string, nodeId: string){
    const r = await fetch(`${API}/admin/boat/${boatId}/config/nodes/${nodeId}`,{
      method:"DELETE",
      headers: { ...authHeaders() },
    });
    if(!r.ok) throw new Error(await r.text());
  },
  async moveNode(boatId: string, nodeId: string, direction: "up"|"down"){
    const r = await fetch(`${API}/admin/boat/${boatId}/config/nodes/${nodeId}/move`,{
      method:"POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ direction }),
    });
    return j<{ tree: BoatConfigNode[] }>(r);
  },
};



export const BoatCategoriesApi = {
  async list(apts?: {search?: string}) {
    const p = new URLSearchParams();
    if(apts?.search) p.set("search", apts.search);
    const res = await fetch(`${API}/admin/boat-categories?` + p.toString(), {
      headers: {"Content-Type":"application/json", ...authHeaders()},
      cache: "no-store",
    })
    return j<{items:BoatCategoryRow[]}>(res);
  },

  async create(body: { Name: string; SortOrder: number }) {
    const res = await fetch(`${API}/admin/boat-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders()},
      body: JSON.stringify(body),
    });
    return j<BoatCategoryRow>(res);
  },

  async update(id: string, body: { Name: string; SortOrder: number }) {
    const res = await fetch(`${API}/admin/boat-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders()},
      body: JSON.stringify(body),
    });
    return j<BoatCategoryRow>(res);
  },
  
  async remove(id: string){
    const res = await fetch(`${API}/admin/boat-categories/${id}`, { method: "DELETE", headers: { ...authHeaders() } });
    if(!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to delete boat category: ${res.status} ${text}`);
    }
  },

  async addBoat(boatCategoryId: string, boatId: string) {
    const res = await fetch(`${API}/admin/boat-categories/${boatCategoryId}/boats/${boatId}`, {
      method: "POST",
      headers: { ...authHeaders() },
    });
    if(!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to add boat: ${res.status} ${text}`);
    }
  },

  async removeBoat(boatCategoryId: string, boatId: string) {
    const res = await fetch(`${API}/admin/boat-categories/${boatCategoryId}/boats/${boatId}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    });
    if(!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to remove boat: ${res.status} ${text}`);
    }
  },

  async getBoats(boatCategoryId: string) {
    const res = await fetch(`${API}/admin/boat-categories/${boatCategoryId}/boats`, {
      headers: { ...authHeaders() },
      cache: "no-store",
    });
    return j<{boats: Boat[]}>(res);
  }
}