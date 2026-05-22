/**
 * Seed sample messages into Firestore so we can preview the /display slideshow.
 *
 * Usage:
 *   node scripts/seed.mjs           # add 8 sample messages
 *   node scripts/seed.mjs --clear   # delete every existing message first, then seed
 *   node scripts/seed.mjs --wipe    # delete every existing message and exit (no seed)
 *
 * Requires the same FIREBASE_* env vars used by lib/firebaseAdmin.ts.
 * Run from the project root so .env.local is picked up.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// --- tiny .env.local loader (no dotenv dep needed) ---------------------------
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

// --- admin init ---------------------------------------------------------------
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY");
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();
const COLLECTION = "messages";

// --- sample data --------------------------------------------------------------
// Using picsum.photos for stable, royalty-free placeholder portraits/landscapes.
const samples = [
  {
    imageUrl: "https://picsum.photos/seed/lydia-1/1200/1500",
    note: "Lidiya, you brought so much light into our days — fly home with all our love. 💛",
    author: "Amara",
  },
  {
    imageUrl: "https://picsum.photos/seed/lydia-2/1200/1500",
    note: "Distance can't dim what we built together. Forever grateful for you.",
    author: "Tomás",
  },
  {
    imageUrl: "https://picsum.photos/seed/lydia-3/1200/1500",
    note: "Wherever you go, a little piece of us travels with you. Safe journey, dear friend.",
    author: "Priya & Sam",
  },
  {
    imageUrl: "https://picsum.photos/seed/lydia-4/1200/1500",
    note: "Thank you for the laughter, the warmth, and every unforgettable moment.",
    author: null,
  },
  {
    imageUrl: "https://picsum.photos/seed/lydia-5/1200/1500",
    note: "Not a goodbye — just a 'see you soon' in a new chapter.",
    author: "Marco",
  },
  {
    imageUrl: "https://picsum.photos/seed/lydia-6/1200/1500",
    note: "You made this place feel like home. We'll miss you more than words can say.",
    author: "the Tuesday crew",
  },
  {
    imageUrl: "https://picsum.photos/seed/lydia-7/1200/1500",
    note: "Keep shining, Lidiya. The world is luckier with you in it. ✨",
    author: "Noor",
  },
  {
    imageUrl: "https://picsum.photos/seed/lydia-8/1200/1500",
    note: "Cheers to memories made, and to all the beautiful ones still to come.",
    author: "Elena",
  },
];

// --- main ---------------------------------------------------------------------
async function wipe() {
  const snap = await db.collection(COLLECTION).get();
  if (snap.empty) {
    console.log("Nothing to delete.");
    return 0;
  }
  // Batch in chunks of 400 (Firestore limit is 500).
  const docs = snap.docs;
  let removed = 0;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
    removed += Math.min(400, docs.length - i);
  }
  console.log(`Deleted ${removed} existing message(s).`);
  return removed;
}

async function seed() {
  const now = Date.now();
  const batch = db.batch();
  samples.forEach((s, i) => {
    const ref = db.collection(COLLECTION).doc();
    batch.set(ref, {
      ...s,
      storagePath: null, // these don't live in Storage — they're remote URLs
      createdAt: FieldValue.serverTimestamp(),
      // small offset so ordering is deterministic
      _seedIndex: i,
      _seededAt: now,
    });
  });
  await batch.commit();
  console.log(`Seeded ${samples.length} message(s) into "${COLLECTION}".`);
}

const args = new Set(process.argv.slice(2));
try {
  if (args.has("--wipe")) {
    await wipe();
  } else if (args.has("--clear")) {
    await wipe();
    await seed();
  } else {
    await seed();
  }
  process.exit(0);
} catch (e) {
  console.error("Seed failed:", e?.message || e);
  process.exit(1);
}
