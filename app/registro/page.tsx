import RegistroForm from "./RegistroForm";

export default function RegistroPage() {
  // Si hay código configurado en el servidor, el formulario lo pide. La comprobación
  // de verdad se hace igualmente en el servidor: esto solo decide si se ve el campo.
  return <RegistroForm pideCodigo={Boolean(process.env.REGISTRO_CODIGO)} />;
}
