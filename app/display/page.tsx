"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { getDb, COLLECTION, isFirebaseConfigured } from "@/lib/firebase";
import type { Message } from "@/lib/types";

// --- Scene system -----------------------------------------------------------
// Each scene picks a layout / animation style. We rotate through them so the
// display feels alive rather than repetitive. Scenes with higher minMessages
// are skipped when there aren't enough memories yet.

type SceneType = "hero" | "kenburns" | "polaroidStack" | "collagePop" | "mosaic";

type Scene = {
  type: SceneType;
  minMessages: number;
  durationMs: number;
  weight: number;
};

const SCENES: Scene[] = [
  { type: "hero",          minMessages: 1, durationMs: 8000,  weight: 3 },
  { type: "kenburns",      minMessages: 1, durationMs: 9000,  weight: 2 },
  { type: "polaroidStack", minMessages: 3, durationMs: 10000, weight: 2 },
  { type: "collagePop",    minMessages: 5, durationMs: 11000, weight: 2 },
  { type: "mosaic",        minMessages: 6, durationMs: 10000, weight: 1 },
];

const IDLE_LINES = [
  "Some friendships cross oceans…",
  "…and never lose their warmth.",
  "Tonight, we celebrate Lydia.",
  "Share a photo. Share a memory.",
  "Scan the QR code to begin.",
];

function pickScene(prev: SceneType | null, available: number): Scene {
  const candidates = SCENES.filter(
    (s) => s.minMessages <= available && s.type !== prev
  );
  const pool = candidates.length
    ? candidates
    : SCENES.filter((s) => s.minMessages <= available);
  const total = pool.reduce((a, s) => a + s.weight, 0);
  let r = Math.random() * total;
  for (const s of pool) {
    r -= s.weight;
    if (r <= 0) return s;
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

// --- Page -------------------------------------------------------------------

export default function DisplayPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [focusIdx, setFocusIdx] = useState(0);
  const [scene, setScene] = useState<Scene>(SCENES[0]);
  const [idleLine, setIdleLine] = useState(0);
  const [configError, setConfigError] = useState<string | null>(null);
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
          const list: Message[] = snap.docs.map((d) => {
            const data = d.data() as any;
            const ts: Timestamp | undefined = data.createdAt;
            return {
              id: d.id,
              imageUrl: data.imageUrl,
              note: data.note || "",
              author: data.author || undefined,
              createdAt: ts?.toMillis?.() ?? Date.now(),
            };
          });
          setMessages(list);
        },
        (err) => {
          console.error(err);
          setConfigError(err.message);
        }
      );
      return () => unsub();
    } catch (e: any) {
      setConfigError(e?.message || "Failed to connect to Firebase.");
    }
  }, []);

  // Scene scheduler: pick a scene each tick, advance focus when timer expires.
  useEffect(() => {
    if (messages.length === 0) return;
    const next = pickScene(prevSceneType.current, messages.length);
    prevSceneType.current = next.type;
    setScene(next);

    const t = setTimeout(() => {
      setFocusIdx((i) => (i + 1) % messages.length);
      setSceneIdx((i) => i + 1);
    }, next.durationMs);
    return () => clearTimeout(t);
  }, [sceneIdx, messages.length]);

  // When a brand-new message arrives, jump to it immediately
  const prevCount = useRef(0);
  useEffect(() => {
    if (messages.length > prevCount.current && prevCount.current > 0) {
      setFocusIdx(messages.length - 1);
      setSceneIdx((i) => i + 1);
    }
    prevCount.current = messages.length;
  }, [messages.length]);

  // Idle line rotation
  useEffect(() => {
    if (messages.length > 0) return;
    const t = setInterval(() => setIdleLine((i) => (i + 1) % IDLE_LINES.length), 4500);
    return () => clearInterval(t);
  }, [messages.length]);

  const focus = messages[focusIdx];

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Warm gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2a0f0a] via-[#6b2d1a] to-[#c2410c]" />
      <div className="absolute inset-0 particles" />

      {/* Header */}
      <div className="absolute top-6 left-8 z-30 flex items-baseline gap-3">
        <span className="font-script text-2xl text-sunset-200/80">farewell,</span>
        <span className="font-serif text-3xl text-shimmer">Lydia</span>
      </div>
      {messages.length > 0 && (
        <div className="absolute top-6 right-8 z-30 text-sunset-100/60 text-sm font-medium tracking-wide">
          {focusIdx + 1} / {messages.length} · {messages.length} memories shared
        </div>
      )}

      {/* Idle state */}
      {messages.length === 0 && !configError && <IdleState lineIndex={idleLine} />}

      {/* Config error */}
      {configError && (
        <div className="absolute inset-0 flex items-center justify-center z-40">
          <div className="glass rounded-3xl p-10 max-w-xl text-center">
            <div className="text-4xl mb-3">⚙️</div>
            <h2 className="font-serif text-2xl mb-2">Setup needed</h2>
            <p className="text-sunset-100/80 text-sm">{configError}</p>
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

      {/* Footer ribbon */}
      {messages.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 glass px-6 py-2 rounded-full text-sunset-100/85 text-sm">
          scan the QR to add yours 💛
        </div>
      )}
    </main>
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
    case "hero":
      return <HeroScene message={focus} />;
    case "kenburns":
      return <KenBurnsScene message={focus} />;
    case "polaroidStack":
      return <PolaroidStackScene focus={focus} all={all} />;
    case "collagePop":
      return <CollagePopScene focus={focus} all={all} />;
    case "mosaic":
      return <MosaicScene focus={focus} all={all} />;
    default:
      return <HeroScene message={focus} />;
  }
}

// --- Scene: Hero (split layout, calm) ---------------------------------------

