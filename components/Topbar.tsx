"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const TABS: [string, string][] = [
  ["/panel", "Panel"],
  ["/clientes", "Clientes"],
  ["/catalogo", "Catálogo"],
  ["/presupuestos", "Presupuestos"],
  ["/obras", "Obras"],
  ["/informes", "Informes"],
  ["/diagnostico", "Diagnóstico"],
  ["/copiloto", "Copiloto"],
];

const TABS_ADMIN: [string, string][] = [
  ["/facturas", "Facturación"],
  ["/equipo", "Equipo"],
  ["/empresa", "Mi empresa"],
];

export default function Topbar({
  nombre,
  rol,
  esDueno,
}: {
  nombre: string;
  rol: "ADMIN" | "EMPLEADO";
  /** Dueño de ReformaPro, no administrador de una empresa cliente. */
  esDueno?: boolean;
}) {
  const pathname = usePathname();
  const tabs = rol === "ADMIN" ? [...TABS, ...TABS_ADMIN] : TABS;
  // La pestaña de suscripciones solo la ve quien lleva la aplicación. Que no se
  // pinte no es la protección: la protección está en requireDuenoApp().
  if (esDueno) tabs.push(["/suscripciones", "Suscripciones"]);

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
