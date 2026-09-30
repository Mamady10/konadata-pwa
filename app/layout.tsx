import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import {
  ServiceWorkerRegistration,
  OfflineIndicator,
} from '@/components/PWAProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'KonaData — Plateforme SaaS de gestion des données',
  description:
    'KonaData : gestion, collecte, analyse et valorisation des données pour ONG, établissements, BTP et PME. Optimisée pour les réseaux 3G/4G en Guinée.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'KonaData',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0A192F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png?v=2" />
        <link rel="icon" type="image/png" sizes="48x48" href="/icons/favicon-48x48.png?v=2" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png?v=2" />
      </head>
      <body className={inter.className}>
        {children}
        <ServiceWorkerRegistration />
        <OfflineIndicator />
      </body>
    </html>
  );
}
