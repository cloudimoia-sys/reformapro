import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  // Con sesión válida, directo al panel. Sin ella, la portada — antes esto
  // redirigía siempre a /login y no había forma de crear una cuenta nueva.
  if (session?.user?.empresaId) redirect("/panel");

  return (
    <div className="login">
      <div className="logincard" style={{ width: 420 }}>
        <div className="tapebar" />
        <div style={{ padding: 30 }}>
          <div className="logo" style={{ color: "var(--ink)", fontSize: 30 }}>
            Reforma<b>Pro</b>
          </div>
          <p className="hint" style={{ margin: "10px 0 22px", lineHeight: 1.5 }}>
            Presupuestos, firma del cliente y facturas para reformistas. Genera las
            partidas con IA, controla tus precios por proveedor y cobra sin perder
            el hilo.
          </p>

          <Link className="btn" href="/registro" style={{ display: "block", textAlign: "center", marginBottom: 10 }}>
            Crear cuenta
          </Link>
          <Link className="btn ghost" href="/login" style={{ display: "block", textAlign: "center" }}>
            Iniciar sesión
          </Link>

          <p className="hint" style={{ marginTop: 20, fontSize: 12 }}>
            Al crear una cuenta empiezas con 14 días de prueba, sin tarjeta.
          </p>
        </div>
      </div>
    </div>
  );
}
