# Farewell, Lydia 💛

A warm, real-time farewell wall for Lydia.

- **`/`** — Landing page with a giant QR code (point a phone at it).
- **`/upload`** — Mobile-friendly page where guests snap a selfie + write a note.
- **`/display`** — Big-screen TV view with idle animation + live slideshow.

Built with **Next.js 14 (App Router) + Firebase (Firestore + Storage) + Tailwind + Framer Motion**.

---

## 1. Setup

```bash
cd lydia-farewell
npm install
cp .env.local.example .env.local
```

Fill `.env.local` with your Firebase web config (Project Settings → General → "Your apps" → Web app).

## 2. Firebase project

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Cloud Firestore** (start in test mode for the party; tighten rules after).
3. Enable **Storage**.
4. Add a web app and copy the config keys into `.env.local`.

### Firestore rules (open writes for the party night — close after)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /messages/{id} {
      allow read: if true;
      allow create: if
        request.resource.data.note is string &&
        request.resource.data.note.size() < 500 &&
        request.resource.data.imageUrl is string;
      allow update, delete: if false;
    }
  }
}
```

### Storage rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{file} {
      allow read: if true;
      allow write: if
        request.resource.size < 10 * 1024 * 1024 &&
        request.resource.contentType.matches('image/.*');
    }
  }
}
```

## 3. Run locally

```bash
npm run dev
```

- Big screen: open http://localhost:3000/display in full-screen (F11).
- Phones on the same Wi-Fi: open `http://<your-LAN-IP>:3000/upload` (set `NEXT_PUBLIC_SITE_URL=http://<your-LAN-IP>:3000` so the QR points to it).

## 4. Deploy to Vercel

```bash
npx vercel
```

Add the same env vars in the Vercel dashboard. Set `NEXT_PUBLIC_SITE_URL` to your final URL (e.g. `https://lydia-farewell.vercel.app`) so the QR code on `/` points to the live `/upload` page.

## 5. Party night flow

1. Put the laptop / TV on **`/display`** in fullscreen.
2. Print or show **`/`** on a tablet/poster — guests scan the QR.
3. Guests upload a photo + note → it appears within ~1 second on the big screen.
4. With 0 photos: warm idle animation. With ≥1: slideshow loops, newest jumps to front.

## 6. Custom photos / starter content

Drop your prepared photos into `/public/seed/` and (optionally) pre-seed Firestore with starter messages from the Firebase console so the slideshow has content the moment the party starts.

---

Made with warmth for Lydia. ✨
