"use client";

import { useMemo, useState } from "react";

export type AdminMessage = {
  id: string;
  imageUrl: string;
  note: string;
  author: string | null;
  storagePath: string | null;
  createdAt: number;
};

type View = "gallery" | "print";

export default function AdminGallery({
  messages: initial,
  adminToken,
}: {
  messages: AdminMessage[];
  adminToken: string;
}) {
  const [messages, setMessages] = useState(initial);
  const [view, setView] = useState<View>("gallery");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.note.toLowerCase().includes(q) ||
        (m.author || "").toLowerCase().includes(q),
    );
  }, [messages, query]);

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

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.href = "/admin/login";
  }

  return (
    <main className="min-h-screen text-stone-800" data-view={view}>
      {/* Light theme background (overrides body) */}
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
            🖨️ Print / Save PDF
          </button>

          <button
            onClick={logout}
            className="px-3 py-2 rounded-full text-sm text-stone-500 hover:text-stone-800"
          >
            Log out
          </button>
        </div>

        <div className="max-w-7xl mx-auto px-6 pb-3 text-xs text-stone-500 flex flex-wrap gap-4">
          <span>{messages.length} message{messages.length === 1 ? "" : "s"}</span>
          {query && <span>{filtered.length} match{filtered.length === 1 ? "" : "es"}</span>}
          <a href="/display" target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">
            ↗ Open TV display
          </a>
          <a href="/upload" target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">
            ↗ Open upload page
          </a>
        </div>
      </header>

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="text-6xl mb-4">🌅</div>
          <h2 className="font-serif text-3xl mb-2">No messages yet</h2>
          <p className="text-stone-500">When guests upload, they will appear here.</p>
        </div>
      )}

      {/* Gallery view */}
      {view === "gallery" && messages.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-8">
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 [column-fill:_balance]">
            {filtered.map((m) => (
              <article
                key={m.id}
                className="print-card mb-6 break-inside-avoid bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden group relative"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.imageUrl}
                  alt=""
                  loading="lazy"
                  className="w-full h-auto block"
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

                <button
                  onClick={() => remove(m.id)}
                  disabled={busy === m.id}
                  className="no-print absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition bg-white/90 hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-full px-3 py-1 text-xs"
                  title="Delete"
                >
                  {busy === m.id ? "…" : "Delete"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Print layout — keepsake book pages: 2 per row, generous spacing */}
      {view === "print" && messages.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-10">
          <div className="text-center mb-10 print-cover">
            <p className="font-script text-3xl text-stone-500">a warm goodbye for</p>
            <h2 className="font-serif text-6xl text-stone-800">Lidiya</h2>
            <p className="mt-3 text-stone-500 italic">
              messages from the people who love you · {messages.length} in all
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
