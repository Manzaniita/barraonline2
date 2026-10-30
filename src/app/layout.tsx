import type { Metadata, Viewport } from 'next';
import { Syne, Figtree } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#060608',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'BarraOnline — Pedí • Pagá • Retirá sin filas',
  description:
    'Pedí tus bebidas desde el celular, pagá fácil con Mercado Pago y retirá en barra con tu código QR al instante. Viví la noche sin perder tiempo en filas.',
  icons: {
    icon: '/logo-barraonline-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es-AR"
      className={`dark ${syne.variable} ${figtree.variable}`}
    >
      <body className="min-h-screen bg-[#060608] text-slate-100 font-sans antialiased selection:bg-[#FF007A] selection:text-white">
        {children}
      </body>
    </html>
  );
}
