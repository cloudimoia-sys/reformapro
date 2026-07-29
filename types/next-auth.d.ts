import { Rol } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    rol: Rol;
    empresaId: string;
  }
  interface Session {
    user: {
      id: string;
      rol: Rol;
      /** Empresa a la que pertenece el usuario: de aquí sale el filtro de TODAS las consultas. */
      empresaId: string;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    rol: Rol;
    empresaId: string;
    /** Marca de la última revalidación contra la base de datos (ver callback jwt). */
    revisadoEn?: number;
  }
}
