// One-shot patch: replace "Lydia" -> "Lidiya" in existing Firestore notes/authors.
// Safe to re-run. Only touches docs whose fields contain "Lydia".
//   node scripts/fix-lidiya-spelling.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

// Case-insensitive replace, preserving capitalisation of the original.
function fix(text) {
  if (!text) return text;
  return text.replace(/Lydia/g, "Lidiya").replace(/lydia/g, "lidiya");
}

const snap = await db.collection(COLLECTION).get();
let updated = 0;
for (const doc of snap.docs) {
  const data = doc.data();
  const update = {};
  if (typeof data.note === "string" && /lydia/i.test(data.note)) {
    update.note = fix(data.note);
  }
  if (typeof data.author === "string" && /lydia/i.test(data.author)) {
    update.author = fix(data.author);
  }
  if (Object.keys(update).length > 0) {
    await doc.ref.update(update);
    console.log(`  patched ${doc.id}:`, update);
    updated++;
  }
}
console.log(`\nDone. Updated ${updated} / ${snap.size} docs.`);
process.exit(0);
