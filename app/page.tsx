"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";

export default function HomePage() {
  const [uploadUrl, setUploadUrl] = useState<string>("");

  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    setUploadUrl(`${base}/upload`);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden particles">
      <div className="text-center max-w-3xl relative z-10">
        <p className="font-script text-3xl md:text-4xl text-sunset-200 mb-2">
          A farewell for
        </p>
        <h1 className="font-serif text-6xl md:text-8xl font-semibold text-shimmer mb-6">
          Lydia
        </h1>
        <p className="text-sunset-100/90 text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
          Scan the QR code, share a photo and a heartfelt note. Your message will
          appear live on the big screen.
        </p>

        <div className="glass warm-glow rounded-3xl p-8 inline-block">
          {uploadUrl ? (
            <QRCodeSVG
              value={uploadUrl}
              size={260}
              bgColor="#fff7ed"
              fgColor="#3d1e15"
              level="H"
              includeMargin
            />
          ) : (
            <div className="w-[260px] h-[260px] bg-sunset-50 rounded" />
          )}
          <p className="mt-5 text-sm text-sunset-100/80 break-all">
            {uploadUrl || "Loading…"}
          </p>
        </div>

        <div className="mt-12 flex flex-wrap gap-4 justify-center">
          <Link
            href="/upload"
            className="px-6 py-3 rounded-full bg-sunset-500 hover:bg-sunset-600 text-white font-medium transition shadow-lg"
          >
            Open Upload Page
          </Link>
          <Link
            href="/display"
            className="px-6 py-3 rounded-full glass text-sunset-50 hover:bg-white/20 transition"
          >
            Open TV Display
          </Link>
        </div>
      </div>
    </main>
  );
}
