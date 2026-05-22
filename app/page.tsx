import { redirect } from "next/navigation";

// The landing page just sends visitors straight to the TV display.
// QR codes for the upload page are generated externally.
export default function HomePage() {
  redirect("/display");
}
