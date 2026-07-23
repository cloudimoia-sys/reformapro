import { Rol } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    rol: Rol;
  }
  interface Session {
    user: {
      id: string;
      rol: Rol;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    rol: Rol;
  }
}
