import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/panel/:path*",
    "/clientes/:path*",
    "/catalogo/:path*",
    "/presupuestos/:path*",
    "/informes/:path*",
    "/copiloto/:path*",
    "/facturas/:path*",
    "/equipo/:path*",
    "/empresa/:path*",
    // Faltaba: la ruta de IA se protegía sola por dentro, pero dejarla fuera del
    // middleware significaba que una petición sin sesión llegaba a ejecutarse.
    "/api/generar-presupuesto",
    "/api/generar-informe",
    "/api/leer-plano",
    "/api/copiloto",
  ],
};
