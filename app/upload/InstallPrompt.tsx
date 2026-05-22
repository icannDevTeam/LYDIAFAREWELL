"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "lf_install_dismissed_at";
const DISMISS_DAYS = 7;

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed / running standalone? Hide.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) return;

    // Honor recent dismissal
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_DAYS * 86400 * 1000) return;

    const ua = navigator.userAgent || "";
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = isIos && /safari/i.test(ua) && !/crios|fxios/i.test(ua);

    if (isIos && isSafari) {
      setIosHint(true);
      setShow(true);
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "dismissed") dismiss();
    setDeferred(null);
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md">
      <div className="rounded-2xl bg-white/95 backdrop-blur shadow-xl border border-stone-200 p-3 flex items-center gap-3 text-stone-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">Add Lydia to your home screen</p>
          {iosHint ? (
            <p className="text-xs text-stone-500 mt-0.5">
              Tap <span aria-hidden>⎙</span> Share, then <b>Add to Home Screen</b>.
            </p>
          ) : (
            <p className="text-xs text-stone-500 mt-0.5">One tap from your phone — like an app.</p>
          )}
        </div>
        {!iosHint && (
          <button
            onClick={install}
            className="px-3 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium"
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-stone-400 hover:text-stone-700 text-xl leading-none px-2"
        >
          ×
        </button>
      </div>
    </div>
  );
}
