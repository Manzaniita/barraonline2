import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BarraOnline.com.ar — Pedí desde la pista, retirá con QR Único sin fila',
  description:
    'Plataforma SaaS multi-tenant para boliches, bares y establecimientos nocturnos de la costa argentina. Pagos directos vía Mercado Pago y retiro atómico por QR.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR" className="dark">
      <body className="min-h-screen bg-[#070709] text-slate-100 antialiased selection:bg-[#FF2E63] selection:text-white">
        {children}
      </body>
    </html>
  );
}
