import { Suspense } from "react";
import LoginForm from "./LoginForm";

// Antes esta página consultaba la base de datos para redirigir a /setup cuando no
// había ningún usuario. Con el registro abierto eso ya no aplica: /setup no existe
// y la portada ofrece "Crear cuenta". De paso nos ahorramos una consulta.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
