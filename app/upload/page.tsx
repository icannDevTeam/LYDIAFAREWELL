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

  const IMAGE_LIMIT = 10 * 1024 * 1024;   // 10 MB
  const VIDEO_LIMIT = 50 * 1024 * 1024;   // 50 MB

  function onPick(f: File | null) {
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    const isVideo = f.type.startsWith("video/");
    if (!isImage && !isVideo) {
      setError("Please pick a photo or short video.");
      return;
    }
    const limit = isVideo ? VIDEO_LIMIT : IMAGE_LIMIT;
    if (f.size > limit) {
      setError(
        isVideo
          ? "Video must be under 50 MB. Try a shorter clip."
          : "Image must be under 10 MB.",
      );
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
    if (!file) { setError("Please add a photo or short video first."); return; }
    if (!note.trim()) { setError("Please write a short note for Lidiya."); return; }
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
      const mediaType: "image" | "video" = file.type.startsWith("video/")
        ? "video"
        : "image";

      await addDoc(collection(db, COLLECTION), {
        imageUrl,
        mediaType,
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
    <main className="relative min-h-screen px-5 py-6 max-w-xl mx-auto overflow-hidden">
      {/* Warm ambient background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, rgba(255,176,107,0.25), transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(255,107,107,0.22), transparent 55%), linear-gradient(180deg, #1a0d1f 0%, #2b0f1a 100%)",
        }}
      />
      <div aria-hidden className="film-grain pointer-events-none fixed inset-0 -z-10 opacity-40" />

      {/* Hero */}
      <header className="text-center mb-8 pt-2">
        <p className="text-[11px] tracking-[0.4em] uppercase text-sunset-200/70">
          A farewell celebration
        </p>
        <h1 className="mt-3 font-serif italic text-5xl text-shimmer leading-[1.05]">
          For Lidiya
        </h1>
        <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-sunset-300/60 to-transparent" />
        <p className="mt-5 text-sunset-100/80 text-[15px] max-w-sm mx-auto leading-relaxed font-serif italic">
          Leave her a photo and a few words.
          <br className="hidden sm:block" /> They will live on the wall, and later in a keepsake book.
        </p>
      </header>

      {status === "success" ? (
        <div className="glass rounded-3xl p-10 text-center">
          <p className="text-[11px] tracking-[0.35em] uppercase text-sunset-200/70">
            Thank you
          </p>
          <h2 className="mt-3 font-serif italic text-3xl text-shimmer">
            With love, received
          </h2>
          <div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-sunset-300/60 to-transparent" />
          <p className="mt-5 text-sunset-100/85 mb-7 font-serif italic">
            Watch the wall — your moment is on its way.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="px-7 py-3 rounded-full bg-sunset-500 hover:bg-sunset-600 text-white font-medium tracking-wide transition shadow-lg"
          >
            Share another
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="glass rounded-3xl p-6 space-y-6">
          {/* Photo */}
          <div>
            <label className="block text-[11px] tracking-[0.3em] uppercase mb-3 text-sunset-200/80">
              Photo
            </label>

            {/* Full square preview — uncropped (object-contain) so users see exactly what will appear on the wall */}
            {preview ? (
              <div className="mb-3">
                <div
                  className="relative w-full aspect-square rounded-2xl overflow-hidden border border-white/10"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, rgba(255,176,107,0.10), rgba(0,0,0,0.35) 70%)",
                  }}
                >
                  {file?.type.startsWith("video/") ? (
                    <video
                      src={preview}
                      className="absolute inset-0 w-full h-full object-contain bg-black"
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={preview}
                      alt="Your photo preview"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  )}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      boxShadow: "inset 0 0 60px rgba(0,0,0,0.45)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute top-2.5 right-2.5 text-[10px] tracking-[0.25em] uppercase text-white/90 hover:text-white bg-black/45 backdrop-blur px-3 py-1.5 rounded-full border border-white/15"
                  >
                    Remove
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-sunset-100/55 tracking-wide text-center font-serif italic">
                  This is how it will appear on the wall
                </p>
              </div>
            ) : (
              <div
                className="mb-3 w-full aspect-square rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center text-center px-6"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(255,176,107,0.07), rgba(0,0,0,0.25) 70%)",
                }}
              >
                <div className="w-12 h-12 rounded-full border border-white/15 flex items-center justify-center mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-sunset-200/70">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="9" cy="11" r="2" />
                    <path d="M21 17l-5-5-8 8" />
                  </svg>
                </div>
                <p className="font-serif italic text-sunset-50 text-[15px]">
                  Your photo or video will appear here
                </p>
                <p className="mt-1 text-[11px] tracking-wide text-sunset-100/55">
                  Photo or short clip · up to 10 MB photo or 50 MB video
                </p>
              </div>
            )}

            {/* Two distinct buttons so iOS/Android show Library vs Camera reliably */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => libraryInput.current?.click()}
                className="py-3 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-sunset-50 text-sm font-medium tracking-wide transition"
              >
                From gallery
              </button>
              <button
                type="button"
                onClick={() => cameraInput.current?.click()}
                className="py-3 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-sunset-50 text-sm font-medium tracking-wide transition"
              >
                Take a photo
              </button>
            </div>

            {/* Gallery picker — no capture attribute, opens the OS photo library */}
            <input
              ref={libraryInput}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] || null)}
            />
            {/* Camera capture — opens the camera directly */}
            <input
              ref={cameraInput}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] || null)}
            />
          </div>

          {/* Note */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-[11px] tracking-[0.3em] uppercase text-sunset-200/80">
                Your message
              </label>
              <button
                type="button"
                onClick={pickSuggestion}
                className="text-[11px] tracking-wider uppercase px-3 py-1 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] transition"
              >
                Suggest words
              </button>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={280}
              placeholder="A few warm words for Lidiya…"
              className="w-full rounded-xl bg-black/30 border border-white/10 p-4 font-serif italic text-[17px] leading-relaxed text-sunset-50 placeholder:text-sunset-100/35 focus:outline-none focus:border-sunset-300"
            />
            <p className="text-right text-[11px] text-sunset-100/40 mt-1 tracking-wider">
              {note.length} / 280
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[11px] tracking-[0.3em] uppercase mb-3 text-sunset-200/80">
              Your name <span className="text-sunset-100/40 normal-case tracking-normal">(optional)</span>
            </label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={40}
              placeholder="From…"
              className="w-full rounded-xl bg-black/30 border border-white/10 p-3 text-sunset-50 placeholder:text-sunset-100/35 focus:outline-none focus:border-sunset-300"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/15 border border-red-400/30 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "uploading"}
            className="w-full py-4 rounded-full bg-gradient-to-r from-sunset-500 to-sunset-600 hover:opacity-95 text-white font-medium tracking-[0.2em] uppercase text-sm transition shadow-lg disabled:opacity-60"
          >
            {status === "uploading" ? "Sending" : "Submit"}
          </button>
        </form>
      )}

      <footer className="mt-10 mb-4">
        <div className="mx-auto h-px w-16 bg-gradient-to-r from-transparent via-sunset-300/40 to-transparent" />
        <div className="mt-3 flex items-center justify-between gap-4 text-[10px] tracking-[0.3em] uppercase">
          <p className="text-sunset-100/30">
            © 2026 · Albert
          </p>
          <p className="text-sunset-100/45 tracking-[0.35em]">
            With love · for Lidiya
          </p>
        </div>
      </footer>
    </main>
  );
}
