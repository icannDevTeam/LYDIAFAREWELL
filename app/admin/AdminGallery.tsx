"use client";

import { useEffect, useMemo, useState } from "react";

export type AdminMessage = {
  id: string;
  imageUrl: string;
  note: string;
  author: string | null;
  storagePath: string | null;
  createdAt: number;
  hidden?: boolean;
};

type View = "gallery" | "print";
type Sort = "newest" | "oldest";

const NEW_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export default function AdminGallery({
  messages: initial,
  adminToken,
}: {
  messages: AdminMessage[];
  adminToken: string;
}) {
  const [messages, setMessages] = useState(initial);
  const [view, setView] = useState<View>("gallery");
  const [sort, setSort] = useState<Sort>("newest");
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<AdminMessage | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Re-tick once a minute so "NEW" badges fade out without a refresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Esc closes lightbox
  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = messages.slice();
    if (!showHidden) list = list.filter((m) => !m.hidden);
    if (q) {
      list = list.filter(
        (m) =>
          m.note.toLowerCase().includes(q) ||
          (m.author || "").toLowerCase().includes(q),
      );
    }
    list.sort((a, b) =>
      sort === "newest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
    );
    return list;
  }, [messages, query, sort, showHidden]);

  async function remove(id: string) {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      alert(err?.message || "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  async function toggleHidden(m: AdminMessage) {
    const next = !m.hidden;
    setBusy(m.id);
    // optimistic
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, hidden: next } : x)),
    );
    try {
      const res = await fetch(`/api/admin/messages/${m.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ hidden: next }),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
    } catch (err: any) {
      // revert
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, hidden: !next } : x)),
      );
      alert(err?.message || "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.href = "/admin/login";
  }

  function downloadZip() {
    // Anchor click triggers the streaming download; cookie auths the request.
    window.location.href = "/api/admin/export";
  }

  const visibleCount = messages.filter((m) => !m.hidden).length;
  const hiddenCount = messages.length - visibleCount;

  return (
    <main className="min-h-screen text-stone-800" data-view={view}>
      <style jsx global>{`
        body {
          background: #fbf5ec !important;
          color: #1c1917 !important;
        }
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-card {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #e7e0d4 !important;
          }
        }
      `}</style>

      {/* Top bar */}
      <header className="no-print sticky top-0 z-30 backdrop-blur bg-[#fbf5ec]/85 border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-script text-base text-stone-500 leading-none">a warm goodbye for</p>
            <h1 className="font-serif text-2xl text-stone-800 leading-tight">Lidiya · Host Dashboard</h1>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes or names…"
            className="px-4 py-2 rounded-full bg-white border border-stone-300 text-sm w-56 focus:outline-none focus:border-amber-500"
          />

          <div className="flex items-center rounded-full bg-white border border-stone-300 p-1 text-sm">
            <button
              onClick={() => setSort("newest")}
              className={`px-3 py-1 rounded-full ${sort === "newest" ? "bg-stone-800 text-white" : "text-stone-600"}`}
            >
              Newest
            </button>
            <button
              onClick={() => setSort("oldest")}
              className={`px-3 py-1 rounded-full ${sort === "oldest" ? "bg-stone-800 text-white" : "text-stone-600"}`}
            >
              Oldest
            </button>
          </div>

          <div className="flex items-center rounded-full bg-white border border-stone-300 p-1 text-sm">
            <button
              onClick={() => setView("gallery")}
              className={`px-3 py-1 rounded-full ${view === "gallery" ? "bg-stone-800 text-white" : "text-stone-600"}`}
            >
              Gallery
            </button>
            <button
              onClick={() => setView("print")}
              className={`px-3 py-1 rounded-full ${view === "print" ? "bg-stone-800 text-white" : "text-stone-600"}`}
            >
              Print layout
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition"
          >
            Print / PDF
          </button>

          <button
            onClick={downloadZip}
            className="px-4 py-2 rounded-full bg-stone-800 hover:bg-stone-700 text-white text-sm font-medium transition"
            title="Download every photo + a manifest of notes"
          >
            Download ZIP
          </button>

          <button
            onClick={logout}
            className="px-3 py-2 rounded-full text-sm text-stone-500 hover:text-stone-800"
          >
            Log out
          </button>
        </div>

        <div className="max-w-7xl mx-auto px-6 pb-3 text-xs text-stone-500 flex flex-wrap items-center gap-4">
          <span>{visibleCount} on display</span>
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden((v) => !v)}
              className="underline-offset-2 hover:underline"
            >
              {showHidden ? `hide ${hiddenCount} hidden` : `show ${hiddenCount} hidden`}
            </button>
          )}
          {query && <span>· {filtered.length} match{filtered.length === 1 ? "" : "es"}</span>}
          <span className="opacity-50">·</span>
          <a href="/display" target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">
            Open TV display
          </a>
          <a href="/upload" target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">
            Open upload page
          </a>
        </div>
      </header>

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <h2 className="font-serif italic text-4xl mb-3">No messages yet</h2>
          <p className="text-stone-500">When guests upload, they will appear here.</p>
        </div>
      )}

      {/* Gallery view */}
      {view === "gallery" && messages.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-8">
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 [column-fill:_balance]">
            {filtered.map((m) => {
              const isNew = now - m.createdAt < NEW_THRESHOLD_MS;
              const isHidden = !!m.hidden;
              return (
                <article
                  key={m.id}
                  className={`print-card mb-6 break-inside-avoid bg-white rounded-2xl shadow-sm border overflow-hidden group relative ${
                    isHidden ? "opacity-50 border-stone-300" : "border-stone-200"
                  }`}
                >
                  {isNew && (
                    <span className="no-print absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] tracking-[0.2em] uppercase font-medium shadow">
                      New
                    </span>
                  )}
                  {isHidden && (
                    <span className="no-print absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-stone-800 text-white text-[10px] tracking-[0.2em] uppercase font-medium shadow">
                      Hidden
                    </span>
                  )}

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.imageUrl}
                    alt=""
                    loading="lazy"
                    onClick={() => setLightbox(m)}
                    className="w-full h-auto block cursor-zoom-in"
                  />
                  <div className="p-4">
                    <p className="font-serif text-[17px] leading-snug text-stone-800 whitespace-pre-wrap">
                      “{m.note}”
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                      <span className="font-script text-base text-stone-600">
                        {m.author ? `— ${m.author}` : "— a friend"}
                      </span>
                      <time>{formatDate(m.createdAt)}</time>
                    </div>
                  </div>

                  <div className="no-print absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
                    <button
                      onClick={() => toggleHidden(m)}
                      disabled={busy === m.id}
                      className="bg-white/90 hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-full px-3 py-1 text-xs"
                      title={isHidden ? "Show on TV again" : "Hide from TV"}
                    >
                      {busy === m.id ? "…" : isHidden ? "Unhide" : "Hide"}
                    </button>
                    <button
                      onClick={() => remove(m.id)}
                      disabled={busy === m.id}
                      className="bg-white/90 hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-full px-3 py-1 text-xs"
                      title="Delete forever"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Print layout */}
      {view === "print" && messages.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-10">
          <div className="text-center mb-10 print-cover">
            <p className="font-script text-3xl text-stone-500">a warm goodbye for</p>
            <h2 className="font-serif text-6xl text-stone-800">Lidiya</h2>
            <p className="mt-3 text-stone-500 italic">
              messages from the people who love you · {filtered.length} in all
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {filtered.map((m) => (
              <article
                key={m.id}
                className="print-card bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.imageUrl}
                  alt=""
                  loading="lazy"
                  className="w-full aspect-[4/3] object-cover"
                />
                <div className="p-5">
                  <p className="font-serif text-lg leading-relaxed text-stone-800 whitespace-pre-wrap">
                    “{m.note}”
                  </p>
                  <p className="mt-4 font-script text-xl text-stone-600">
                    {m.author ? `— ${m.author}` : "— a friend"}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">{formatDate(m.createdAt)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="no-print py-10 text-center text-xs text-stone-400 font-script text-sm">
        made with love · for Lidiya
      </footer>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="no-print fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-5xl w-full max-h-full flex flex-col items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.imageUrl}
              alt=""
              className="max-h-[75vh] w-auto rounded-lg shadow-2xl"
            />
            <div className="mt-4 max-w-2xl text-center text-white">
              <p className="font-serif italic text-xl leading-snug">
                “{lightbox.note}”
              </p>
              <p className="mt-2 font-script text-lg text-amber-200">
                {lightbox.author ? `— ${lightbox.author}` : "— a friend"}
              </p>
            </div>
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-2 right-2 bg-white/15 hover:bg-white/25 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function formatDate(ms: number) {
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
