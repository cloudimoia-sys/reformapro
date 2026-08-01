import { notFound, redirect } from "next/navigation";
import { requireTenant } from "@/lib/session";
import EmpresaClient from "./EmpresaClient";

export default async function EmpresaPage() {
  const { user, db } = await requireTenant();
  if (user.rol !== "ADMIN") redirect("/panel");

  const empresa = await db.empresa.findFirst();
  if (!empresa) notFound();

  return (
    <EmpresaClient
      empresa={{
        nombre: empresa.nombre,
        cif: empresa.cif,
        direccion: empresa.direccion,
        tel: empresa.tel,
        email: empresa.email,
        ivaDefecto: empresa.ivaDefecto,
        margenDefecto: empresa.margenDefecto,
      }}
      logoInicial={empresa.logo}
    />
  );
}
