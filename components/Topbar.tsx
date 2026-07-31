"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const TABS: [string, string][] = [
  ["/panel", "Panel"],
  ["/clientes", "Clientes"],
  ["/catalogo", "Catálogo"],
  ["/presupuestos", "Presupuestos"],
  ["/informes", "Informes"],
];

const TABS_ADMIN: [string, string][] = [
  ["/facturas", "Facturas"],
  ["/equipo", "Equipo"],
  ["/empresa", "Mi empresa"],
];

export default function Topbar({
  nombre,
  rol,
}: {
  nombre: string;
  rol: "ADMIN" | "EMPLEADO";
}) {
  const pathname = usePathname();
  const tabs = rol === "ADMIN" ? [...TABS, ...TABS_ADMIN] : TABS;

  return (
    <div className="topbar">
      <div className="logo">
        Reforma<b>Pro</b>
      </div>
      <nav className="tabs">
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className={`tab ${pathname.startsWith(href) ? "on" : ""}`}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="userchip">
        {nombre} · {rol === "ADMIN" ? "admin" : "empleado"}
        <button
          className="btn sm ghost"
          style={{ color: "#fff", borderColor: "#ffffff55" }}
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Salir
        </button>
      </div>
    </div>
  );
}
