import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kiki Backend — Wallpaper API for the React Native app",
  description:
    "Kiki backend server. Manages the HD wallpaper catalog, downloads, rotation configs and real-time catalog events for the Kiki React Native app. Connects to Neon DB and deploys to Vercel.",
  keywords: [
    "Kiki",
    "wallpaper",
    "lockscreen",
    "React Native",
    "Neon DB",
    "Vercel",
    "Next.js API",
    "real-time SSE",
  ],
  authors: [{ name: "Kiki Studio" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Kiki Backend",
    description:
      "Wallpaper catalog API for the Kiki React Native app. Neon DB + Vercel ready.",
    siteName: "Kiki",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kiki Backend",
    description:
      "Wallpaper catalog API for the Kiki React Native app. Neon DB + Vercel ready.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
