import { NextRequest, NextResponse } from "next/server";

// Constant-time string compare via Buffer XOR.
function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < ba.length; i++) out |= ba[i] ^ bb[i];
  return out === 0;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = String(form.get("token") || "");
  const expected = process.env.ADMIN_TOKEN || "";
  if (!expected || !safeEqual(token, expected)) {
    const url = new URL("/admin/login?error=1", req.url);
    return NextResponse.redirect(url, { status: 303 });
  }
  const res = NextResponse.redirect(new URL("/admin", req.url), { status: 303 });
  res.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", "", { path: "/", maxAge: 0 });
  return res;
}
