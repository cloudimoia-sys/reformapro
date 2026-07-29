import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Topbar from "@/components/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Además de la sesión, exigimos empresa: un token viejo (de antes de que la app
  // fuera multi-empresa) no la lleva, y sin ella las consultas no podrían filtrar.
  // Mejor mandar a iniciar sesión de nuevo que dejar pasar una sesión a medias.
  if (!session?.user?.empresaId) redirect("/login");

  return (
    <div className="rp">
      <Topbar nombre={session.user.name ?? ""} rol={session.user.rol} />
      <div className="main">{children}</div>
    </div>
  );
}
