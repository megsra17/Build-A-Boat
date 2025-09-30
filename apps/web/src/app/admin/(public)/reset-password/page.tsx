// This file can be server or client — we'll keep it server by default.
import { Suspense } from "react";
import ResetPasswordClient from "./reset-password.client";

// Mark the route as dynamic so it doesn't try to fully prerender with missing params
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-white/70">Loading…</div>}>
      <ResetPasswordClient />
    </Suspense>
  );
}
