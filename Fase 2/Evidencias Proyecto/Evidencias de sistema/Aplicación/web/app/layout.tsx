import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "aSIIstente — Deja de entrar al SII todos los días",
  description:
    "aSIIstente descarga tu RCV, deuda TGR y F29 automáticamente, cada 10 minutos, para todos tus RUT.",
  icons: { icon: "/icono.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
