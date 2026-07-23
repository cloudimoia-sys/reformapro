import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReformaPro",
  description: "Gestión de presupuestos para reformistas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
