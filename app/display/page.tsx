"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { getDb, COLLECTION, isFirebaseConfigured } from "@/lib/firebase";
import type { Message } from "@/lib/types";

// --- Scene system -----------------------------------------------------------

type SceneType =
  | "hero"
  | "kenburns"
  | "quote"
  | "polaroidStack"
  | "collagePop"
  | "mosaic";

type Scene = {
  type: SceneType;
  label: string;
  minMessages: number;
  durationMs: number;
  weight: number;
};

const SCENES: Scene[] = [
  { type: "hero",          label: "Hero",     minMessages: 1, durationMs: 8000,  weight: 3 },
  { type: "kenburns",      label: "Pan",      minMessages: 1, durationMs: 9000,  weight: 2 },
  { type: "quote",         label: "Quote",    minMessages: 1, durationMs: 10000, weight: 2 },
  { type: "polaroidStack", label: "Stack",    minMessages: 3, durationMs: 10000, weight: 2 },
  { type: "collagePop",    label: "Collage",  minMessages: 5, durationMs: 11000, weight: 2 },
  { type: "mosaic",        label: "Mosaic",   minMessages: 6, durationMs: 10000, weight: 1 },
];

const IDLE_LINES = [
  "Some friendships cross oceans…",
  "…and never lose their warmth.",
  "Tonight, we celebrate Lidiya.",
  "Years of laughter. A lifetime of memories.",
  "Sunshine, even on the cloudy days.",
  "The friend who feels like home.",
  "Distance changes nothing. Love stays.",
  "Here's to every chapter still to come.",
];

function pickScene(prev: SceneType | null, available: number, focus?: Message): Scene {
  const candidates = SCENES.filter(
    (s) => s.minMessages <= available && s.type !== prev,
  );
  let pool = candidates.length
    ? candidates
    : SCENES.filter((s) => s.minMessages <= available);

  // Bias: if the focus message has a long note, favour the quote scene.
  const isLong = !!focus && focus.note.length >= 120;
  const weighted = pool.map((s) => ({
    s,
    w: s.type === "quote" ? (isLong ? s.weight * 3 : s.weight * 0.5) : s.weight,
  }));
  const total = weighted.reduce((a, x) => a + x.w, 0);
  let r = Math.random() * total;
  for (const x of weighted) {
    r -= x.w;
    if (r <= 0) return x.s;
  }
  return pool[0];
}

