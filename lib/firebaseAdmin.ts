import {
  initializeApp,
  getApps,
  getApp,
  cert,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

/**
 * Server-only Firebase Admin SDK initializer.
 *
 * Reads credentials from env vars (works locally via .env.local and on Vercel):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY      (literal "\n" sequences are un-escaped)
 *   FIREBASE_STORAGE_BUCKET
 *
 * NEVER import this from a client component — it would leak the private key.
 */

let app: App | null = null;

function ensureApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApp();
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      "Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local."
    );
  }

  // Vercel / dotenv stores the key with literal "\n" — turn them back into real newlines.
  const privateKey = rawKey.replace(/\\n/g, "\n");

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  });
  return app;
}

export function getAdminDb(): Firestore {
  return getFirestore(ensureApp());
}

export function getAdminStorage(): Storage {
  return getStorage(ensureApp());
}
