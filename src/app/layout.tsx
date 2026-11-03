import type { Metadata, Viewport } from 'next';
import { Urbanist, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const urbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
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
      className={`dark ${urbanist.variable} ${plusJakartaSans.variable}`}
    >
      <body className="min-h-screen bg-[#060608] text-slate-100 font-sans antialiased selection:bg-[#FF007A] selection:text-white">
        {children}
      </body>
    </html>
  );
}