function sample<T extends { id: string }>(arr: T[], n: number, excludeId?: string): T[] {
  const pool = excludeId ? arr.filter((x) => x.id !== excludeId) : arr.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

// Multi-photo scenes (polaroid stack / collage / mosaic) look odd with
// videos as background tiles, so we only feed them image messages.
function imagesOnly<T extends Message>(arr: T[]): T[] {
  return arr.filter((m) => m.mediaType !== "video");
}

// Single component that renders a message's media — image or video — with
// the same className/style hooks so existing scenes don't need to branch.
function MediaTile({
  message,
  className,
  style,
  fit = "cover",
}: {
  message: Message;
  className?: string;
  style?: React.CSSProperties;
  fit?: "cover" | "contain";
}) {
  if (message.mediaType === "video") {
    return (
      <video
        src={message.imageUrl}
        className={`${className || ""} ${fit === "cover" ? "object-cover" : "object-contain"}`}
        style={style}
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={message.imageUrl}
      alt=""
      className={`${className || ""} ${fit === "cover" ? "object-cover" : "object-contain"}`}
      style={style}
    />
  );
}

// --- Page -------------------------------------------------------------------

export default function DisplayPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [focusIdx, setFocusIdx] = useState(0);
  const [scene, setScene] = useState<Scene>(SCENES[0]);
  const [idleLine, setIdleLine] = useState(0);
  const [configError, setConfigError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toast, setToast] = useState<Message | null>(null);
  const prevSceneType = useRef<SceneType | null>(null);

  // Subscribe to Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setConfigError("Firebase isn't configured. Add keys to .env.local and restart.");
      return;
    }
    try {
      const db = getDb();
      const q = query(collection(db, COLLECTION), orderBy("createdAt", "asc"));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const list: Message[] = snap.docs
            .map((d) => {
              const data = d.data() as any;
              const ts: Timestamp | undefined = data.createdAt;
              return {
                id: d.id,
                imageUrl: data.imageUrl,
                mediaType: data.mediaType === "video" ? "video" : "image",
                note: data.note || "",
                author: data.author || undefined,
                createdAt: ts?.toMillis?.() ?? Date.now(),
                _hidden: data.hidden === true,
              } as Message & { _hidden: boolean };
            })
            .filter((m) => !(m as any)._hidden);
          setMessages(list);
        },
        (err) => {
          console.error(err);
          setConfigError(err.message);
        },
      );
      return () => unsub();
    } catch (e: any) {
      setConfigError(e?.message || "Failed to connect to Firebase.");
    }
  }, []);

  // Scene scheduler
  useEffect(() => {
    if (messages.length === 0 || paused) return;
    const focus = messages[focusIdx];
    const next = pickScene(prevSceneType.current, messages.length, focus);
    prevSceneType.current = next.type;
    setScene(next);
    const t = setTimeout(() => {
      setFocusIdx((i) => (i + 1) % messages.length);
      setSceneIdx((i) => i + 1);
    }, next.durationMs);
    return () => clearTimeout(t);
  }, [sceneIdx, messages.length, paused, focusIdx]);

  // New message arrives → jump to it + show toast
  const prevCount = useRef(0);
  useEffect(() => {
    if (messages.length > prevCount.current && prevCount.current > 0) {
      const fresh = messages[messages.length - 1];
      setFocusIdx(messages.length - 1);
      setSceneIdx((i) => i + 1);
      setToast(fresh);
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
    prevCount.current = messages.length;
  }, [messages]);

  // Idle line rotation
  useEffect(() => {
    if (messages.length > 0) return;
    const t = setInterval(() => setIdleLine((i) => (i + 1) % IDLE_LINES.length), 6000);
    return () => clearInterval(t);
  }, [messages.length]);

  // Hotkeys: → next · ← previous · space pause/resume · f fullscreen
  const next = useCallback(() => {
    if (messages.length === 0) return;
    setFocusIdx((i) => (i + 1) % messages.length);
    setSceneIdx((i) => i + 1);
  }, [messages.length]);
  const prev = useCallback(() => {
    if (messages.length === 0) return;
    setFocusIdx((i) => (i - 1 + messages.length) % messages.length);
    setSceneIdx((i) => i + 1);
  }, [messages.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Track fullscreen state so the button label/icon updates when the user
  // enters/exits via Esc, the hotkey, or the OS chrome.
  useEffect(() => {
    function onChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Some browsers (iOS Safari) don't support fullscreen API on arbitrary
        // elements. Installing as a PWA via Add to Home Screen gives the same
        // chromeless experience.
      });
    }
  }, []);

  // Screen Wake Lock — asks the OS to keep the display awake while /display
  // is open so projectors / monitors don't blank during the party. The lock
  // is automatically released when the tab is hidden, so we re-acquire it on
  // visibilitychange. No-op on browsers without the API (older Safari, etc.).
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<any> };
    };
    if (!nav.wakeLock) return;

    let sentinel: any = null;
    let cancelled = false;

    async function acquire() {
      try {
        sentinel = await nav.wakeLock!.request("screen");
        sentinel.addEventListener?.("release", () => {
          // OS released the lock (tab hidden, battery saver, etc.).
          sentinel = null;
        });
      } catch {
        // Permission denied or unsupported — silently ignore.
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible" && !sentinel && !cancelled) {
        acquire();
      }
    }

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      try { sentinel?.release?.(); } catch {}
    };
  }, []);

  // Connection resilience — if the device's Wi-Fi drops, browsers will show
  // their generic "this site can't be reached" page on the next navigation.
  // We can't prevent that, but we CAN: show our own friendly overlay while
  // offline, and auto-reload as soon as connectivity comes back so the
  // slideshow recovers without anyone touching the projector.
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsOnline(navigator.onLine);
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    function onOnline() {
      setIsOnline(true);
      // Wait a beat for the network to actually stabilize, then refresh so
      // the Firestore subscription and image URLs are guaranteed healthy.
      reloadTimer = setTimeout(() => window.location.reload(), 1500);
    }
    function onOffline() {
      setIsOnline(false);
      if (reloadTimer) { clearTimeout(reloadTimer); reloadTimer = null; }
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (reloadTimer) clearTimeout(reloadTimer);
    };
  }, []);

  const focus = messages[focusIdx];

  return (
    <main
      data-screen="display"
      className="relative w-screen h-screen overflow-hidden bg-black"
    >
      {/* Animated warm gradient backdrop */}
      <div className="absolute inset-0 bg-animated-warm" />

      {/* Bokeh + particles ambient layers */}
      <BokehLayer />
      <ParticleLayer />

      {/* Header */}
      <div className="absolute top-6 left-8 z-30 flex items-baseline gap-3">
        <span className="text-[11px] tracking-[0.35em] uppercase text-sunset-200/70">
          Farewell
        </span>
        <span className="font-serif italic text-3xl text-shimmer">Lidiya</span>
      </div>
      {messages.length > 0 && (
        <div className="absolute top-6 right-8 z-30 text-sunset-100/60 text-xs tracking-[0.25em] uppercase flex items-center gap-3">
          <span>{focusIdx + 1} / {messages.length}</span>
          <span className="opacity-40">·</span>
          <span>{messages.length} memories</span>
          {paused && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-sunset-300/15 border border-sunset-300/30 text-sunset-200">
              Paused
            </span>
          )}
          <button
            onClick={toggleFullscreen}
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/15 text-sunset-100/85 hover:text-sunset-50 transition"
            title={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            )}
            <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </button>
        </div>
      )}

      {/* Idle state */}
      {messages.length === 0 && !configError && <IdleState lineIndex={idleLine} />}

      {/* Config error */}
      {configError && (
        <div className="absolute inset-0 flex items-center justify-center z-40">
          <div className="glass rounded-3xl p-10 max-w-xl text-center">
            <p className="text-[11px] tracking-[0.35em] uppercase text-sunset-200/70">
              Setup needed
            </p>
            <p className="mt-3 font-serif italic text-2xl text-sunset-50">
              {configError}
            </p>
          </div>
        </div>
      )}

      {/* Scene swap */}
      <AnimatePresence mode="sync">
        {focus && (
          <motion.div
            key={sceneIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <SceneRenderer scene={scene} focus={focus} all={messages} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Just-uploaded toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-40"
          >
            <div className="glass rounded-full pl-2 pr-6 py-2 flex items-center gap-3 shadow-2xl border border-sunset-300/30">
              <MediaTile
                message={toast}
                className="w-9 h-9 rounded-full border border-white/30"
              />
              <div className="text-left">
                <p className="text-[10px] tracking-[0.3em] uppercase text-sunset-200/80">
                  Just arrived
                </p>
                <p className="font-serif italic text-sunset-50 leading-tight">
                  {toast.author ? `From ${toast.author}` : "A new memory"}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer: scene dots + helper */}
      {messages.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
          {SCENES.map((s) => {
            const isActive = s.type === scene.type;
            return (
              <span
                key={s.type}
                className={`h-1.5 rounded-full transition-all duration-700 ${
                  isActive
                    ? "w-8 bg-sunset-200 shadow-[0_0_12px_rgba(253,186,116,0.5)]"
                    : "w-1.5 bg-sunset-200/25"
                }`}
                aria-label={s.label}
              />
            );
          })}
        </div>
      )}

      {/* Footer credits: Albert bottom-left, Lidiya bottom-right */}
      <p className="absolute bottom-6 left-8 z-30 text-[10px] tracking-[0.3em] uppercase text-sunset-100/35">
        © 2026 · Built and designed by Albert
      </p>
      <p className="absolute bottom-6 right-8 z-30 text-[10px] tracking-[0.35em] uppercase text-sunset-100/45">
        With love · for Lidiya
      </p>

      {/* Offline overlay — soft, on-brand. Stays until the browser reports
          "online" again, then we auto-reload to recover the live feed. */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            key="offline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-[#1a0905]/85 backdrop-blur-md"
          >
            <div className="glass rounded-3xl px-10 py-8 text-center max-w-md">
              <p className="text-[11px] tracking-[0.35em] uppercase text-sunset-200/70">
                Reconnecting
              </p>
              <p className="mt-3 font-serif italic text-3xl text-sunset-50">
                One moment
              </p>
              <p className="mt-3 text-sunset-100/70 text-sm">
                Lost the network for a second. The wall will be back as soon as it's available.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// --- Ambient layers ---------------------------------------------------------

function BokehLayer() {
  const blobs = useMemo(
    () => [
      { w: 320, color: "rgba(212,165,90,0.18)",  top: "8%",  left: "4%",  d: 0 },
      { w: 220, color: "rgba(248,200,220,0.14)", top: "62%", left: "82%", d: 2 },
      { w: 280, color: "rgba(253,155,99,0.14)",  top: "70%", left: "28%", d: 4 },
      { w: 180, color: "rgba(212,175,55,0.14)",  top: "26%", left: "70%", d: 6 },
      { w: 240, color: "rgba(248,200,220,0.10)", top: "82%", left: "88%", d: 3 },
      { w: 160, color: "rgba(253,155,99,0.14)",  top: "48%", left: "8%",  d: 5 },
    ],
    [],
  );
  return (
    <div className="absolute inset-0 z-[1] pointer-events-none">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.w,
            height: b.w,
            top: b.top,
            left: b.left,
            background: b.color,
            filter: "blur(40px)",
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -20, 15, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: b.d }}
        />
      ))}
    </div>
  );
}

