"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import {Eye, EyeOff, Upload, Check} from "lucide-react";
import { UsersApi } from "../../../../lib/admin-api";
import { Roles, Timezones } from "@/app/lib/constants"; 

// Use Railway URL for production, localhost for development
const API = process.env.NODE_ENV === 'production' 
  ? "https://build-a-boat-production.up.railway.app"
  : "http://localhost:5001";

export default function NewUserPage() {
    const r = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [role, setRole] = useState("user");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [timezone, setTimezone] = useState("UTC");

    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [ok, setOk] = useState(false);

    function onPickAvatar(){
        fileRef.current?.click();
    }

    function onAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>){
        const f = e.target.files?.[0];
        if(!f){
            return;
        }
        
        // Show preview
        const reader = new FileReader();
        reader.onload = () => setAvatarPreview(String(reader.result));
        reader.readAsDataURL(f);

        // Store file for upload
        setAvatarFile(f);
        setUploadingAvatar(true);

        // Upload to S3
        uploadAvatarToS3(f);
    }

    async function uploadAvatarToS3(file: File) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = typeof window !== "undefined" ? localStorage.getItem("token") || sessionStorage.getItem("token") : null;
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch(`${API}/admin/media/upload/avatars`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Upload failed: ${response.status} ${response.statusText}. ${errorData.message || ''}`);
            }

            const data = await response.json();
            setAvatarUrl(data.url);
            setError("");
        } catch (err) {
            console.error('Avatar upload error:', err);
            setError(`Failed to upload avatar: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setUploadingAvatar(false);
        }
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(""); setOk(false);

        if(!email || !email.includes("@")){
            setError("Please enter a valid email address.");
            return;
        }

        if(password !== confirmPassword){
            setError("Passwords do not match.");
            return;
        }

        setBusy(true);
        try{
            await UsersApi.create({
                email,
                username: username || undefined,
                role,
                password: password || undefined,
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                timezone,
                avatarUrl,
            });
            setOk(true);
            setTimeout(() => r.replace("/admin/users"), 1000);
        }
        catch(err: unknown){
            console.error(err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        }
        finally{
            setBusy(false);
        }
    }

    return (
    <div className="rounded-lg border border-white/10 bg-[#1f1f1f] p-3">
      <header className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
        <div className="flex items-center gap-2 text-white/80">
          <span className="inline-flex items-center justify-center size-5 rounded-full border border-white/20">👤</span>
          <span className="font-medium">New User</span>
        </div>
        <button
          form="newUserForm"
          type="submit"
          className="inline-flex items-center gap-2 rounded-full border border-amber-600/50 text-amber-400 px-3 py-1.5 hover:bg-amber-500/10"
        >
          <Check className="size-4" /> Save
        </button>
      </header>

      <form id="newUserForm" onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Avatar upload */}
        <div className="lg:col-span-4 xl:col-span-3 flex items-center justify-center">
          <div
            className="relative size-72 rounded-full bg-black/60 border border-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:border-white/20 transition-colors"
            onClick={onPickAvatar}
            role="button"
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="avatar preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-white/60">
                <Upload className="size-20 mb-3" />
                <div>Upload Avatar</div>
                <div className="text-xs text-white/40">PNG/JPG</div>
              </div>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-sm text-white/80">Uploading...</div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onAvatarFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Fields */}
        <div className="lg:col-span-8 xl:col-span-9 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div>
            <label className="text-sm text-white/70">First Name</label>
            <input value={firstName} onChange={e=>setFirstName(e.target.value)} className="w-full bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2" />
          </div>
          <div>
            <label className="text-sm text-white/70">Last Name</label>
            <input value={lastName} onChange={e=>setLastName(e.target.value)} className="w-full bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2" />
          </div>
          <div>
            <label className="text-sm text-white/70">Username</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2" />
          </div>
          <div>
            <label className="text-sm text-white/70">Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2" />
          </div>

          <div>
            <label className="text-sm text-white/70">Role</label>
            <select value={role} onChange={e=>setRole(e.target.value)} className="w-full bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2">
              {Roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-white/70">Timezone</label>
            <select value={timezone} onChange={e=>setTimezone(e.target.value)} className="w-full bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2">
              {Timezones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>

          <div className="relative">
            <label className="text-sm text-white/70">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e=>setPassword(e.target.value)}
              className="w-full bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2 pr-8"
            />
            <button type="button" onClick={()=>setShowPassword(s=>!s)} className="absolute right-0 bottom-2 p-1 text-white/70">{showPassword ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}</button>
          </div>
          <div className="relative">
            <label className="text-sm text-white/70">Re-Enter Password</label>
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={e=>setConfirmPassword(e.target.value)}
              className="w-full bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2 pr-8"
            />
            <button type="button" onClick={()=>setShowConfirmPassword(s=>!s)} className="absolute right-0 bottom-2 p-1 text-white/70">{showConfirmPassword ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}</button>
          </div>
        </div>
      </form>

      {/* Footer alerts */}
      {error && <div className="mt-4 text-sm text-red-400">{error}</div>}
      {ok &&  <div className="mt-4 text-sm text-green-400">User created.</div>}
      {busy && <div className="mt-4 text-sm text-white/60">Saving…</div>}
    </div>
  );
}