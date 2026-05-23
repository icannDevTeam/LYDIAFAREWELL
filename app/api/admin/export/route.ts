import { NextRequest } from "next/server";
import archiver from "archiver";
import { Readable } from "stream";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { COLLECTION } from "@/lib/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization") || "";
  const cookieTok = req.cookies.get("admin_token")?.value || "";
  const token = (header.startsWith("Bearer ") ? header.slice(7) : header) || cookieTok;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function safeFilename(s: string, fallback: string) {
  const cleaned = (s || "").replace(/[^a-z0-9_\-]+/gi, "_").slice(0, 40);
  return cleaned || fallback;
}

/**
 * GET /api/admin/export
 *   Streams a ZIP of every uploaded photo + a manifest.txt of all notes.
 *   Auth via cookie OR Authorization: Bearer header.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new Response("unauthorized", { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db.collection(COLLECTION).orderBy("createdAt", "asc").get();

  const archive = archiver("zip", { zlib: { level: 6 } });
  const manifestLines: string[] = [
    "Lidiya — farewell messages",
    `Exported: ${new Date().toISOString()}`,
    `Total: ${snap.size}`,
    "",
    "----------------------------------------",
    "",
  ];

  let idx = 0;
  for (const doc of snap.docs) {
    idx++;
    const data = doc.data() as any;
    const url: string | undefined = data.imageUrl;
    const author = data.author || "anonymous";
    const note = data.note || "";
    const ts = data.createdAt?.toDate?.()?.toISOString?.() || "";
    const base = String(idx).padStart(3, "0") + "_" + safeFilename(author, doc.id);

    manifestLines.push(`#${idx} — ${author}  (${ts})`);
    manifestLines.push(note);
    manifestLines.push("");

    if (url) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const ct = (res.headers.get("content-type") || "").toLowerCase();
          let ext = "jpg";
          if (ct.includes("png")) ext = "png";
          else if (ct.includes("webp")) ext = "webp";
          else if (ct.includes("gif")) ext = "gif";
          else if (ct.includes("quicktime") || ct.includes("mov")) ext = "mov";
          else if (ct.includes("webm")) ext = "webm";
          else if (ct.includes("mp4") || ct.startsWith("video/")) ext = "mp4";
          const folder = ct.startsWith("video/") ? "videos" : "photos";
          const buf = Buffer.from(await res.arrayBuffer());
          archive.append(buf, { name: `${folder}/${base}.${ext}` });
        }
      } catch (e) {
        manifestLines.push(`  [media fetch failed]`);
      }
    }
  }

  archive.append(manifestLines.join("\n"), { name: "messages.txt" });
  archive.finalize();

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(Readable.toWeb(archive) as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="lidiya-farewell-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
