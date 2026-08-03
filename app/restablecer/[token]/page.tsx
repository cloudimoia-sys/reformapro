import Link from "next/link";
import { comprobarToken } from "../actions";
import RestablecerForm from "./RestablecerForm";

export default async function RestablecerPage({ params }: { params: Promise<{ token: string }> }) {
  // Desde Next 15, los params de una ruta llegan como promesa.
  const { token } = await params;
  const valido = await comprobarToken(token);

  // Se comprueba antes de pintar el formulario para no hacer escribir una
  // contraseña nueva y rechazarla después.
  if (!valido) {
    return (
      <div className="login">
        <div className="logincard">
          <div className="tapebar" />
          <div style={{ padding: 26 }}>
            <div className="logo" style={{ color: "var(--ink)", fontSize: 28 }}>
              Reforma<b>Pro</b>
            </div>
            <p className="hint" style={{ margin: "10px 0 18px", lineHeight: 1.5 }}>
              Este enlace ya no sirve: puede que haya caducado (duran una hora), que ya
              lo hayas usado o que hayas pedido otro más nuevo.
            </p>
            <Link className="btn" href="/recuperar" style={{ display: "block", textAlign: "center" }}>
              Pedir un enlace nuevo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <RestablecerForm token={token} />;
}
