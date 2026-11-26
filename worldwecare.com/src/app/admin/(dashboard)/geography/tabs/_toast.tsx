"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

export interface ToastState {
  ok: boolean;
  message: string;
}

export function useToast(): {
  toast: ToastState | null;
  pushToast: (ok: boolean, message: string) => void;
} {
  const [toast, setToast] = useState<ToastState | null>(null);
  const pushToast = useCallback((ok: boolean, message: string) => {
    setToast({ ok, message });
    setTimeout(() => setToast(null), 3500);
  }, []);
  return { toast, pushToast };
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-sm">
      <div
        className={cn(
          "rounded-[12px] px-4 py-3 shadow-[var(--shadow-elevated)] text-[13.5px]",
          toast.ok
            ? "bg-[color:var(--color-success)] text-[color:var(--color-on-success)]"
            : "bg-[color:var(--color-danger)] text-[color:var(--color-on-danger)]",
        )}
      >
        {toast.message}
      </div>
    </div>
  );
}
