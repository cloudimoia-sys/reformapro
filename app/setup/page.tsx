import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SetupForm from "./SetupForm";

export default async function SetupPage() {
  const hayUsuarios = (await prisma.usuario.count()) > 0;
  if (hayUsuarios) redirect("/login");

  return <SetupForm />;
}
