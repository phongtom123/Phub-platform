"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { preloadAdminData } from "@/src/lib/admin-preload";

export function AdminDataPreloader({ identity }: { identity: string }) {
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    // Let the active page start first; background jobs never gate the shell.
    const timer = setTimeout(() => {
      void preloadAdminData(controller.signal, () => document.visibilityState !== "hidden" && navigator.onLine !== false &&
        !document.activeElement?.matches("input, textarea, select, [contenteditable=true]") &&
        !document.querySelector("form.live-form, .inline-data-row-editing, .account-row-editing"), href => router.prefetch(href));
    }, 1_500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [identity, router]);
  return null;
}
