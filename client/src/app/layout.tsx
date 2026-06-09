import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Watch Together - Stream in Sync",
  description: "Watch movies and videos together in perfect real-time sync with friends",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f0f1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-['Inter',system-ui,sans-serif] bg-dark-900 text-gray-100 antialiased overflow-x-hidden">
        <div className="min-h-screen relative">
          {/* Subtle background gradient orbs */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-600/10 rounded-full blur-[100px]" />
            <div className="absolute top-1/2 -left-40 w-96 h-96 bg-accent-purple/5 rounded-full blur-[120px]" />
            <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-accent-blue/5 rounded-full blur-[100px]" />
          </div>
          {/* Main content */}
          <div className="relative z-10">{children}</div>
        </div>
      </body>
    </html>
  );
}
