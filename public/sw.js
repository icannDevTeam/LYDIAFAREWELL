/* Self-destruct service worker.
 * Older app versions registered a caching SW that kept serving stale bundles
 * on installed PWAs. This worker takes over, clears every cache, then
 * unregisters itself so the page always loads fresh from the network. */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    const regs = await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    for (const c of clients) {
      try { c.navigate(c.url); } catch {}
    }
  })());
});

self.addEventListener("fetch", () => { /* no-op: always go to network */ });
