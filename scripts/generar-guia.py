"""
Genera la guía de usuario de ReformaPro en PDF.

  python scripts/generar-guia.py

Se genera desde un script y no se escribe a mano por un motivo práctico: la
aplicación cambia cada semana. Un PDF suelto en una carpeta se queda viejo y
acaba en manos de un cliente contando cosas que ya no son así.

TONO: se le habla a un reformista, no a un informático. Frases cortas, sin
palabras de oficina, y diciendo lo que la aplicación NO hace tan claro como lo
que hace — que es lo que evita la llamada de teléfono enfadada.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from marca import AMBAR, AZUL, GRIS, LINEA, TINTA, cinta, estilos, logotipo
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ANCHO, ALTO = A4
MARGEN = 20 * mm
E = estilos()


def p(t):
    return Paragraph(t, E["p"])


def h2(t):
    return Paragraph(t, E["h2"])


def punto(t):
    return Paragraph(t, E["li"], bulletText="•")


def aviso(t):
    return Paragraph(t, E["aviso"])


def pasos(lista):
    """Pasos numerados, que es como se explica algo que hay que hacer."""
    return [Paragraph(t, E["li"], bulletText=f"{i}.") for i, t in enumerate(lista, 1)]


def decorar(c, doc):
    """Cabecera y pie de cada página."""
    c.saveState()
    if doc.page == 1:
        # Portada: banda azul arriba con el logotipo en blanco, cinta debajo.
        c.setFillColor(AZUL)
        c.rect(0, ALTO - 48 * mm, ANCHO, 48 * mm, stroke=0, fill=1)
        logotipo(c, MARGEN, ALTO - 32 * mm, tam=27, claro=True)
        cinta(c, 0, ALTO - 52 * mm, ANCHO, 4 * mm)
        # Y una banda al pie para que la página no quede desfondada.
        c.setFillColor(colors.HexColor("#EEF3F7"))
        c.rect(0, 0, ANCHO, 34 * mm, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(AZUL)
        c.drawString(MARGEN, 22 * mm, "reformapro.vercel.app")
        c.setFont("Helvetica", 8.6)
        c.setFillColor(GRIS)
        c.drawString(MARGEN, 17 * mm, "Presupuestos · Informes técnicos · Diagnóstico · Obras")
    else:
        cinta(c, MARGEN, ALTO - 14 * mm, ANCHO - 2 * MARGEN, 1.8 * mm)
        logotipo(c, MARGEN, ALTO - 12 * mm + 3.4 * mm, tam=9)
        c.setFont("Helvetica", 7.6)
        c.setFillColor(GRIS)
        c.drawRightString(ANCHO - MARGEN, ALTO - 12 * mm + 3.4 * mm, "Guía de usuario")

    if doc.page > 1:
        c.setStrokeColor(LINEA)
        c.setLineWidth(0.5)
        c.line(MARGEN, 14 * mm, ANCHO - MARGEN, 14 * mm)
        c.setFont("Helvetica", 7.6)
        c.setFillColor(GRIS)
        c.drawString(MARGEN, 10 * mm, "reformapro.vercel.app")
        c.drawRightString(ANCHO - MARGEN, 10 * mm, f"{doc.page}")
    c.restoreState()


def caja(titulo, filas, anchos):
    """Tabla con cabecera azul, para las listas de datos."""
    datos = [[Paragraph(f"<b>{titulo}</b>", E["p"])]] if titulo else []
    datos += filas
    t = Table(datos if not titulo else filas, colWidths=anchos, hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
                ("TEXTCOLOR", (0, 0), (-1, -1), TINTA),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINEA),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (0, -1), 0),
            ]
        )
    )
    return t


def portada():
    return [
        Spacer(1, 34 * mm),
        Paragraph(
            '<font size="30" color="#1D4E6B"><b>Guía de uso</b></font>', E["p"]
        ),
        Spacer(1, 3 * mm),
        Paragraph(
            '<font size="14" color="#5C6B76">Presupuestos, informes y obra '
            "para reformistas</font>",
            E["p"],
        ),
        Spacer(1, 10 * mm),
        p(
            "Esta guía va por orden de uso: primero lo que hay que dejar preparado una vez, "
            "y después cada herramienta por separado. No hace falta leerla entera para "
            "empezar — con los dos primeros apartados ya se puede sacar un presupuesto."
        ),
        Spacer(1, 4 * mm),
        aviso(
            "<b>Una idea que conviene entender antes de empezar.</b> En ReformaPro la IA "
            "solo escribe; los números los hace el programa. Los precios salen de tu "
            "catálogo, las mediciones de lo que tú confirmas y los plazos de un calendario "
            "laboral. Por eso el mismo trabajo sale siempre al mismo precio, y por eso "
            "cuando algo no lo sabe, lo dice en vez de inventárselo."
        ),
        Spacer(1, 8 * mm),
        Paragraph('<font size="11" color="#1D4E6B"><b>Lo que hay dentro</b></font>', E["p"]),
        Spacer(1, 1 * mm),
        caja(
            None,
            [
                [p("<b>1</b>"), p("Tu empresa y tu catálogo de precios")],
                [p("<b>2</b>"), p("Presupuestos con IA, plano y firma del cliente")],
                [p("<b>3</b>"), p("Informes y once tipos de documento técnico")],
                [p("<b>4</b>"), p("Diagnóstico de patologías por foto")],
                [p("<b>5</b>"), p("Copiloto técnico de normativa y cálculos")],
                [p("<b>6</b>"), p("Obras, planificación y calendario")],
                [p("<b>7</b>"), p("Facturación: cómo pasa a tu programa")],
                [p("<b>8-10</b>"), p("Dictado, instalación en el móvil y equipo")],
            ],
            [12 * mm, ANCHO - 2 * MARGEN - 12 * mm],
        ),
    ]


def contenido():
    s = []

    s += [Paragraph("1. Lo primero: deja preparada tu empresa", E["h1"])]
    s += [
        p(
            "Entra en <b>Mi empresa</b> y rellena los datos. Los tres que más importan y "
            "que suelen olvidarse son <b>código postal, población y provincia</b>: sin "
            "ellos, la exportación a tu programa de facturación no funciona."
        ),
        p(
            "Pon también tu <b>margen por defecto</b> (gastos generales y beneficio "
            "industrial). Es el porcentaje que se suma a la base de todos los presupuestos "
            "nuevos. Puedes cambiarlo obra por obra."
        ),
        p("Si subes tu logo, sale en los documentos que entregas."),
    ]

    s += [h2("Tu catálogo: aquí es donde ganas tiempo")]
    s += [
        p(
            "En <b>Catálogo</b> guardas dos cosas distintas:"
        ),
        punto(
            "<b>Materiales</b>, con su proveedor y su precio de tarifa."
        ),
        punto(
            "<b>Partidas propias</b>: unidades de obra que tú ya tienes tarifadas "
            "—cambiar un plato de ducha, dejar un punto nuevo de agua— con la mano de "
            "obra incluida."
        ),
        Spacer(1, 2 * mm),
        p(
            "Merece la pena dedicarle un rato el primer día. Cuando pides un presupuesto, "
            "<b>si el trabajo está en tu catálogo se usa tu precio</b>, no uno inventado. "
            "Es la diferencia entre un presupuesto que revisas y uno que rehaces."
        ),
        aviso(
            "Tus partidas solo se meten <b>cuando el trabajo pedido es ese</b>. Si pides "
            "alicatar un aseo, no te va a colar un plato de ducha porque lo tengas en el "
            "catálogo."
        ),
    ]

    s += [Paragraph("2. Presupuestos", E["h1"])]
    s += [
        p(
            "Desde <b>Presupuestos → Nuevo</b>, el asistente te pide que describas la obra "
            "con tus palabras. Cuanto más concreto seas con las <b>mediciones</b>, mejor "
            "sale: no es lo mismo «alicatar el baño» que «alicatar 12 m2 de paredes de "
            "baño»."
        ),
    ]
    s += pasos(
        [
            "Describe la obra. Puedes dictarla con el botón del micrófono.",
            "Elige la calidad y si el cliente aporta el material.",
            "Si tienes plano, súbelo: se leen las superficies escritas en él y las confirmas tú antes de seguir.",
            "Revisa las partidas, ajusta lo que quieras y guarda.",
        ]
    )
    s += [
        Spacer(1, 2 * mm),
        p(
            "Después puedes exportarlo a <b>PDF, Word o Excel</b>, mandarlo por correo y "
            "recoger la <b>firma del cliente</b> en la pantalla."
        ),
    ]

    s += [h2("Los avisos que salen al generar")]
    s += [
        p(
            "Si el presupuesto se deja algo, la aplicación te lo dice. Los avisos más "
            "frecuentes y lo que significan:"
        ),
        caja(
            None,
            [
                [Paragraph("<b>Falta reponer</b>", E["p"]), p("Hay una demolición o un picado sin su partida de reposición. Todo lo que se pica, se repone: si no está, la obra se abre y no se cierra, y esa diferencia la acabas pagando tú.")],
                [Paragraph("<b>Faltan capítulos</b>", E["p"]), p("En una obra de ese tipo faltan trabajos habituales. Sale, por ejemplo, si presupuestas una vivienda nueva sin acometidas ni estudio geotécnico.")],
                [Paragraph("<b>Medición sospechosa</b>", E["p"]), p("Una cantidad no cuadra con lo que pediste. Repásala antes de mandarlo.")],
            ],
            [32 * mm, ANCHO - 2 * MARGEN - 32 * mm],
        ),
        Spacer(1, 3 * mm),
        p(
            "Léelos. Nacieron de presupuestos reales a los que les faltaba trabajo por "
            "valor de decenas de miles de euros."
        ),
    ]

    s += [Paragraph("3. Informes y documentos técnicos", E["h1"])]
    s += [
        p(
            "En <b>Informes</b> se redactan once tipos de documento, cada uno con la "
            "estructura que le corresponde:"
        ),
        caja(
            None,
            [
                [Paragraph("<b>Informes técnicos</b>", E["p"]), p("Informe de patologías · Dictamen pericial")],
                [Paragraph("<b>Actas</b>", E["p"]), p("Acta de visita de obra · Acta de recepción y entrega")],
                [Paragraph("<b>Certificados</b>", E["p"]), p("Certificado técnico de obra · Certificación de obra ejecutada")],
                [Paragraph("<b>Documentación</b>", E["p"]), p("Memoria técnica · Plan de trabajo")],
                [Paragraph("<b>Escritos</b>", E["p"]), p("Reclamación formal · Carta a la aseguradora · Solicitud al ayuntamiento")],
            ],
            [34 * mm, ANCHO - 2 * MARGEN - 34 * mm],
        ),
        Spacer(1, 3 * mm),
        p(
            "Puedes adjuntar <b>fotos y planos</b>, que se analizan y salen en el anexo "
            "fotográfico con su pie. Los que llevan presupuesto lo generan aparte. Todo se "
            "exporta a <b>Word, Excel y PDF</b>."
        ),
        aviso(
            "<b>Un dictamen pericial lo firma un técnico competente</b>, que jura bajo el "
            "artículo 335 de la Ley de Enjuiciamiento Civil y responde de su contenido. La "
            "aplicación te redacta el documento; la responsabilidad de firmarlo es de quien "
            "lo firma."
        ),
    ]

    s += [h2("4. Diagnóstico por foto")]
    s += [
        p(
            "Subes fotos de una lesión, contestas cinco preguntas y te dice qué puede ser. "
            "Las preguntas son las que de verdad deciden: <b>cuándo aparece, en qué planta, "
            "qué hay encima, si el paramento da al exterior y si hay obra al lado</b>."
        ),
        p(
            "Ten claro esto: <b>una foto no cierra un diagnóstico</b>. En una imagen, una "
            "condensación y una filtración de fachada son la misma mancha oscura. Por eso "
            "lo normal es que te diga «es esto o esto otro» y te dé <b>qué comprobar en la "
            "visita</b> para saber cuál. Eso es lo útil, no un veredicto rápido."
        ),
        p(
            "Cuando el asunto se sale de lo que resuelve un reformista —una flecha de "
            "forjado, una armadura corroída— te lo dice expresamente."
        ),
    ]

    s += [Paragraph("5. Copiloto técnico", E["h1"])]
    s += [
        p(
            "Preguntas de obra: pendientes de saneamiento, secciones de cable, caudales de "
            "ventilación, cuántos sacos de cemento para tantos metros. Responde con la "
            "<b>fuente citada</b> y, cuando es un cálculo, con el desglose a la vista para "
            "que puedas rehacerlo a mano."
        ),
        p(
            "Si abres el copiloto teniendo un presupuesto delante, conoce sus partidas y "
            "coge de ahí las mediciones."
        ),
        aviso(
            "<b>Contesta a menos cosas de las que le preguntarías a un buscador, y es a "
            "propósito.</b> Solo responde con datos cargados y comprobados; lo que no tiene, "
            "lo dice. Un asistente que contesta a todo y acierta el 90 % obliga a "
            "comprobarle cada respuesta, y entonces no ahorra nada.<br/><br/>"
            "Los valores de normativa están marcados como <b>pendientes de contrastar</b> "
            "mientras no los revise un técnico contra el texto oficial. Úsalos de "
            "referencia, no como justificación ante una inspección."
        ),
    ]

    s += [h2("6. Obras y planificación")]
    s += [
        p(
            "Creas la obra desde cero o <b>a partir de un presupuesto aprobado</b>, que te "
            "monta una fase por capítulo, ordenadas por oficio y con las esperas de "
            "fraguado puestas."
        ),
        p("Las fechas se calculan solas, y cuentan bien las tres cosas que se cuentan mal a mano:"),
        punto("<b>Días laborables</b>: cinco jornadas desde un jueves acaban el miércoles siguiente."),
        punto("<b>Festivos</b>, con la Semana Santa calculada cada año."),
        punto("<b>Las esperas de fraguado en días de calendario</b>: el hormigón fragua también en domingo."),
        Spacer(1, 2 * mm),
        p(
            "Los <b>festivos autonómicos y locales los pones tú</b> en la ficha de la obra. "
            "No hay forma de adivinar el calendario de cada municipio, y sin ellos la fecha "
            "de entrega sale optimista."
        ),
        p(
            "En ámbar se marca el <b>camino crítico</b>: las fases que, si se retrasan un "
            "día, retrasan la entrega un día. Lo demás tiene holgura."
        ),
    ]

    s += [h2("Llevarlo al calendario del móvil")]
    s += [
        p(
            "Cada obra publica un enlace que puedes pegar en Google Calendar, Apple "
            "Calendar u Outlook. Hay dos formas y no hacen lo mismo:"
        ),
        punto(
            "<b>Suscripción</b> (el enlace): se actualiza sola cuando cambias la "
            "planificación, pero <b>Google refresca cuando le parece y puede tardar "
            "horas</b>. Vale para tener la obra a la vista, no para enterarte de un cambio "
            "de mañana."
        ),
        punto(
            "<b>Descarga del archivo</b>: entra al instante, pero es una foto fija. Si "
            "luego mueves el inicio de la obra, esos eventos se quedan como estaban."
        ),
        Spacer(1, 2 * mm),
        p(
            "Quien tenga ese enlace ve el calendario sin contraseña: fases y fechas, nada "
            "de clientes ni de importes. Aun así, mándalo solo a quien deba verlo — y si "
            "hace falta, genera uno nuevo y el anterior deja de funcionar."
        ),
    ]

    s += [Paragraph("7. Facturación", E["h1"])]
    s += [
        p(
            "<b>ReformaPro no emite facturas.</b> Desde un presupuesto aprobado, «Generar "
            "parte de obra» crea el detalle de lo ejecutado —medido y valorado— para que la "
            "factura la emita tu programa o tu gestoría. Es el mismo papel que cumple un "
            "albarán, y por eso encaja sin que nadie cambie de costumbres."
        ),
        p("Salidas, por orden de utilidad real:"),
        punto("<b>Excel</b>: empieza por aquí. Lo abre cualquiera, se lee de un vistazo y se copia. Es lo que de verdad usa quien luego hace la factura."),
        punto("<b>Exportar todo a Excel</b>: el mes entero de una vez, para pasárselo a la gestoría."),
        punto("<b>PDF y Word</b>: el parte para leer o firmar."),
        punto("<b>Facturae (XML)</b>: el estándar español. Algunos programas lo importan y otros ni lo miran — pruébalo una vez con el tuyo antes de contar con ello."),
        Spacer(1, 2 * mm),
        aviso(
            "<b>Por qué no factura.</b> Emitir facturas en España es una actividad regulada: "
            "el programa que las emite tiene que cumplir requisitos de registro inalterable "
            "y llevar su código QR. Quien numera, guarda el registro y responde ante "
            "Hacienda es tu programa de facturación — no éste. Lo que te ahorra ReformaPro "
            "es teclear los datos dos veces."
        ),
        p(
            "El PDF del parte lleva impreso que <b>no tiene validez fiscal</b>. No se "
            "lo entregues a un cliente como si fuera la factura."
        ),
    ]

    s += [h2("8. Dictado por voz")]
    s += [
        p(
            "El botón del micrófono aparece en los campos largos. Grabas hablando normal, "
            "pulsas Parar y el texto aparece escrito. Entiende vocabulario de obra: dices "
            "«cuarenta y cinco grados» y escribe «45º»."
        ),
        p(
            "Corta solo al minuto. El audio se manda a transcribir y no se guarda en "
            "ninguna parte."
        ),
    ]

    s += [h2("9. Instalarla en el móvil")]
    s += [
        p(
            "No está en Google Play ni en la App Store: se instala <b>desde el propio "
            "navegador</b> y queda como un icono más, a pantalla completa."
        ),
        punto("<b>Android</b>: sale un aviso con el botón «Instalar». Si no, menú del navegador → «Instalar aplicación»."),
        punto("<b>iPhone</b>: botón de Compartir → «Añadir a pantalla de inicio»."),
        Spacer(1, 2 * mm),
        p(
            "Sin cobertura la aplicación no funciona —los datos están en el servidor— pero "
            "te lo dice con una pantalla clara en vez de dejarte a medias. Puedes seguir "
            "haciendo fotos con la cámara y subirlas después."
        ),
    ]

    s += [h2("10. Tu equipo")]
    s += [
        p(
            "En <b>Equipo</b> das de alta a los tuyos. Hay dos permisos: <b>administrador</b>, "
            "que lo ve todo incluida la facturación y el equipo, y <b>empleado</b>, que "
            "trabaja con presupuestos, obras e informes pero no toca ni las facturas ni las "
            "altas."
        ),
        p(
            "Cada empresa ve <b>únicamente sus datos</b>. Es lo que más comprobado está de "
            "toda la aplicación."
        ),
    ]

    s += [PageBreak(), Paragraph("Conviene que sepas", E["h1"])]
    s += [
        p(
            "Lo de abajo no son pegas escondidas en la letra pequeña: son los límites "
            "reales, y saberlos evita disgustos."
        ),
        h2("La IA se equivoca, y por eso hay avisos"),
        p(
            "Todo lo que genera es un <b>borrador que tienes que revisar</b>. El programa "
            "pone las barreras donde puede —precios de tu catálogo, cálculos en código, "
            "avisos de lo que falta— pero el que firma eres tú."
        ),
        h2("Qué sale de tu dispositivo"),
        p(
            "Las descripciones, las fotos de obra y los dictados se mandan a Google para "
            "procesarlos, igual que hace cualquier aplicación con IA. No se guardan allí y "
            "el audio se descarta tras transcribirlo. Tenlo en cuenta antes de subir algo "
            "delicado."
        ),
        h2("La normativa está pendiente de revisión"),
        p(
            "Los valores del copiloto están transcritos de la normativa vigente, pero "
            "mientras no los contraste un técnico salen marcados como pendientes. "
            "Contrástalos antes de ejecutar o de firmar."
        ),
        h2("Si te quedas sin cuenta"),
        p(
            "Cuando termina el periodo de prueba, la cuenta pasa a <b>solo lectura</b>: "
            "sigues viendo y descargando todo tu trabajo, y no puedes crear nada nuevo. "
            "<b>No se borra nada.</b>"
        ),
        Spacer(1, 6 * mm),
        Paragraph(
            '<font color="#5C6B76" size="9">¿Algo no funciona o no se entiende? '
            "Cuéntalo — la mitad de lo que hay en esta guía existe porque un reformista "
            "avisó de que algo estaba mal.</font>",
            E["p"],
        ),
    ]
    return s


def main():
    salida = Path(__file__).resolve().parents[1] / "Guia-ReformaPro.pdf"
    doc = BaseDocTemplate(
        str(salida),
        pagesize=A4,
        title="Guía de uso de ReformaPro",
        author="ReformaPro",
        subject="Guía de usuario",
        leftMargin=MARGEN,
        rightMargin=MARGEN,
        topMargin=22 * mm,
        bottomMargin=20 * mm,
    )
    marco = Frame(MARGEN, 18 * mm, ANCHO - 2 * MARGEN, ALTO - 40 * mm, id="normal")
    doc.addPageTemplates([PageTemplate(id="todo", frames=[marco], onPage=decorar)])
    doc.build(portada() + [PageBreak()] + contenido())
    print(f"Guía generada: {salida}")


if __name__ == "__main__":
    main()
