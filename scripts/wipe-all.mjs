/**
 * Nuke everything: every Firestore message + every photo in Storage under uploads/.
 *
 *   node scripts/wipe-all.mjs           # asks for confirmation
 *   node scripts/wipe-all.mjs --force   # skips confirmation
 *
 * Leaves the app, buckets, indexes, and rules intact — just empties the data.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// --- env loader --------------------------------------------------------------
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
const bucketName = process.env.FIREBASE_STORAGE_BUCKET;

if (!projectId || !clientEmail || !privateKey || !bucketName) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY / FIREBASE_STORAGE_BUCKET");
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket: bucketName,
  });
}

const db = getFirestore();
const bucket = getStorage().bucket();
const COLLECTION = "messages";

// --- confirm -----------------------------------------------------------------
const force = process.argv.includes("--force");
if (!force) {
  const rl = createInterface({ input, output });
  const ans = await rl.question(
    `\nThis will DELETE every document in "${COLLECTION}" and every file under "uploads/" in bucket ${bucketName}.\nType  WIPE  to continue: `,
  );
  rl.close();
  if (ans.trim() !== "WIPE") {
    console.log("Aborted.");
    process.exit(0);
  }
}

// --- wipe Firestore ----------------------------------------------------------
console.log(`\n→ Reading Firestore /${COLLECTION} …`);
const snap = await db.collection(COLLECTION).get();
console.log(`  found ${snap.size} document(s).`);

let removedDocs = 0;
const docs = snap.docs;
for (let i = 0; i < docs.length; i += 400) {
  const batch = db.batch();
  docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
  await batch.commit();
  removedDocs += Math.min(400, docs.length - i);
}
console.log(`  deleted ${removedDocs} document(s).`);

// --- wipe Storage uploads/ ---------------------------------------------------
console.log(`\n→ Reading bucket ${bucketName}: uploads/ …`);
const [files] = await bucket.getFiles({ prefix: "uploads/" });
console.log(`  found ${files.length} file(s).`);

let removedFiles = 0;
for (const f of files) {
  try {
    await f.delete();
    removedFiles++;
  } catch (e) {
    console.warn(`  failed to delete ${f.name}:`, e?.message);
  }
}
console.log(`  deleted ${removedFiles} file(s).`);

console.log(`\n✓ Done. Wall is empty — ready for the event.\n`);
process.exit(0);
