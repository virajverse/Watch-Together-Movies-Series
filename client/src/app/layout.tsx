import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watch Together - Real-time Video Sync",
  description: "Watch videos together in real-time sync with friends",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-dark-900 text-white">
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
