"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export type EmpresaInput = {
  nombre: string;
  cif: string;
  direccion: string;
  tel: string;
  email: string;
  ivaDefecto: number;
};

export async function actualizarEmpresa(data: EmpresaInput) {
  await requireAdmin();
  await prisma.empresa.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  revalidatePath("/empresa");
}

const LOGO_MAX_BYTES = 500 * 1024; // 500 KB en base64, de sobra para un logo pequeño

export async function actualizarLogoEmpresa(logo: string | null) {
  const admin = await requireAdmin();
  if (logo) {
    if (!logo.startsWith("data:image/")) throw new Error("El logo debe ser una imagen.");
    if (logo.length > LOGO_MAX_BYTES) throw new Error("El logo es demasiado grande.");
  }
  await prisma.empresa.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      nombre: "",
      cif: "",
      direccion: "",
      tel: "",
      email: admin.email || "",
      logo,
    },
    update: { logo },
  });
  revalidatePath("/empresa");
  revalidatePath("/facturas");
}
