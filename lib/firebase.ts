import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

function ensure() {
  if (!firebaseConfig.apiKey) {
    throw new Error(
      "Firebase config missing. Copy .env.local.example to .env.local and fill in your project keys."
    );
  }
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig as any);
    db = getFirestore(app);
    storage = getStorage(app);
  }
  return { app: app!, db: db!, storage: storage! };
}

export function getDb() { return ensure().db; }
export function getStorageRef() { return ensure().storage; }
export function isFirebaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
}

export const COLLECTION = "messages";
