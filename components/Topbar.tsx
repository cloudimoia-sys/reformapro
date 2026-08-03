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

/**
 * Cierra la sesión sin dejar que NextAuth decida a dónde va el usuario.
 *
 * ANTES: `signOut({ callbackUrl: "/login" })`. NextAuth resuelve las rutas
 * relativas contra NEXTAUTH_URL, y esa variable estaba apuntando a la URL de
 * rama del despliegue (`...-git-main-....vercel.app`) en lugar de al dominio de
 * producción. Resultado: al pulsar Salir, el usuario aterrizaba en la pantalla
 * de inicio de sesión DE VERCEL. Delante de un cliente, eso parece que la
 * aplicación se ha roto.
 *
 * AHORA se cierra la sesión sin redirección y se navega a mano al /login del
 * dominio en el que está el usuario. Da igual lo que valga NEXTAUTH_URL: acaba
 * donde tiene que acabar.
 */
async function salir() {
  await signOut({ redirect: false });
  window.location.assign("/login");
}

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
          onClick={salir}
        >
          Salir
        </button>
      </div>
    </div>
  );
}
