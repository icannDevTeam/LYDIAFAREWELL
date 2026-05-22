import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminStorage } from "@/lib/firebaseAdmin";
import { COLLECTION } from "@/lib/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  // Constant-time compare via Buffer to avoid timing attacks.
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * DELETE /api/admin/messages/:id
 *   Removes the Firestore document and its associated Storage object.
 *   Requires header:  Authorization: Bearer <ADMIN_TOKEN>
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const docRef = db.collection(COLLECTION).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const data = snap.data() as { storagePath?: string } | undefined;
    if (data?.storagePath) {
      try {
        await getAdminStorage().bucket().file(data.storagePath).delete();
      } catch (e: any) {
        // Log but don't fail the whole delete — Firestore doc is the source of truth for the UI.
        console.warn("storage delete failed:", e?.message);
      }
    }

    await docRef.delete();
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    console.error("admin delete failed:", e);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
