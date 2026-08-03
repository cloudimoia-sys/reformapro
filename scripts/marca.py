"""
Identidad visual compartida por los PDF que genera el proyecto.

Está en un fichero aparte para que la guía y el folleto no se vayan pareciendo
cada vez menos: el azul, el ámbar y la cinta de obra se definen una sola vez.

Los PDF se GENERAN, no se editan a mano. Cuando cambie un precio o una función,
se toca el script y se vuelve a generar; un PDF suelto en una carpeta se queda
viejo y acaba enseñándosele a un cliente con datos que ya no son.
"""

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm

AZUL = colors.HexColor("#1D4E6B")
AZUL_OSCURO = colors.HexColor("#153B52")
AMBAR = colors.HexColor("#E8A020")
OSCURO = colors.HexColor("#2A2007")
TINTA = colors.HexColor("#1E2833")
GRIS = colors.HexColor("#5C6B76")
LINEA = colors.HexColor("#DCE1DF")
FONDO = colors.HexColor("#F1F3F2")


def cinta(c, x, y, ancho, alto=4 * mm):
    """La cinta de obra de la aplicación: ámbar con franjas diagonales oscuras."""
    c.saveState()
    p = c.beginPath()
    p.rect(x, y, ancho, alto)
    c.clipPath(p, stroke=0)
    c.setFillColor(AMBAR)
    c.rect(x, y, ancho, alto, stroke=0, fill=1)
    c.setFillColor(OSCURO)
    paso = alto * 1.6
    i = -alto * 2
    while i < ancho + alto * 2:
        p = c.beginPath()
        p.moveTo(x + i, y)
        p.lineTo(x + i + paso / 2, y)
        p.lineTo(x + i + paso / 2 + alto, y + alto)
        p.lineTo(x + i + alto, y + alto)
        p.close()
        c.drawPath(p, stroke=0, fill=1)
        i += paso
    c.restoreState()


def logotipo(c, x, y, tam=17, claro=False):
    """ReformaPro: 'Reforma' en azul (o blanco) y 'Pro' en ámbar."""
    c.setFont("Helvetica-Bold", tam)
    c.setFillColor(colors.white if claro else AZUL)
    c.drawString(x, y, "Reforma")
    ancho = c.stringWidth("Reforma", "Helvetica-Bold", tam)
    c.setFillColor(AMBAR)
    c.drawString(x + ancho, y, "Pro")
    return ancho + c.stringWidth("Pro", "Helvetica-Bold", tam)


def estilos():
    """Estilos de texto, con interlineado generoso: esto se lee en una obra."""
    base = getSampleStyleSheet()
    e = {}
    e["h1"] = ParagraphStyle(
        "h1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=19,
        leading=23, textColor=AZUL, spaceBefore=16, spaceAfter=6,
    )
    e["h2"] = ParagraphStyle(
        "h2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=13,
        leading=16, textColor=AZUL, spaceBefore=13, spaceAfter=4,
    )
    e["p"] = ParagraphStyle(
        "p", parent=base["BodyText"], fontName="Helvetica", fontSize=9.6,
        leading=14, textColor=TINTA, spaceAfter=6, alignment=0,
    )
    e["hint"] = ParagraphStyle(
        "hint", parent=e["p"], fontSize=8.6, leading=12.5, textColor=GRIS,
    )
    e["li"] = ParagraphStyle(
        "li", parent=e["p"], leftIndent=9, bulletIndent=1, spaceAfter=3.5,
    )
    e["aviso"] = ParagraphStyle(
        "aviso", parent=e["p"], fontSize=9, leading=13, textColor=colors.HexColor("#7A5A10"),
        backColor=colors.HexColor("#FCF0D8"), borderPadding=7, spaceBefore=5, spaceAfter=8,
    )
    return e
