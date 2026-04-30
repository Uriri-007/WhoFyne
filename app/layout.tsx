import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import Navbar, { Footer } from '@/src/components/Navigation';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://whofyne.app'),
  title: {
    default: 'WhoFyne • Curated Vibrance',
    template: '%s | WhoFyne',
  },
  description: 'A premium online gallery for high-quality community-voted captures.',
  keywords: ['photography', 'voting', 'gallery', 'curated', 'vibrance'],
  authors: [{ name: 'WhoFyne Community' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'WhoFyne',
    title: 'WhoFyne • Curated Vibrance',
    description: 'Discover and vote for the most vibrant captures curated by our community.',
    images: [
      {
        url: 'https://picsum.photos/seed/whofyne/1200/630',
        width: 1200,
        height: 630,
        alt: 'WhoFyne Gallery',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WhoFyne • Curated Vibrance',
    description: 'Discover and vote for the most vibrant captures curated by our community.',
    images: ['https://picsum.photos/seed/whofyne/1200/630'],
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
          <main className="pt-2 min-h-screen">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
