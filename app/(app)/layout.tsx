import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/session";
import Topbar from "@/components/Topbar";
import AvisoSuscripcion from "@/components/AvisoSuscripcion";
import Instalar from "@/components/Instalar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Antes se leía la sesión suelta con getServerSession. Ahora pasa por
  // requireTenant, que además de exigir empresa devuelve el estado de la
  // suscripción: así el aviso sale en todas las pantallas sin tener que acordarse
  // de ponerlo en cada una.
  //
  // Sin sesión, con un token viejo sin empresa, o con la empresa ya borrada, lo
  // que procede en los tres casos es volver a iniciar sesión.
  const ctx = await requireTenant().catch(() => null);
  if (!ctx) redirect("/login");

  const dueno = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const esDueno = !!dueno && ctx.user.email.trim().toLowerCase() === dueno;

  return (
    <div className="rp">
      <Topbar nombre={ctx.user.nombre} rol={ctx.user.rol} esDueno={esDueno} />
      <div className="main">
        <AvisoSuscripcion suscripcion={ctx.suscripcion} />
        <Instalar />
        {children}
      </div>
    </div>
  );
}
