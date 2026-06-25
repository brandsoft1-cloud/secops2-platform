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
    // suppressHydrationWarning: algunas extensiones del navegador (p.ej. QuillBot,
    // que inyecta data-qb-installed) modifican <html>/<body> antes de que React
    // hidrate, lo que dispara un falso "hydration mismatch". No afecta a usuarios
    // sin esas extensiones; esto silencia solo ese ruido en esos dos tags.
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
