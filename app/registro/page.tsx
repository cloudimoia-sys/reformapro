import RegistroForm from "./RegistroForm";

// Sin esto Next genera la página al compilar y lee REGISTRO_CODIGO en ese momento:
// cambiar la variable en Vercel no tendría efecto hasta volver a desplegar. Al
// marcarla dinámica se lee en cada visita, así que abrir o cerrar el registro es
// inmediato. (La comprobación de verdad ya ocurría en el servidor al enviar el
// formulario; esto solo decide si se ve el campo.)
export const dynamic = "force-dynamic";

export default function RegistroPage() {
  return <RegistroForm pideCodigo={Boolean(process.env.REGISTRO_CODIGO)} />;
}
