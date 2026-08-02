import Link from "next/link";
import { requireTenant } from "@/lib/session";
import { eur } from "@/lib/format";
import { totalPres, estadoClase, estadoLabel } from "@/lib/presupuesto";

export default async function PanelPage() {
  const { user, db } = await requireTenant();
  const isAdmin = user.rol === "ADMIN";

  const [totalPresupuestos, presupuestosAprobados, ultimos, facturas] = await Promise.all([
    db.presupuesto.count(),
    db.presupuesto.findMany({
      where: { estado: { in: ["APROBADO", "FACTURADO"] } },
      include: { lineas: true },
    }),
    db.presupuesto.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { lineas: true, cliente: true },
    }),
    isAdmin ? db.factura.findMany() : Promise.resolve([]),
  ]);

  const obraAprobada = presupuestosAprobados.reduce((s, p) => s + totalPres(p), 0);
  const pendienteCobro = facturas.filter((f) => f.estado === "PENDIENTE").reduce((s, f) => s + f.total, 0);
  const cobrado = facturas.filter((f) => f.estado === "PAGADA").reduce((s, f) => s + f.total, 0);
  const ivaRepercutido = facturas.reduce((s, f) => s + (f.base * f.iva) / 100, 0);

  return (
    <>
      <h1 style={{ fontSize: 30, marginBottom: 14 }}>Panel de control</h1>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="kpi">
          <div className="v">{totalPresupuestos}</div>
          <div className="l">Presupuestos</div>
        </div>
        <div className="kpi">
          <div className="v">{eur(obraAprobada)}</div>
          <div className="l">Obra aprobada</div>
        </div>
        {isAdmin && (
          <div className="kpi">
            <div className="v">{eur(pendienteCobro)}</div>
            <div className="l">Pendiente de cobro</div>
          </div>
        )}
        {isAdmin && (
          <div className="kpi">
            <div className="v">{eur(cobrado)}</div>
            <div className="l">Cobrado</div>
          </div>
        )}
        {isAdmin && (
          <div className="kpi">
            <div className="v">{eur(ivaRepercutido)}</div>
            <div className="l">IVA estimado</div>
          </div>
        )}
      </div>
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: 20 }}>Últimos presupuestos</h2>
          <div className="spacer" />
          <Link className="btn amber" href="/presupuestos">
            + Nuevo presupuesto
          </Link>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Obra</th>
              <th className="hidemob">Cliente</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {ultimos.map((x) => (
              <tr key={x.id} style={{ cursor: "pointer" }}>
                <td>
                  <Link href={`/presupuestos/${x.id}`}>{x.numero}</Link>
                </td>
                <td>{x.titulo}</td>
                <td className="hidemob">{x.cliente?.nombre || "—"}</td>
                <td className="linetotal">{eur(totalPres(x))}</td>
                <td>
                  <span className={`badge ${estadoClase(x.estado)}`}>{estadoLabel(x.estado)}</span>
                </td>
              </tr>
            ))}
            {!ultimos.length && (
              <tr>
                <td colSpan={5} className="hint">
                  Todavía no hay presupuestos. Crea el primero con el asistente IA.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
