import { requireTenant } from "@/lib/session";
import Copiloto from "@/components/Copiloto";

export default async function CopilotoPage() {
  // Solo para exigir sesión: el copiloto no necesita datos precargados.
  await requireTenant();
  return <Copiloto />;
}
