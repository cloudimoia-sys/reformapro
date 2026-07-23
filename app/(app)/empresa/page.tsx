import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import EmpresaClient from "./EmpresaClient";

export default async function EmpresaPage() {
  const user = await requireUser();
  if (user.rol !== "ADMIN") redirect("/panel");

  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: 1 } });

  return (
    <EmpresaClient
      empresa={{
        nombre: empresa.nombre,
        cif: empresa.cif,
        direccion: empresa.direccion,
        tel: empresa.tel,
        email: empresa.email,
        ivaDefecto: empresa.ivaDefecto,
      }}
      logoInicial={empresa.logo}
    />
  );
}
