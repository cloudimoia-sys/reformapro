import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const hayUsuarios = (await prisma.usuario.count()) > 0;
  if (!hayUsuarios) redirect("/setup");

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
