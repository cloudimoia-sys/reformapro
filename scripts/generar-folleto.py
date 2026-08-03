"""
Genera el folleto comercial de ReformaPro en PDF.

  python scripts/generar-folleto.py

TRES PÁGINAS: qué resuelve, qué cuesta, y cómo se empieza.

REGLA AL ESCRIBIRLO: no prometer nada que la aplicación no haga. Nada de
"emite facturas" (no las emite), nada de "sincronizado con Google" a secas (el
refresco tarda), y la normativa se presenta como referencia y no como
certificación. Un folleto que promete de más se paga en la primera demo, que es
justo donde no puedes permitirte quedar mal.

LOS PRECIOS ESTÁN AQUÍ ARRIBA, en un solo sitio, para poder cambiarlos y volver
a generar sin buscarlos por el texto.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from marca import AMBAR, AZUL, GRIS, LINEA, OSCURO, TINTA, cinta, estilos, logotipo
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ANCHO, ALTO = A4
MARGEN = 18 * mm
E = estilos()
# El precio es tipografía grande: necesita su propio interlineado o pisa la línea
# de debajo.
E["precio"] = ParagraphStyle("precio", parent=E["p"], fontSize=27, leading=32, spaceAfter=0)
E["coletilla"] = ParagraphStyle("coletilla", parent=E["p"], fontSize=8.4, leading=11,
                                textColor=GRIS, spaceAfter=0)
# Mismo motivo que el precio: un titular de 21pt en un párrafo con interlineado de
# 14 se pisa a sí mismo en cuanto ocupa dos líneas.
E["titular"] = ParagraphStyle("titular", parent=E["p"], fontSize=21, leading=25,
                              textColor=AZUL, spaceAfter=0)
E["ladillo"] = ParagraphStyle("ladillo", parent=E["p"], fontSize=12, leading=15,
                              textColor=AZUL, spaceAfter=0)

# ─────────────────────────── Precios ───────────────────────────
PRECIO_BASICO = 19
PRECIO_PRO = 39
# Los primeros clientes entran a este precio y lo conservan mientras sigan.
FUNDADOR_BASICO = 15
FUNDADOR_PRO = 30
CUANTOS_FUNDADORES = 10
MESES_ANUAL = 10  # pagando el año se pagan 10 meses
DIAS_PRUEBA = 14


def p(t, estilo="p"):
    return Paragraph(t, E[estilo])


def punto(t, color=None):
    return Paragraph(t, E["li"], bulletText="•")


def decorar(c, doc):
    c.saveState()
    if doc.page == 1:
        c.setFillColor(AZUL)
        c.rect(0, ALTO - 62 * mm, ANCHO, 62 * mm, stroke=0, fill=1)
        logotipo(c, MARGEN, ALTO - 26 * mm, tam=30, claro=True)
        c.setFont("Helvetica", 12)
        c.setFillColor(colors.HexColor("#B9D2E6"))
        c.drawString(MARGEN, ALTO - 35 * mm, "Presupuestos, informes técnicos y obra para reformistas")
        cinta(c, 0, ALTO - 66 * mm, ANCHO, 4 * mm)
    else:
        cinta(c, MARGEN, ALTO - 14 * mm, ANCHO - 2 * MARGEN, 1.8 * mm)
        logotipo(c, MARGEN, ALTO - 12 * mm + 3.4 * mm, tam=9)

    c.setFont("Helvetica", 7.6)
    c.setFillColor(GRIS)
    c.drawString(MARGEN, 9 * mm, "reformapro.vercel.app")
    c.drawRightString(ANCHO - MARGEN, 9 * mm, "Precios sin IVA · Agosto de 2026")
    c.restoreState()


def bloque_plan(nombre, precio, coletilla, incluye, destacado=False):
    """Una columna de la tabla de planes."""
    fondo = colors.HexColor("#FCF6EA") if destacado else colors.white
    borde = AMBAR if destacado else LINEA

    filas = [
        [Paragraph(f'<font size="13" color="#1D4E6B"><b>{nombre}</b></font>', E["p"])],
        [Paragraph(f'<font color="#1D4E6B"><b>{precio} €</b></font>'
                   f'<font size="10" color="#5C6B76"> /mes</font>', E["precio"])],
        [Paragraph(coletilla, E["coletilla"])],
        [Spacer(1, 3 * mm)],
    ]
    filas += [[Paragraph(f"• {i}", E["li"])] for i in incluye]

    t = Table(filas, colWidths=[(ANCHO - 2 * MARGEN - 6 * mm) / 2], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fondo),
                ("BOX", (0, 0), (-1, -1), 1, borde),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (0, 0), 10),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
            ]
        )
    )
    return t


def pagina_1():
    return [
        Spacer(1, 50 * mm),
        Paragraph("<b>Un presupuesto de obra bien hecho, en diez minutos</b>", E["titular"]),
        Spacer(1, 4 * mm),
        p(
            "Presupuestar a mano son una o dos horas por obra, y aun así se escapan "
            "partidas. ReformaPro las escribe por ti <b>con tus precios</b>, avisa de lo que "
            "falta, y de ahí salen los informes, la planificación y el parte de obra para "
            "quien te factura."
        ),
        Spacer(1, 5 * mm),
        Paragraph("<b>Lo que de verdad cambia</b>", E["ladillo"]),
        Spacer(1, 2 * mm),
        punto("<b>Tus precios, no unos inventados.</b> Si el trabajo está en tu catálogo, se usa tu tarifa. El mismo trabajo sale siempre al mismo precio."),
        punto("<b>Te avisa de lo que se te olvida.</b> Una demolición sin su reposición, un capítulo que falta, una medición que no cuadra."),
        punto("<b>De la obra al documento.</b> Informes de patologías, dictámenes periciales, actas, certificados y memorias, con anexo de fotos."),
        punto("<b>Diagnóstico por foto.</b> Subes una humedad o una fisura y te dice qué puede ser y qué comprobar en la visita."),
        punto("<b>Planificación con fechas de verdad.</b> Días laborables, festivos y esperas de fraguado, contados por el programa."),
        punto("<b>En el móvil, en la obra.</b> Se instala desde el navegador y se dicta por voz con las manos sucias."),
        Spacer(1, 6 * mm),
        Table(
            [[Paragraph(
                '<font size="10.5" color="#7A5A10"><b>Un caso real.</b> Revisando el '
                "presupuesto de una vivienda nueva, la aplicación detectó entre "
                "<b>26.000 y 55.000 €</b> de trabajo sin presupuestar: acometidas, estudio "
                "geotécnico, ventilación y aporte renovable de ACS. Un solo error de esos, "
                "una vez en la vida, paga la suscripción durante décadas.</font>",
                E["p"],
            )]],
            colWidths=[ANCHO - 2 * MARGEN],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FCF0D8")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#EBD9A8")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 11),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                    ("TOPPADDING", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ]
            ),
        ),
    ]


def pagina_2():
    basico = [
        "Presupuestos con IA, sin límite",
        "Tu catálogo de precios y partidas propias",
        "Lectura de planos para las mediciones",
        "Avisos de lo que falta en el presupuesto",
        "Clientes, firma del cliente en pantalla",
        "Exportación a PDF, Word y Excel",
        "Dictado por voz",
        "1 usuario",
    ]
    pro = [
        "<b>Todo lo del plan Básico</b>, y además:",
        "Once tipos de documento técnico: periciales, actas, certificados, memorias, planes",
        "Diagnóstico de patologías por foto",
        "Copiloto técnico de normativa y cálculos",
        "Obras y planificación, con calendario",
        "Partes de obra ejecutada, exportados a Excel para quien factura",
        "Hasta 5 usuarios",
        "Soporte prioritario",
    ]

    tabla = Table(
        [[bloque_plan("Básico", PRECIO_BASICO, "para quien solo quiere presupuestar mejor", basico),
          bloque_plan("Pro", PRECIO_PRO, "para quien además hace informes y lleva obra", pro, destacado=True)]],
        colWidths=[(ANCHO - 2 * MARGEN) / 2 + 3 * mm, (ANCHO - 2 * MARGEN) / 2 - 3 * mm],
        style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                          ("RIGHTPADDING", (0, 0), (0, 0), 6), ("RIGHTPADDING", (1, 0), (1, 0), 0)]),
    )

    return [
        Paragraph("Planes y precios", E["h1"]),
        p("Por empresa, no por usuario. Sin permanencia: se cancela cuando se quiera."),
        Spacer(1, 4 * mm),
        tabla,
        Spacer(1, 5 * mm),
        Table(
            [[Paragraph(
                f'<font size="11" color="#1D4E6B"><b>Precio de fundador — para los '
                f"{CUANTOS_FUNDADORES} primeros</b></font><br/>"
                f'<font size="9.6" color="#1E2833">{FUNDADOR_BASICO} € el Básico y '
                f"{FUNDADOR_PRO} € el Pro, <b>congelados mientras sigas</b>. A cambio pido "
                "una cosa: que me cuentes lo que falla. La mitad de lo que hoy funciona "
                "bien está así porque un reformista avisó.</font>",
                E["p"],
            )]],
            colWidths=[ANCHO - 2 * MARGEN],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EEF3F7")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#C9D9E4")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 11),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                    ("TOPPADDING", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ]
            ),
        ),
        Spacer(1, 4 * mm),
        p(
            f"<b>Pagando el año, {MESES_ANUAL} meses.</b> Los otros dos son gratis. "
            "Precios sin IVA."
        ),
        p(
            f"<b>{DIAS_PRUEBA} días de prueba</b>, sin tarjeta y sin compromiso. Al terminar, "
            "la cuenta pasa a solo lectura: sigues viendo y descargando todo tu trabajo. "
            "<b>No se borra nada.</b>",
        ),
        Spacer(1, 6 * mm),
        Table(
            [[Paragraph(
                '<font size="9.6" color="#1E2833">Para que salga a cuenta, el plan Pro '
                "tiene que ahorrarte <b>una hora al mes</b>. Un presupuesto detallado a "
                "mano son una o dos. Con que hagas dos al mes, ya has pagado el año."
                "</font>",
                E["p"],
            )]],
            colWidths=[ANCHO - 2 * MARGEN],
            style=TableStyle(
                [
                    ("LINEABOVE", (0, 0), (-1, 0), 2, AMBAR),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                ]
            ),
        ),
    ]


def pagina_3():
    return [
        Paragraph("Cómo empezamos", E["h1"]),
        p(
            "No hace falta instalar nada ni migrar nada. La propuesta es sencilla y con "
            "fecha, para que ninguno de los dos perdamos el tiempo."
        ),
        Spacer(1, 2 * mm),
        Paragraph("1. Una demo con TU obra", E["h2"]),
        p(
            "Media hora. Trae un trabajo que estés a punto de presupuestar — no un ejemplo "
            "preparado. Sales de la reunión con ese presupuesto hecho y listo para mandar."
        ),
        Paragraph(f"2. {DIAS_PRUEBA} días para probarlo en serio", E["h2"]),
        p(
            "Con tus obras y tus precios. Mi objetivo para esos días es concreto: que saques "
            "<b>tres presupuestos reales</b> y se los mandes a clientes. Si al terminar no "
            "te ha ahorrado tiempo, no hay nada que hablar."
        ),
        Paragraph("3. El precio lo sabes desde el primer día", E["h2"]),
        p(
            "Nada de descubrirlo al final. Sabes lo que vas a pagar y cuándo empiezas a "
            "pagarlo antes de tocar la aplicación."
        ),
        Spacer(1, 5 * mm),
        Paragraph("Lo que ReformaPro NO hace", E["h1"]),
        p(
            "Lo pongo por escrito porque prefiero perder una venta a que te lleves una "
            "sorpresa después."
        ),
        punto(
            "<b>No emite facturas ni sustituye a tu programa de gestión.</b> Emitirlas es "
            "una actividad regulada. ReformaPro genera el <b>parte de obra ejecutada</b> —lo "
            "hecho, medido y valorado— y lo exporta a Excel, que es lo que abre cualquiera "
            "sin aprender nada. Tu gestoría o tu administrativa lo pasan a factura con el "
            "mismo gesto con el que llevan años pasando albaranes."
        ),
        punto(
            "<b>No sustituye a un técnico.</b> Los documentos que exigen firma la exigen "
            "igual, y el diagnóstico por foto dice qué comprobar, no sentencia."
        ),
        punto(
            "<b>No mide sobre un plano.</b> Lee las superficies que estén escritas en él y "
            "te las pone para que las confirmes. Estimar sobre el dibujo se equivoca, y "
            "prefiero un hueco a un número inventado."
        ),
        punto(
            "<b>No trabaja sin cobertura.</b> Los datos están en el servidor. Sin red puedes "
            "hacer fotos y subirlas después."
        ),
        punto(
            "<b>Los datos de normativa son referencia</b>, no certificación: contrástalos "
            "antes de ejecutar o de firmar."
        ),
        Spacer(1, 7 * mm),
        Table(
            [[Paragraph(
                '<font size="12" color="#FFFFFF"><b>¿Lo vemos con una obra tuya?</b></font><br/>'
                '<font size="9.6" color="#DCE7EF">Escríbeme y montamos la demo esta semana. '
                "Trae el trabajo que tengas encima de la mesa.</font><br/><br/>"
                '<font size="10.5" color="#E8A020"><b>reformapro.vercel.app</b></font>',
                E["p"],
            )]],
            colWidths=[ANCHO - 2 * MARGEN],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), AZUL),
                    ("LEFTPADDING", (0, 0), (-1, -1), 14),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                    ("TOPPADDING", (0, 0), (-1, -1), 13),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 13),
                ]
            ),
        ),
    ]


def main():
    salida = Path(__file__).resolve().parents[1] / "ReformaPro-folleto.pdf"
    doc = BaseDocTemplate(
        str(salida),
        pagesize=A4,
        title="ReformaPro — planes, precios y propuesta",
        author="ReformaPro",
        subject="Folleto comercial",
        leftMargin=MARGEN,
        rightMargin=MARGEN,
        topMargin=20 * mm,
        bottomMargin=16 * mm,
    )
    marco = Frame(MARGEN, 14 * mm, ANCHO - 2 * MARGEN, ALTO - 34 * mm, id="normal")
    doc.addPageTemplates([PageTemplate(id="todo", frames=[marco], onPage=decorar)])
    doc.build(pagina_1() + [PageBreak()] + pagina_2() + [PageBreak()] + pagina_3())
    print(f"Folleto generado: {salida}")


if __name__ == "__main__":
    main()
