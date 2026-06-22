import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar de Licitaciones — gana contratos con el Estado",
  description:
    "Vigilamos SECOP II por ti y te avisamos qué procesos públicos puede ganar tu empresa. Panel para gestionar tus postulaciones.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
