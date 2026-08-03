"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";
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
/**
 * useLayoutEffect en el cliente, useEffect en el servidor.
 *
 * Aquí hace falta la versión de layout: decide si caben las pestañas ANTES de
 * pintar, y con useEffect se ve un parpadeo con las doce desplegadas. Pero
 * useLayoutEffect no existe en el render del servidor y React avisa por consola
 * en cada petición. Esta es la forma estándar de tener las dos cosas.
 */
const useEfectoDeLayout = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

  /**
   * Menú desplegable para pantallas estrechas.
   *
   * Doce pestañas no caben en una fila ni en un portátil: se partían en dos filas
   * al estrechar la ventana y en tres en el móvil, comiéndose media pantalla en
   * el sitio donde menos sobra. Por debajo de 1000 px se recogen aquí.
   *
   * Solo cambia la presentación: las pestañas son los mismos enlaces y siguen en
   * el HTML, así que el teclado y el lector de pantalla las encuentran igual.
   */
  const [abierto, setAbierto] = useState(false);

  /*
   * A partir de qué ancho hace falta el menú.
   *
   * No es un número fijo, porque el número de pestañas depende de quién mira: un
   * empleado ve 8, el administrador de una empresa 11, y quien lleva ReformaPro
   * 12. Con un corte fijo, o le sales con un menú a un empleado que tenía sitio
   * de sobra, o le dejas dos filas al administrador.
   *
   * Los dos números están MEDIDOS en el navegador con el CSS real, no estimados:
   * cada pestaña ocupa 98 px contando su separación, y el logo, la ficha de
   * usuario y los márgenes suman 370. Los 50 de propina son para que el cambio
   * ocurra un poco antes de que llegue a apretar.
   *
   * Si alguien cambia el tamaño de `.tab` en globals.css, hay que volver a medir
   * esto. Por eso el CSS lleva una nota que apunta aquí.
   */
  const umbral = tabs.length * 98 + 420;
  const [compacto, setCompacto] = useState(false);

  useEfectoDeLayout(() => {
    const consulta = window.matchMedia(`(max-width:${umbral}px)`);
    const aplicar = () => setCompacto(consulta.matches);
    aplicar();
    consulta.addEventListener("change", aplicar);
    return () => consulta.removeEventListener("change", aplicar);
  }, [umbral]);

  // Al navegar se cierra solo. Sin esto, el menú se queda abierto tapando la
  // pantalla a la que acabas de entrar.
  useEffect(() => setAbierto(false), [pathname]);

  useEffect(() => {
    if (!abierto) return;
    const alPulsarEscape = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alPulsarEscape);
    return () => window.removeEventListener("keydown", alPulsarEscape);
  }, [abierto]);

  return (
    <div className={`topbar ${compacto ? "compacto" : ""}`}>
      <div className="logo">
        Reforma<b>Pro</b>
      </div>

      <button
        type="button"
        className="hamburguesa"
        aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={abierto}
        aria-controls="menu-principal"
        onClick={() => setAbierto((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      {/* Tocar fuera cierra el menú, que es lo que espera cualquiera en un móvil. */}
      {abierto && <div className="menu-fondo" onClick={() => setAbierto(false)} />}

      <nav id="menu-principal" className={`tabs ${abierto ? "abierto" : ""}`}>
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className={`tab ${pathname.startsWith(href) ? "on" : ""}`}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="userchip">
        <span className="quien">
          {nombre} · {rol === "ADMIN" ? "admin" : "empleado"}
        </span>
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
