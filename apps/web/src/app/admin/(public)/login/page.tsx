import { Suspense } from "react";
import LoginClient from "./login.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-white/70">Loading…</div>}>
      <LoginClient />
    </Suspense>
  );
}
