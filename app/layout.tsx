import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar, { Footer } from "@/src/components/Navigation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL('https://whofyne.vercel.app'),
  title: {
    default: "WhoFyne • Curated Vibrance",
    template: "%s | WhoFyne"
  },
  description: "A premium online gallery for high-quality community-voted captures.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WhoFyne",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/icon.svg",
  },
  keywords: ["photography", "voting", "gallery", "curated", "vibrance"],
  authors: [{ name: "Uri Okhai" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "WhoFyne",
    title: "WhoFyne • Curated Vibrance",
    description: "Discover and vote for the most vibrant captures curated by our community.",
    images: [
      {
        url: "https://whofyne.vercel.app/whofyne-og.jpeg",
        width: 1200,
        height: 630,
        alt: "WhoFyne Gallery",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WhoFyne • Curated Vibrance",
    description: "Discover and vote for the most vibrant captures curated by our community.",
    images: ["https://whofyne.vercel.app/whofyne-og.jpeg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-900 dark:selection:text-indigo-100 transition-colors duration-300">
        <Providers>
          <Navbar />
          <main className="pt-2 min-h-screen">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
