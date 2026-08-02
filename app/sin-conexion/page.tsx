import Link from "next/link";

export const metadata = { title: "Sin conexión · ReformaPro" };

/**
 * La pantalla que sale cuando no hay red.
 *
 * Existe porque en una obra la cobertura se cae, y lo que veía el usuario era el
 * dinosaurio de Chrome: nada le decía si el fallo era de la aplicación o de su
 * teléfono. Esto lo aclara y le dice qué puede hacer mientras tanto.
 *
 * No lleva sesión ni datos a propósito: tiene que poder servirse desde la caché
 * del navegador, y una página cacheada con datos dentro sería un problema en una
 * tablet que se pasa de mano en mano.
 */
export default function SinConexion() {
  return (
    <div className="login">
      <div className="logincard">
        <div className="tapebar" />
        <div style={{ padding: 24 }}>
          <div className="logo" style={{ color: "var(--blue)", fontSize: 26, marginBottom: 10 }}>
            Reforma<b style={{ color: "var(--amber)" }}>Pro</b>
          </div>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Sin conexión</h1>
          <p className="hint" style={{ lineHeight: 1.5 }}>
            No hay cobertura ahora mismo. Tus presupuestos, obras e informes están a salvo en el servidor: en cuanto
            vuelva la señal aparecerán tal y como los dejaste.
          </p>
          <p className="hint" style={{ lineHeight: 1.5 }}>
            Si estás dentro de un edificio, prueba a salir o a acercarte a una ventana. Mientras tanto puedes seguir
            haciendo fotos con la cámara del móvil y subirlas después.
          </p>
          <Link className="btn" href="/panel" style={{ display: "block", textAlign: "center", marginTop: 14 }}>
            Reintentar
          </Link>
        </div>
      </div>
    </div>
  );
}
