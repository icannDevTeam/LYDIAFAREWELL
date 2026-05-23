import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminDb } from "@/lib/firebaseAdmin";
import AdminGallery, { type AdminMessage } from "./AdminGallery";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < ba.length; i++) out |= ba[i] ^ bb[i];
  return out === 0;
}

async function loadMessages(): Promise<AdminMessage[]> {
  const db = getAdminDb();
  const snap = await db.collection("messages").orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => {
    const data = d.data() as any;
    const ts = data.createdAt;
    const createdAt =
      ts && typeof ts.toMillis === "function" ? ts.toMillis() : Date.now();
    return {
      id: d.id,
      imageUrl: data.imageUrl,
      mediaType: data.mediaType === "video" ? "video" : "image",
      note: data.note,
      author: data.author || null,
      storagePath: data.storagePath || null,
      createdAt,
      hidden: data.hidden === true,
    };
  });
}

export default async function AdminPage() {
  const token = cookies().get("admin_token")?.value || "";
  const expected = process.env.ADMIN_TOKEN || "";
  if (!expected || !safeEqual(token, expected)) {
    redirect("/admin/login");
  }

  const messages = await loadMessages();
  return <AdminGallery messages={messages} adminToken={token} />;
}
