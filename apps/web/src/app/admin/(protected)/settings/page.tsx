"use client";

import {useEffect, useState} from "react";
import { SettingsApi } from "@/app/lib/admin-api";
import { set } from "zod";

const Timezones = [
    "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"
]

export default function SettingsPage() {
    const [timezone, setTimezone] = useState("UTC");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
    (async () => {
      try {
        setError("");
        const v = await SettingsApi.getTimezone();
        setTimezone(v || "UTC");
      } catch (e: unknown) {
        setError("Failed to load timezone");
        console.error(e);
      }
    })();
  }, []);

  async function onSave(){
    setBusy(true);
    setMessage("");
    setError("");
    try{
        await SettingsApi.setTimezone(timezone);
        setMessage("Settings saved.");
    } catch(e: unknown){
        setError("Failed to save settings.");
        console.error(e);
    } finally {
        setBusy(false);
        setTimeout(() => setMessage(""), 3000);
    }
  }
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Settings</h1>
            <div className="rounded-lg border border-white/10 bg-[#1f1f1f] p-4">
        <div className="mb-2">
          <div className="inline-block px-3 py-1 rounded bg-white/10 text-sm">General</div>
        </div>

        <label className="block text-xs uppercase tracking-wide text-white/60 mb-1">
          System Timezone
        </label>
        <div className="flex items-center gap-3">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex-1 bg-transparent border-b border-white/20 focus:border-white/40 outline-none py-2"
          >
            {Timezones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>

          <button
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
          >
            💾 Save
          </button>
        </div>

        {message && <div className="mt-2 text-green-400 text-sm">{message}</div>}
        {error && <div className="mt-2 text-red-400 text-sm">{error}</div>}
      </div>
    </div>
  );
}