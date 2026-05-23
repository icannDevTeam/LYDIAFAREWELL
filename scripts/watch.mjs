/**
 * Live event watcher — prints incoming photos + endpoint health to your terminal.
 *
 * Usage:
 *   node scripts/watch.mjs                   # watch prod (uses NEXT_PUBLIC_SITE_URL)
 *   node scripts/watch.mjs --base=http://localhost:3000
 *   node scripts/watch.mjs --no-health       # skip endpoint pinging
 *   node scripts/watch.mjs --health-every=30 # ping interval in seconds (default 60)
 *
 * Reads .env.local for Firebase Admin credentials (same vars as seed.mjs).
 * Does NOT modify any data. Safe to run alongside the live event.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// --- .env.local loader (mirrors seed.mjs) -----------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env.local");
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
} catch (e) {
  console.error(`Could not read ${envPath}:`, e.message);
  process.exit(1);
}

// --- args -------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const BASE = (args.base || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const HEALTH = args["no-health"] !== "true";
const HEALTH_EVERY = Math.max(10, parseInt(args["health-every"] || "60", 10)) * 1000;

// --- admin init -------------------------------------------------------------
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local");
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();
const COLLECTION = "messages";

// --- ANSI helpers (no extra deps) -------------------------------------------
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};
const stamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const line = (color, label, msg) =>
  `${c.gray}${stamp()}${c.reset} ${color}${label.padEnd(7)}${c.reset} ${msg}`;
const log = {
  info:  (m) => console.log(line(c.cyan,   "info",  m)),
  ok:    (m) => console.log(line(c.green,  "ok",    m)),
  warn:  (m) => console.log(line(c.yellow, "warn",  m)),
  err:   (m) => console.log(line(c.red,    "error", m)),
  photo: (m) => console.log(line(c.magenta,"photo", m)),
  hide:  (m) => console.log(line(c.yellow, "hide",  m)),
  del:   (m) => console.log(line(c.red,    "delete",m)),
  edit:  (m) => console.log(line(c.blue,   "edit",  m)),
};

// --- banner -----------------------------------------------------------------
console.log("");
console.log(`${c.bold}Lidiya farewell — live watcher${c.reset}`);
console.log(`${c.dim}project:${c.reset} ${projectId}`);
console.log(`${c.dim}base url:${c.reset} ${BASE || "(none — pass --base=… to enable health checks)"}`);
console.log(`${c.dim}health:${c.reset} ${HEALTH && BASE ? `every ${HEALTH_EVERY / 1000}s` : "disabled"}`);
console.log("");

// --- Firestore subscription -------------------------------------------------
// We mark the initial snapshot as "seed" (no toast) so reconnecting the
// watcher mid-event doesn't spam old posts. Subsequent docChanges() are real.
let seeded = false;
const seen = new Map(); // id -> hash of (note|author|hidden) for edit detection

function fmtNote(note) {
  const flat = (note || "").replace(/\s+/g, " ").trim();
  return flat.length > 80 ? flat.slice(0, 77) + "…" : flat;
}

const q = db.collection(COLLECTION).orderBy("createdAt", "asc");
const unsub = q.onSnapshot(
  (snap) => {
    if (!seeded) {
      seeded = true;
      snap.docs.forEach((d) => {
        const data = d.data();
        seen.set(d.id, hashDoc(data));
      });
      log.ok(`subscribed · ${snap.size} existing message${snap.size === 1 ? "" : "s"}`);
      return;
    }
    snap.docChanges().forEach((ch) => {
      const data = ch.doc.data();
      const author = data.author ? `${c.bold}${data.author}${c.reset}` : `${c.dim}anonymous${c.reset}`;
      const id = ch.doc.id.slice(0, 6);
      const ts = data.createdAt?.toDate?.() || new Date();
      const ago = `${c.dim}${ts.toLocaleTimeString()}${c.reset}`;
      if (ch.type === "added") {
        log.photo(`${author} · "${fmtNote(data.note)}" ${ago} ${c.dim}#${id}${c.reset}`);
        if (data.imageUrl) console.log(`        ${c.dim}↳ ${data.imageUrl}${c.reset}`);
        seen.set(ch.doc.id, hashDoc(data));
      } else if (ch.type === "modified") {
        const prev = seen.get(ch.doc.id);
        const next = hashDoc(data);
        if (data.hidden === true && (!prev || !prev.includes("|h"))) {
          log.hide(`${author} ${c.dim}#${id}${c.reset} hidden from TV`);
        } else if (data.hidden !== true && prev && prev.includes("|h")) {
          log.ok(`${author} ${c.dim}#${id}${c.reset} un-hidden`);
        } else {
          log.edit(`${author} ${c.dim}#${id}${c.reset} updated`);
        }
        seen.set(ch.doc.id, next);
      } else if (ch.type === "removed") {
        log.del(`${author} ${c.dim}#${id}${c.reset} deleted`);
        seen.delete(ch.doc.id);
      }
    });
  },
  (err) => log.err(`firestore: ${err.message}`),
);

// --- endpoint health --------------------------------------------------------
async function ping(path) {
  const url = `${BASE}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual" });
    const ms = Date.now() - started;
    const status = res.status;
    const ok = status >= 200 && status < 400;
    return { ok, status, ms };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - started, error: e.message };
  }
}

async function healthRun() {
  if (!BASE) return;
  const paths = ["/", "/display", "/upload", "/qr"];
  const results = await Promise.all(paths.map((p) => ping(p)));
  const parts = results.map((r, i) => {
    const tag = r.ok ? `${c.green}${r.status}${c.reset}` : `${c.red}${r.status || "ERR"}${c.reset}`;
    return `${paths[i]} ${tag} ${c.dim}${r.ms}ms${c.reset}`;
  });
  const allOk = results.every((r) => r.ok);
  (allOk ? log.ok : log.warn)(`health · ${parts.join("   ")}`);
}

let healthTimer = null;
if (HEALTH && BASE) {
  healthRun();
  healthTimer = setInterval(healthRun, HEALTH_EVERY);
}

// --- utils ------------------------------------------------------------------
function hashDoc(d) {
  return `${d.note || ""}|a:${d.author || ""}|${d.hidden ? "h" : ""}`;
}

// --- graceful shutdown ------------------------------------------------------
function shutdown() {
  log.info("shutting down…");
  if (healthTimer) clearInterval(healthTimer);
  try { unsub(); } catch {}
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
