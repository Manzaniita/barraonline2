import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="es-AR" className="dark">
      <body className="min-h-screen bg-[#040407] text-slate-100 antialiased selection:bg-[#FF2E63] selection:text-white">
        {children}
      </body>
    </html>
  );
}