function ParticleLayer() {
  const particles = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      i,
      left: Math.random() * 100,
      size: 2 + Math.random() * 3,
      duration: 18 + Math.random() * 14,
      delay: Math.random() * 12,
      drift: (Math.random() - 0.5) * 80,
    }));
  }, []);
  return (
    <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={p.i}
          className="absolute rounded-full bg-sunset-200/50"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            bottom: -20,
            boxShadow: "0 0 6px rgba(253,186,116,0.6)",
          }}
          initial={{ y: 0, x: 0, opacity: 0 }}
          animate={{
            y: typeof window !== "undefined" ? -window.innerHeight - 40 : -1200,
            x: p.drift,
            opacity: [0, 0.9, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

// --- Scene renderer ---------------------------------------------------------

function SceneRenderer({
  scene,
  focus,
  all,
}: {
  scene: Scene;
  focus: Message;
  all: Message[];
}) {
  switch (scene.type) {
    case "hero":          return <HeroScene message={focus} />;
    case "kenburns":      return <KenBurnsScene message={focus} />;
    case "quote":         return <QuoteScene message={focus} />;
    case "polaroidStack": return <PolaroidStackScene focus={focus} all={all} />;
    case "collagePop":    return <CollagePopScene focus={focus} all={all} />;
    case "mosaic":        return <MosaicScene focus={focus} all={all} />;
    default:              return <HeroScene message={focus} />;
  }
}

// --- Scene: Hero (split layout, calm) ---------------------------------------

function HeroScene({ message }: { message: Message }) {
  return (
    <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-12 gap-0 film-grain">
      <div className="md:col-span-7 relative overflow-hidden">
        {/* Glow-breath aura behind the focal photo */}
        <motion.div
          aria-hidden
          className="absolute -inset-10 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(253,186,116,0.25), transparent 60%)",
            filter: "blur(40px)",
          }}
          animate={{ opacity: [0.4, 0.9, 0.4], scale: [1, 1.08, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {message.mediaType === "video" ? (
          <video
            src={message.imageUrl}
            autoPlay
            muted
            loop
            playsInline
            className="relative w-full h-full object-cover"
          />
        ) : (
          <motion.img
            src={message.imageUrl}
            alt=""
            initial={{ scale: 1.15 }}
            animate={{ scale: 1.0 }}
            transition={{ duration: 8, ease: "linear" }}
            className="relative w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#2a0f0a]/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2a0f0a]/60 via-transparent to-transparent" />
      </div>
      <div className="md:col-span-5 relative flex items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[#3d1e15]/60 to-[#6b2d1a]/40 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, delay: 0.4, ease: "easeOut" }}
          className="relative z-10 max-w-md"
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="h-px w-10 bg-sunset-300/60" />
            <span className="text-[10px] tracking-[0.35em] uppercase text-sunset-200/70">
              A memory
            </span>
          </div>
          <p className="font-serif italic text-3xl lg:text-4xl leading-snug text-sunset-50">
            “{message.note}”
          </p>
          {message.author && (
            <p className="mt-8 font-serif italic text-2xl text-shimmer">
              — {message.author}
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// --- Scene: Ken Burns (full-bleed slow pan/zoom, note overlay) --------------

function KenBurnsScene({ message }: { message: Message }) {
  const dir = useMemo(() => {
    const choices = [
      { from: { scale: 1.0,  x: "-2%", y: "-2%" }, to: { scale: 1.15, x: "2%",  y: "2%"  } },
      { from: { scale: 1.15, x: "2%",  y: "-2%" }, to: { scale: 1.0,  x: "-2%", y: "2%"  } },
      { from: { scale: 1.0,  x: "2%",  y: "2%"  }, to: { scale: 1.18, x: "-2%", y: "-2%" } },
    ];
    return choices[Math.floor(Math.random() * choices.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

  return (
    <div className="absolute inset-0 overflow-hidden film-grain">
      {message.mediaType === "video" ? (
        <video
          src={message.imageUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <motion.img
          src={message.imageUrl}
          alt=""
          initial={dir.from as any}
          animate={dir.to as any}
          transition={{ duration: 9, ease: "linear" }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a0905]/95 via-[#2a0f0a]/30 to-transparent" />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, delay: 0.6, ease: "easeOut" }}
        className="absolute bottom-24 left-0 right-0 px-16 text-center max-w-5xl mx-auto"
      >
        <p className="font-serif italic text-4xl lg:text-5xl leading-snug text-sunset-50 drop-shadow-lg">
          “{message.note}”
        </p>
        {message.author && (
          <p className="mt-6 font-serif italic text-3xl text-shimmer">
            — {message.author}
          </p>
        )}
      </motion.div>
    </div>
  );
}

// --- Scene: Quote (long-note showcase, side-by-side calm) -------------------

function QuoteScene({ message }: { message: Message }) {
  return (
    <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 film-grain">
      <div className="relative overflow-hidden">
        {message.mediaType === "video" ? (
          <video
            src={message.imageUrl}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <motion.img
            src={message.imageUrl}
            alt=""
            initial={{ scale: 1.08 }}
            animate={{ scale: 1.0 }}
            transition={{ duration: 10, ease: "linear" }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#1a0905]/40" />
      </div>
      <div className="relative flex items-center px-16 py-12">
        <div className="absolute inset-0 bg-gradient-to-l from-[#1a0905]/95 to-[#2a0f0a]/70" />
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.4, delay: 0.4, ease: "easeOut" }}
          className="relative z-10 max-w-xl"
        >
          <div className="font-serif text-[7rem] leading-none text-sunset-300/30 -mb-6 select-none">
            “
          </div>
          <p className="font-serif italic text-2xl lg:text-[1.85rem] leading-relaxed text-sunset-50">
            {message.note}
          </p>
          <div className="mt-8 flex items-center gap-4">
            <span className="h-px w-12 bg-sunset-300/60" />
            <p className="font-serif italic text-2xl text-shimmer">
              {message.author || "a friend"}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// --- Scene: Polaroid stack --------------------------------------------------

function PolaroidStackScene({ focus, all }: { focus: Message; all: Message[] }) {
  const extras = useMemo(() => sample(imagesOnly(all), 4, focus.id), [focus.id, all]);
  const layout = useMemo(
    () =>
      extras.map((_, i) => ({
        rot: (Math.random() - 0.5) * 18,
        // Offsets expressed in vmin so the stack always fits the viewport,
        // regardless of the TV's aspect ratio or window size.
        x: (Math.random() - 0.5) * 32, // vmin
        y: (Math.random() - 0.5) * 14, // vmin
        delay: 0.1 + i * 0.15,
      })),
    [extras],
  );

  // Photo sizes scale with the smaller viewport axis so the layout never
  // overflows in fullscreen on any resolution.
  const extraSize = "min(28vmin, 280px)";
  const focusW = "min(40vmin, 460px)";
  const focusH = "min(50vmin, 560px)";

  return (
    <div className="absolute inset-0 flex items-center justify-center film-grain">
      <div className="absolute inset-0 flex items-center justify-center">
        {extras.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, scale: 0.6, rotate: layout[i].rot * 2, x: `${layout[i].x}vmin`, y: "-40vmin" }}
            animate={{ opacity: 1, scale: 1, rotate: layout[i].rot, x: `${layout[i].x}vmin`, y: `${layout[i].y}vmin` }}
            transition={{ duration: 0.9, delay: layout[i].delay, ease: [0.22, 1, 0.36, 1] }}
            className="polaroid absolute"
            style={{ width: extraSize, height: `calc(${extraSize} * 1.23)` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.imageUrl} alt="" />
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.4, rotate: -10, y: "-30vmin" }}
        animate={{ opacity: 1, scale: 1, rotate: -2, y: 0 }}
        transition={{ duration: 1.0, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="polaroid relative z-10"
        style={{ width: focusW, height: focusH, marginLeft: "-4vmin" }}
      >
        <MediaTile message={focus} className="w-full h-full" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.2, delay: 1.4, ease: "easeOut" }}
        className="relative z-10 ml-8 lg:ml-12 max-w-md"
      >
        <span className="text-[10px] tracking-[0.35em] uppercase text-sunset-200/70">
          A memory
        </span>
        <p className="mt-4 font-serif italic text-3xl leading-snug text-sunset-50">
          “{focus.note}”
        </p>
        {focus.author && (
          <p className="mt-6 font-serif italic text-3xl text-shimmer">
            — {focus.author}
          </p>
        )}
      </motion.div>
    </div>
  );
}

// --- Scene: Collage pop -----------------------------------------------------

function CollagePopScene({ focus, all }: { focus: Message; all: Message[] }) {
  const wanted = Math.min(9, Math.max(0, all.length - 1));
  const extras = useMemo(() => sample(imagesOnly(all), wanted, focus.id), [focus.id, all, wanted]);

  const positions = useMemo(() => {
    return extras.map(() => {
      const side = Math.floor(Math.random() * 4);
      let top: string, left: string;
      if (side === 0)      { left = `${5 + Math.random() * 18}%`;  top = `${10 + Math.random() * 75}%`; }
      else if (side === 1) { left = `${72 + Math.random() * 22}%`; top = `${10 + Math.random() * 75}%`; }
      else if (side === 2) { left = `${10 + Math.random() * 80}%`; top = `${5 + Math.random() * 15}%`; }
      else                 { left = `${10 + Math.random() * 80}%`; top = `${75 + Math.random() * 18}%`; }
      return {
        top, left,
        rot: (Math.random() - 0.5) * 30,
        size: 140 + Math.random() * 120,
        delay: Math.random() * 0.9,
      };
    });
  }, [extras]);

  return (
    <div className="absolute inset-0 film-grain">
      {extras.map((m, i) => (
        <motion.div
          key={m.id}
          initial={{ opacity: 0, scale: 0.2, rotate: positions[i].rot * 2 }}
          animate={{ opacity: 1, scale: 1, rotate: positions[i].rot, y: [0, -6, 0] }}
          transition={{
            opacity: { duration: 0.6, delay: positions[i].delay },
            scale:   { duration: 0.8, delay: positions[i].delay, ease: [0.22, 1.4, 0.36, 1] },
            rotate:  { duration: 0.8, delay: positions[i].delay },
            y:       { duration: 4, repeat: Infinity, ease: "easeInOut", delay: positions[i].delay + 1 },
          }}
          className="polaroid absolute"
          style={{
            top: positions[i].top,
            left: positions[i].left,
            width: positions[i].size,
            height: positions[i].size * 1.2,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.imageUrl} alt="" />
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.0, delay: 1.0, ease: [0.22, 1.2, 0.36, 1] }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
        style={{ width: "min(46vw, 540px)" }}
      >
        <div className="warm-glow rounded-2xl overflow-hidden bg-black/40">
          <MediaTile
            message={focus}
            className="w-full aspect-[4/5]"
          />
          <div className="p-6 bg-gradient-to-b from-[#2a0f0a]/80 to-[#1a0905]/95">
            <p className="font-serif italic text-xl leading-snug text-sunset-50">
              “{focus.note}”
            </p>
            {focus.author && (
              <p className="mt-3 font-serif italic text-2xl text-shimmer">
                — {focus.author}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- Scene: Mosaic ----------------------------------------------------------

function MosaicScene({ focus, all }: { focus: Message; all: Message[] }) {
  const tiles = useMemo(() => {
    const others = sample(imagesOnly(all), 8, focus.id);
    const arr: Message[] = [];
    for (let i = 0; i < 9; i++) {
      if (i === 4) arr.push(focus);
      else if (others.length > 0) arr.push(others[i % others.length]);
      else arr.push(focus);
    }
    return arr;
  }, [focus.id, all]);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-12 film-grain">
      <div className="relative w-full h-full grid grid-cols-3 grid-rows-3 gap-3 max-w-[1400px] max-h-[900px]">
        {tiles.map((m, i) => {
          const isFocus = i === 4;
          return (
            <motion.div
              key={`${i}-${m.id}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: isFocus ? 1 : 0.55, scale: 1 }}
              transition={{
                duration: 0.7,
                delay: isFocus ? 0.8 : 0.05 * i,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`relative overflow-hidden rounded-xl ${
                isFocus ? "ring-4 ring-sunset-300/60 warm-glow z-10" : ""
              }`}
            >
              <MediaTile message={m} className="w-full h-full" />
              {!isFocus && (
                <div className="absolute inset-0 bg-gradient-to-br from-[#2a0f0a]/40 to-[#6b2d1a]/30" />
              )}
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.0, delay: 1.4, ease: "easeOut" }}
        className="absolute left-1/2 bottom-20 -translate-x-1/2 z-30 glass rounded-2xl px-8 py-5 max-w-3xl text-center"
      >
        <p className="font-serif italic text-2xl leading-snug text-sunset-50">
          “{focus.note}”
        </p>
        {focus.author && (
          <p className="mt-2 font-serif italic text-2xl text-shimmer">
            — {focus.author}
          </p>
        )}
      </motion.div>
    </div>
  );
}

// --- Idle state -------------------------------------------------------------

function IdleState({ lineIndex }: { lineIndex: number }) {
  return (
    <div className="absolute inset-0 z-20 overflow-hidden">
      <motion.div
        initial={{ scale: 1.0 }}
        animate={{ scale: 1.12 }}
        transition={{ duration: 22, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
        className="absolute inset-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/lidiya-group.jpeg"
          alt="Lidiya and friends"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-b from-[#1a0905]/55 via-[#2a0f0a]/30 to-[#1a0905]/90" />
      <div className="absolute inset-0 bg-gradient-to-tr from-[#6b2d1a]/40 via-transparent to-[#c2410c]/30" />
      <div className="absolute inset-0 film-grain" />

      <motion.div
        initial={{ opacity: 0, y: -30, rotate: 6 }}
        animate={{ opacity: 1, y: 0, rotate: 4 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="absolute top-10 right-12 z-30 hidden md:block"
      >
        <motion.div
          animate={{ rotate: [4, 6, 4] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="polaroid"
          style={{ width: 220, height: 270 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lidiya-selfie.jpeg" alt="" />
        </motion.div>
      </motion.div>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 z-20">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2.4, ease: "easeOut" }}
        >
          <p className="text-[11px] md:text-sm tracking-[0.45em] uppercase text-sunset-200/80 mb-6">
            A farewell celebration
          </p>
          <h1
            className="font-serif italic leading-none font-medium text-shimmer drop-shadow-2xl"
            style={{ fontSize: "clamp(5rem, 18vmin, 14rem)" }}
          >
            Lidiya
          </h1>
        </motion.div>

        <div className="mt-12 md:mt-16 h-20 flex items-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={lineIndex}
              initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -18, filter: "blur(6px)" }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
              className="font-serif italic text-2xl md:text-4xl text-sunset-50 max-w-3xl drop-shadow-lg"
            >
              {IDLE_LINES[lineIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
