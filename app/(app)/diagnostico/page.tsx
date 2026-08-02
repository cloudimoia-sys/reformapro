import { requireTenant } from "@/lib/session";
import Diagnostico from "@/components/Diagnostico";

export default async function DiagnosticoPage() {
  // Solo para exigir sesión: el diagnóstico no necesita datos precargados.
  await requireTenant();
  return <Diagnostico />;
}