function HeroScene({ message }: { message: Message }) {
  return (
    <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-12 gap-0 film-grain">
      <div className="md:col-span-7 relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          src={message.imageUrl}
          alt=""
          initial={{ scale: 1.15 }}
          animate={{ scale: 1.0 }}
          transition={{ duration: 8, ease: "linear" }}
          className="w-full h-full object-cover"
        />
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
          <div className="font-script text-4xl text-sunset-200/80 mb-4">“</div>
          <p className="font-serif text-3xl lg:text-4xl leading-snug text-sunset-50">
            {message.note}
          </p>
          {message.author && (
            <p className="mt-8 font-script text-3xl text-shimmer">— {message.author}</p>
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        src={message.imageUrl}
        alt=""
        initial={dir.from as any}
        animate={dir.to as any}
        transition={{ duration: 9, ease: "linear" }}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a0905]/95 via-[#2a0f0a]/30 to-transparent" />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, delay: 0.6, ease: "easeOut" }}
        className="absolute bottom-24 left-0 right-0 px-16 text-center max-w-5xl mx-auto"
      >
        <p className="font-serif text-4xl lg:text-5xl leading-snug text-sunset-50 drop-shadow-lg">
          “{message.note}”
        </p>
        {message.author && (
          <p className="mt-6 font-script text-3xl text-shimmer">— {message.author}</p>
        )}
      </motion.div>
    </div>
  );
}

// --- Scene: Polaroid stack --------------------------------------------------

function PolaroidStackScene({ focus, all }: { focus: Message; all: Message[] }) {
  const extras = useMemo(() => sample(all, 4, focus.id), [focus.id, all]);
  const layout = useMemo(
    () =>
      extras.map((_, i) => ({
        rot: (Math.random() - 0.5) * 18,
        x: (Math.random() - 0.5) * 300,
        y: (Math.random() - 0.5) * 120,
        delay: 0.1 + i * 0.15,
      })),
    [extras]
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center film-grain">
      {/* Background polaroids dropping in */}
      <div className="absolute inset-0 flex items-center justify-center">
        {extras.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, scale: 0.6, rotate: layout[i].rot * 2, x: layout[i].x, y: -400 }}
            animate={{ opacity: 1, scale: 1, rotate: layout[i].rot, x: layout[i].x, y: layout[i].y }}
            transition={{ duration: 0.9, delay: layout[i].delay, ease: [0.22, 1, 0.36, 1] }}
            className="polaroid absolute"
            style={{ width: 260, height: 320 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.imageUrl} alt="" />
          </motion.div>
        ))}
      </div>

      {/* Focus polaroid lands left of centre */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4, rotate: -10, y: -300 }}
        animate={{ opacity: 1, scale: 1, rotate: -2, y: 0 }}
        transition={{ duration: 1.0, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="polaroid relative z-10 -ml-32"
        style={{ width: 420, height: 520 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={focus.imageUrl} alt="" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.2, delay: 1.4, ease: "easeOut" }}
        className="relative z-10 ml-16 max-w-md"
      >
        <div className="font-script text-4xl text-sunset-200/80 mb-3">“</div>
        <p className="font-serif text-3xl leading-snug text-sunset-50">{focus.note}</p>
        {focus.author && (
          <p className="mt-6 font-script text-3xl text-shimmer">— {focus.author}</p>
        )}
      </motion.div>
    </div>
  );
}

// --- Scene: Collage pop -----------------------------------------------------

function CollagePopScene({ focus, all }: { focus: Message; all: Message[] }) {
  const wanted = Math.min(9, Math.max(0, all.length - 1));
  const extras = useMemo(() => sample(all, wanted, focus.id), [focus.id, all, wanted]);

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

      {/* Focus card centered, glowing */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.0, delay: 1.0, ease: [0.22, 1.2, 0.36, 1] }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
        style={{ width: "min(46vw, 540px)" }}
      >
        <div className="warm-glow rounded-2xl overflow-hidden bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={focus.imageUrl} alt="" className="w-full aspect-[4/5] object-cover" />
          <div className="p-6 bg-gradient-to-b from-[#2a0f0a]/80 to-[#1a0905]/95">
            <p className="font-serif text-xl leading-snug text-sunset-50">“{focus.note}”</p>
            {focus.author && (
              <p className="mt-3 font-script text-2xl text-shimmer">— {focus.author}</p>
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
    const others = sample(all, 8, focus.id);
    const arr: Message[] = [];
    for (let i = 0; i < 9; i++) {
      if (i === 4) arr.push(focus);
      else arr.push(others[i % Math.max(1, others.length)]);
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.imageUrl} alt="" className="w-full h-full object-cover" />
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
        <p className="font-serif text-2xl leading-snug text-sunset-50">“{focus.note}”</p>
        {focus.author && (
          <p className="mt-2 font-script text-2xl text-shimmer">— {focus.author}</p>
        )}
      </motion.div>
    </div>
  );
}

// --- Idle state -------------------------------------------------------------

function IdleState({ lineIndex }: { lineIndex: number }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-8">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 2 }}
      >
        <p className="font-script text-5xl text-sunset-200 mb-4 animate-float">
          a warm goodbye for
        </p>
        <h1 className="font-serif text-[10rem] leading-none font-semibold text-shimmer">
          Lydia
        </h1>
      </motion.div>

      <div className="mt-16 h-16">
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIndex}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 1.2 }}
            className="font-serif text-3xl text-sunset-100/90 italic"
          >
            {IDLE_LINES[lineIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-12 glass rounded-full px-6 py-3 text-sunset-100/85 text-sm tracking-wider">
        waiting for the first memory…
      </div>
    </div>
  );
}
