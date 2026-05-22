"use client";

import { useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getDb, getStorageRef, COLLECTION, isFirebaseConfigured } from "@/lib/firebase";
import { SUGGESTED_WORDS } from "@/lib/types";

type Status = "idle" | "uploading" | "success" | "error";

export default function UploadPage() {
  const libraryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  function onPick(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please pick an image.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Image must be under 10 MB.");
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function pickSuggestion() {
    const w = SUGGESTED_WORDS[Math.floor(Math.random() * SUGGESTED_WORDS.length)];
    setNote(w);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please add a photo first."); return; }
    if (!note.trim()) { setError("Please write a short note for Lydia."); return; }
    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured yet. Ask the host to set up .env.local.");
      return;
    }

    setStatus("uploading");
    setError(null);
    try {
      const storage = getStorageRef();
      const db = getDb();
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const path = `uploads/${filename}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file, { contentType: file.type });
      const imageUrl = await getDownloadURL(ref);

      await addDoc(collection(db, COLLECTION), {
        imageUrl,
        note: note.trim(),
        author: author.trim() || null,
        storagePath: path,
        createdAt: serverTimestamp(),
      });

      setStatus("success");
      setFile(null);
      setPreview(null);
      setNote("");
      setAuthor("");
      if (libraryInput.current) libraryInput.current.value = "";
      if (cameraInput.current) cameraInput.current.value = "";
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 max-w-xl mx-auto">
      <header className="text-center mb-8">
        <p className="font-script text-2xl text-sunset-200">A farewell for</p>
        <h1 className="font-serif text-5xl text-shimmer">Lydia</h1>
        <p className="mt-3 text-sunset-100/80 text-sm">
          Share a photo and a little message — it will appear on the big screen 💛
        </p>
      </header>

      {status === "success" ? (
        <div className="glass rounded-3xl p-8 text-center">
          <div className="text-5xl mb-3">✨</div>
          <h2 className="font-serif text-2xl mb-2">Thank you!</h2>
          <p className="text-sunset-100/90 mb-6">
            Your message is on its way to the screen.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="px-5 py-3 rounded-full bg-sunset-500 hover:bg-sunset-600 text-white font-medium transition"
          >
            Share another
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="glass rounded-3xl p-6 space-y-5">
          {/* Photo */}
          <div>
            <label className="block text-sm font-medium mb-2 text-sunset-100">
              Photo
            </label>
            <div
              className="relative rounded-2xl overflow-hidden bg-black/30 border border-white/10 aspect-[4/5] flex items-center justify-center cursor-pointer"
              onClick={() => libraryInput.current?.click()}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center px-6">
                  <div className="text-4xl mb-2">📸</div>
                  <p className="text-sunset-100/90">Tap to pick a photo</p>
                  <p className="text-xs text-sunset-100/60 mt-1">Selfies welcome!</p>
                </div>
              )}
            </div>

            {/* Two distinct buttons so iOS/Android show Library vs Camera reliably */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                type="button"
                onClick={() => libraryInput.current?.click()}
                className="py-3 rounded-xl bg-white/10 hover:bg-white/20 text-sunset-50 text-sm font-medium transition"
              >
                🖼️ Choose from gallery
              </button>
              <button
                type="button"
                onClick={() => cameraInput.current?.click()}
                className="py-3 rounded-xl bg-white/10 hover:bg-white/20 text-sunset-50 text-sm font-medium transition"
              >
                📷 Take a photo
              </button>
            </div>

            {/* Gallery picker — no capture attribute, opens the OS photo library */}
            <input
              ref={libraryInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] || null)}
            />
            {/* Camera capture — opens the camera directly */}
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] || null)}
            />
          </div>

          {/* Note */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-sunset-100">
                Your message for Lydia
              </label>
              <button
                type="button"
                onClick={pickSuggestion}
                className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition"
              >
                ✨ Suggest words
              </button>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={280}
              placeholder="Write something warm…"
              className="w-full rounded-xl bg-black/30 border border-white/10 p-3 text-sunset-50 placeholder:text-sunset-100/40 focus:outline-none focus:border-sunset-300"
            />
            <p className="text-right text-xs text-sunset-100/50 mt-1">
              {note.length}/280
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2 text-sunset-100">
              Your name <span className="text-sunset-100/50">(optional)</span>
            </label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={40}
              placeholder="From…"
              className="w-full rounded-xl bg-black/30 border border-white/10 p-3 text-sunset-50 placeholder:text-sunset-100/40 focus:outline-none focus:border-sunset-300"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/20 border border-red-400/30 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "uploading"}
            className="w-full py-4 rounded-full bg-gradient-to-r from-sunset-500 to-sunset-600 hover:opacity-95 text-white font-semibold transition shadow-lg disabled:opacity-60"
          >
            {status === "uploading" ? "Sending…" : "Send to the screen 💛"}
          </button>
        </form>
      )}
    </main>
  );
}
