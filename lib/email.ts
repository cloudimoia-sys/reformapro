/**
 * Envío de email, indiferente al proveedor.
 *
 * Soporta Brevo y Resend según la clave que haya configurada:
 *
 * - BREVO_API_KEY  → recomendado si NO tienes dominio propio. Brevo deja verificar
 *   una única dirección remitente (tu Gmail) y enviar desde ahí.
 * - RESEND_API_KEY → requiere verificar un dominio entero, así que solo sirve si
 *   compras un dominio. Con el subdominio .vercel.app no se puede.
 *
 * Sin ninguna de las dos, el email se escribe por consola en vez de enviarse: en
 * desarrollo puedes seguir el enlace desde el terminal sin montar nada.
 */

type Email = {
  para: string;
  asunto: string;
  html: string;
  texto: string;
};

function remitente() {
  return {
    email: process.env.EMAIL_REMITENTE || "no-responder@reformapro.app",
    nombre: process.env.EMAIL_REMITENTE_NOMBRE || "ReformaPro",
  };
}

async function enviarConBrevo(m: Email, apiKey: string) {
  const de = remitente();
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { email: de.email, name: de.nombre },
      to: [{ email: m.para }],
      subject: m.asunto,
      htmlContent: m.html,
      textContent: m.texto,
    }),
  });
  if (!r.ok) throw new Error(`Brevo respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function enviarConResend(m: Email, apiKey: string) {
  const de = remitente();
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: `${de.nombre} <${de.email}>`,
      to: [m.para],
      subject: m.asunto,
      html: m.html,
      text: m.texto,
    }),
  });
  if (!r.ok) throw new Error(`Resend respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

export async function enviarEmail(m: Email) {
  const brevo = process.env.BREVO_API_KEY;
  const resend = process.env.RESEND_API_KEY;

  if (brevo) return enviarConBrevo(m, brevo);
  if (resend) return enviarConResend(m, resend);

  console.warn(
    `\n[email no enviado: falta BREVO_API_KEY o RESEND_API_KEY]\n` +
      `  Para:    ${m.para}\n  Asunto:  ${m.asunto}\n\n${m.texto}\n`
  );
}

/** Plantilla del correo de recuperación, con los colores de la app. */
export function emailRestablecer(nombre: string, enlace: string) {
  return {
    asunto: "Restablece tu contraseña de ReformaPro",
    texto:
      `Hola ${nombre}:\n\n` +
      `Has pedido restablecer tu contraseña de ReformaPro. Abre este enlace:\n\n${enlace}\n\n` +
      `El enlace caduca en 1 hora y solo se puede usar una vez.\n\n` +
      `Si no has sido tú, ignora este correo: tu contraseña no ha cambiado.`,
    html: `<div style="font-family:Arial,sans-serif;color:#1E2833;font-size:14px;line-height:1.6">
  <h2 style="color:#1D4E6B;border-bottom:4px solid #E8A020;padding-bottom:6px">ReformaPro</h2>
  <p>Hola ${nombre}:</p>
  <p>Has pedido restablecer tu contraseña. Pulsa el botón para elegir una nueva:</p>
  <p style="margin:24px 0">
    <a href="${enlace}" style="background:#1D4E6B;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;display:inline-block">Restablecer contraseña</a>
  </p>
  <p style="font-size:12px;color:#5C6B76">El enlace caduca en 1 hora y solo se puede usar una vez.<br>
  Si no has sido tú, ignora este correo: tu contraseña no ha cambiado.</p>
</div>`,
  };
}
