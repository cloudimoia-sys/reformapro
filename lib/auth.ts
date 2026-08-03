import { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prismaUnsafe } from "@/lib/prisma";
import { anotarIntento, ipDeLaPeticion, limpiarIntentosViejos, superaLimite } from "@/lib/limite";

/** Cada cuánto se vuelve a comprobar contra la BD que el usuario sigue existiendo. */
const REVALIDAR_CADA_MS = 15 * 60 * 1000;

/**
 * Freno a la fuerza bruta.
 *
 * Hasta ahora no había ninguno: se podían probar contraseñas sin más límite que
 * el ancho de banda. Se cuenta por dos vías porque frenan ataques distintos:
 *
 *  - Por EMAIL: alguien que va a por una cuenta concreta probando el diccionario.
 *    Es el caso normal, y con 5 intentos por cuarto de hora se para en seco sin
 *    molestar a quien de verdad no se acuerda de su contraseña.
 *  - Por IP: alguien que prueba la misma contraseña floja contra muchos correos
 *    (password spraying). Ahí el contador por email nunca salta, porque cada uno
 *    recibe un solo intento.
 *
 * Solo cuentan los intentos FALLIDOS: acertar no gasta.
 */
const LOGIN_POR_EMAIL = { maximo: 5, ventanaMinutos: 15 };
const LOGIN_POR_IP = { maximo: 20, ventanaMinutos: 15 };

export const authOptions: AuthOptions = {
  // 7 días (el defecto de NextAuth son 30). Como el rol y la empresa viajan dentro
  // del token, una sesión muy larga tarda mucho en enterarse de que un empleado
  // ha sido dado de baja; el callback jwt de abajo lo revalida periódicamente.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const ip = await ipDeLaPeticion();
        await limpiarIntentosViejos();

        /**
         * Bloqueado se devuelve `null`, exactamente igual que una contraseña
         * incorrecta.
         *
         * Un mensaje distinto ("demasiados intentos") le confirmaría a quien
         * ataca que esa cuenta existe y que va por buen camino. Al usuario legítimo
         * le cuesta un cuarto de hora de espera; al que prueba a ciegas, le quita
         * la única señal útil que tenía.
         */
        const [bloqueadoEmail, bloqueadaIp] = await Promise.all([
          superaLimite("login", email, LOGIN_POR_EMAIL.maximo, LOGIN_POR_EMAIL.ventanaMinutos),
          superaLimite("login", ip, LOGIN_POR_IP.maximo, LOGIN_POR_IP.ventanaMinutos),
        ]);
        if (bloqueadoEmail || bloqueadaIp) {
          console.warn(`Login bloqueado por límite de intentos (${bloqueadoEmail ? "email" : "IP"})`);
          return null;
        }

        // Búsqueda sin filtrar por empresa a propósito: el email es único en toda
        // la plataforma, y justamente ES lo que nos dice a qué empresa pertenece.
        const usuario = await prismaUnsafe.usuario.findUnique({
          where: { email },
          select: {
            id: true,
            nombre: true,
            email: true,
            rol: true,
            empresaId: true,
            passwordHash: true,
          },
        });
        /**
         * El intento fallido se anota tanto si el email existe como si no.
         *
         * Si solo se contaran los de cuentas reales, el tiempo de respuesta y el
         * comportamiento del bloqueo delatarían qué correos están registrados.
         */
        const fallido = async () => {
          await Promise.all([anotarIntento("login", email), anotarIntento("login", ip)]);
          return null;
        };

        if (!usuario) return fallido();

        const valido = await bcrypt.compare(credentials.password, usuario.passwordHash);
        if (!valido) return fallido();

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          empresaId: usuario.empresaId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = user.rol;
        token.empresaId = user.empresaId;
        token.revisadoEn = Date.now();
        return token;
      }

      const caducado = !token.revisadoEn || Date.now() - token.revisadoEn > REVALIDAR_CADA_MS;

      // Releemos de la BD si falta la empresa (token emitido antes de que la app
      // fuera multi-empresa) o si toca revalidar. Así un usuario borrado o al que
      // le han cambiado el rol deja de tener acceso sin esperar a que expire.
      if (!token.empresaId || caducado) {
        const actual = token.id
          ? await prismaUnsafe.usuario.findUnique({
              where: { id: token.id },
              select: { empresaId: true, rol: true },
            })
          : null;

        // Sin usuario no devolvemos un token a medias: eso dejaría `empresaId`
        // vacío, que es justo el caso peligroso. Token vacío = sesión inválida.
        if (!actual) return {} as typeof token;

        token.empresaId = actual.empresaId;
        token.rol = actual.rol;
        token.revisadoEn = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      // Si el callback anterior invalidó el token, no montamos una sesión a medias.
      if (!token?.id || !token?.empresaId) return session;
      session.user.id = token.id;
      session.user.rol = token.rol;
      session.user.empresaId = token.empresaId;
      return session;
    },
  },
};
