"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function QrPage() {
  const [uploadUrl, setUploadUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const base =
      envUrl && envUrl.startsWith("http") ? envUrl : window.location.origin;
    setUploadUrl(base.replace(/\/$/, "") + "/upload");
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(uploadUrl);
    } catch {}
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center text-center px-6">
      {/* Warm ambient backdrop */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, rgba(255,176,107,0.30), transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(255,107,107,0.25), transparent 55%), linear-gradient(180deg, #1a0d1f 0%, #2b0f1a 100%)",
        }}
      />
      <div aria-hidden className="film-grain fixed inset-0 -z-10 opacity-40" />

      {/* Eyebrow */}
      <p className="text-[11px] md:text-[13px] tracking-[0.5em] uppercase text-sunset-200/70 mb-5">
        A farewell celebration
      </p>

      {/* Headline */}
      <h1 className="font-serif italic text-6xl md:text-8xl text-shimmer leading-[1] mb-4">
        For Lidiya
      </h1>
      <div className="h-px w-28 bg-gradient-to-r from-transparent via-sunset-300/70 to-transparent mb-6" />
      <p className="font-serif italic text-xl md:text-2xl text-sunset-100/85 max-w-xl mb-10">
        Leave a photo and a few warm words. They will live on the wall — and in
        a keepsake book she'll take home.
      </p>

      {/* QR card */}
      <div className="relative">
        {/* Aura */}
        <div
          aria-hidden
          className="absolute -inset-8 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(253,186,116,0.35), transparent 65%)",
            filter: "blur(40px)",
          }}
        />
        <div className="relative rounded-3xl bg-white/95 backdrop-blur p-6 md:p-8 shadow-2xl border border-white/40">
          {uploadUrl ? (
            <QRCodeSVG
              value={uploadUrl}
              size={280}
              level="H"
              marginSize={2}
              fgColor="#2b0f1a"
              bgColor="#ffffff"
            />
          ) : (
            <div className="w-[280px] h-[280px]" />
          )}
        </div>
      </div>

      {/* CTA */}
      <p className="mt-8 font-serif italic text-2xl md:text-3xl text-sunset-50">
        Scan with your phone
      </p>
      <p className="mt-2 text-sm tracking-[0.25em] uppercase text-sunset-200/70">
        Then tap · open in browser
      </p>

      {/* URL pill */}
      {uploadUrl && (
        <button
          onClick={copy}
          className="mt-7 group flex items-center gap-3 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 px-5 py-2.5 transition"
          title="Copy link"
        >
          <span className="font-mono text-sm text-sunset-50/90">
            {uploadUrl.replace(/^https?:\/\//, "")}
          </span>
          <span className="text-[10px] tracking-[0.3em] uppercase text-sunset-200/70 group-hover:text-sunset-100">
            copy
          </span>
        </button>
      )}

      {/* Footer credits: Albert bottom-left, Lidiya bottom-right */}
      <p className="absolute bottom-5 left-6 text-[10px] tracking-[0.3em] uppercase text-sunset-100/35">
        © 2026 · Built and designed by Albert
      </p>
      <p className="absolute bottom-5 right-6 text-[10px] tracking-[0.35em] uppercase text-sunset-100/45">
        With love · for Lidiya
      </p>

      {/* Top corner: tiny link to TV display (so the host can flip back) */}
      <a
        href="/display"
        className="absolute top-5 right-6 text-[10px] tracking-[0.3em] uppercase text-sunset-100/40 hover:text-sunset-100/80 transition"
      >
        TV display →
      </a>
    </main>
  );
}
