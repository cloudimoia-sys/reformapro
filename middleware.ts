import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/panel/:path*",
    "/clientes/:path*",
    "/precios/:path*",
    "/presupuestos/:path*",
    "/facturas/:path*",
    "/equipo/:path*",
    "/empresa/:path*",
  ],
};
