"use client";

import { useEffect } from "react";

// Kill-switch: actively unregister any existing service worker and clear caches.
// We previously shipped a caching SW that kept serving stale bundles to installed
// PWAs. Until the event is over, the safest path is no SW at all.
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (e) {
        console.warn("SW cleanup failed", e);
      }
    })();
  }, []);
  return null;
}
