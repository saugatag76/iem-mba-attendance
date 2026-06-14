"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

export function PasswordField() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input
        id="password"
        name="password"
        type={visible ? "text" : "password"}
        required
        autoComplete="current-password"
        placeholder="••••••••"
        className="block w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-slate-900 placeholder-slate-400 transition focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}
