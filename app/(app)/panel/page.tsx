import Link from "next/link";
import { requireTenant } from "@/lib/session";
import { eur } from "@/lib/format";
import { totalPres, estadoClase, estadoLabel } from "@/lib/presupuesto";
import { totalesParte, estadoParteClase, estadoParteLabel } from "@/lib/parteTrabajo";
import { ETIQUETA_TIPO, type TipoInforme } from "@/lib/informe";
import BotonNuevoParte from "@/app/(app)/partes/BotonNuevoParte";

/** Cuántas filas se enseñan en cada apartado de "últimos". */
const CUANTOS = 6;

export default async function PanelPage() {
  const { user, db } = await requireTenant();
  const isAdmin = user.rol === "ADMIN";

  const [totalPresupuestos, presupuestosAprobados, ultimos, facturas, ultimosPartes, ultimosInformes] =
    await Promise.all([
      db.presupuesto.count(),
      db.presupuesto.findMany({
        where: { estado: { in: ["APROBADO", "FACTURADO"] } },
        include: { lineas: true },
      }),
      db.presupuesto.findMany({
        orderBy: { createdAt: "desc" },
        take: CUANTOS,
        include: { lineas: true, cliente: true },
      }),
      isAdmin ? db.factura.findMany() : Promise.resolve([]),
      db.parteTrabajo.findMany({
        orderBy: { fecha: "desc" },
        take: CUANTOS,
        include: {
          cliente: { select: { nombre: true } },
          // Solo lo justo para sumar horas e importe: traer las fotos aquí
          // cargaría megas de base64 en una pantalla que no las enseña.
          lineas: { select: { tipo: true, cantidad: true, precio: true } },
        },
      }),
      db.informe.findMany({
        orderBy: { createdAt: "desc" },
        take: CUANTOS,
        include: { cliente: { select: { nombre: true } } },
      }),
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

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: 20 }}>Últimos partes de trabajo</h2>
          <div className="spacer" />
          {/*
            Este SÍ crea el parte y entra directo al editor, en vez de llevar a
            la lista como los otros dos: un parte no necesita asistente ni
            elegir nada antes, y el técnico suele rellenarlo con el móvil recién
            salido de la obra. Un clic menos se nota ahí.
          */}
          <BotonNuevoParte />
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Parte</th>
              <th className="hidemob">Cliente</th>
              <th className="hidemob">Fecha</th>
              <th>Horas</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {ultimosPartes.map((x) => {
              const t = totalesParte(
                x.lineas as { tipo: "MANO_OBRA" | "MATERIAL"; cantidad: number; precio: number }[]
              );
              return (
                <tr key={x.id}>
                  <td>
                    <Link href={`/partes/${x.id}`}>{x.numero}</Link>
                  </td>
                  <td>{x.titulo}</td>
                  <td className="hidemob">{x.cliente?.nombre || "—"}</td>
                  <td className="hidemob">{x.fecha.toISOString().slice(0, 10)}</td>
                  <td>{t.horas ? `${t.horas} h` : "—"}</td>
                  <td className="linetotal">{eur(t.total)}</td>
                  <td>
                    <span className={`badge ${estadoParteClase(x.estado)}`}>{estadoParteLabel(x.estado)}</span>
                  </td>
                </tr>
              );
            })}
            {!ultimosPartes.length && (
              <tr>
                <td colSpan={7} className="hint">
                  Todavía no hay partes. Crea el primero al volver de una visita.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: 20 }}>Últimos informes</h2>
          <div className="spacer" />
          {/* Aquí sí se lleva a la lista: un informe se crea con el asistente,
              que necesita el tipo de documento y los datos antes de generar. */}
          <Link className="btn amber" href="/informes">
            + Nuevo informe
          </Link>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Informe</th>
              <th className="hidemob">Inmueble</th>
              <th className="hidemob">Cliente</th>
              <th className="hidemob">Tipo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {ultimosInformes.map((x) => (
              <tr key={x.id}>
                <td>
                  <Link href={`/informes/${x.id}`}>{x.numero}</Link>
                </td>
                <td>{x.titulo}</td>
                <td className="hidemob">{x.inmueble || "—"}</td>
                <td className="hidemob">{x.cliente?.nombre || "—"}</td>
                <td className="hidemob">
                  <span className="badge b-enviado">{ETIQUETA_TIPO[x.tipo as TipoInforme]}</span>
                </td>
                <td>
                  <span className={`badge ${x.estado === "FINALIZADO" ? "b-facturado" : ""}`}>
                    {x.estado === "FINALIZADO" ? "finalizado" : "borrador"}
                  </span>
                </td>
              </tr>
            ))}
            {!ultimosInformes.length && (
              <tr>
                <td colSpan={6} className="hint">
                  Todavía no hay informes. Crea el primero con el asistente IA.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
