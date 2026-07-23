export const eur = (n: number) =>
  isNaN(n) ? "—" : Number(n).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

export const hoy = () => new Date().toISOString().slice(0, 10);
