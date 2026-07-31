/**
 * Comprobación puntual de precio: descarga la ficha de producto de la URL guardada
 * y extrae el precio de los datos estructurados schema.org (JSON-LD) que casi todas
 * las tiendas online incluyen. No hay API pública de estos proveedores — esto es lo
 * mismo que abrir la página en el navegador y mirar el precio, solo que lo hace el
 * servidor bajo demanda cuando el usuario pulsa el botón. No se guarda ni programa
 * ninguna descarga periódica.
 */

function numeroValido(n: unknown): n is number {
  return typeof n === "number" && isFinite(n) && n > 0;
}

/** Convierte "1.234,56", "6,10" o "6.10" (formatos español/inglés mezclados) a número. */
function textoAPrecio(texto: string): number | null {
  const limpio = texto.replace(/[^\d.,]/g, "").trim();
  if (!limpio) return null;
  let normalizado = limpio;
  if (limpio.includes(",") && limpio.includes(".")) {
    // El último separador es el decimal; el otro son miles.
    normalizado = limpio.lastIndexOf(",") > limpio.lastIndexOf(".")
      ? limpio.replace(/\./g, "").replace(",", ".")
      : limpio.replace(/,/g, "");
  } else if (limpio.includes(",")) {
    normalizado = limpio.replace(",", ".");
  }
  const n = Number(normalizado);
  return numeroValido(n) ? n : null;
}

function aNumero(v: unknown): number | null {
  if (numeroValido(v)) return v;
  if (typeof v === "string") return textoAPrecio(v);
  return null;
}

/** Busca recursivamente un precio dentro de un nodo JSON-LD (Product, Offer, @graph...). */
function buscarPrecio(nodo: unknown, profundidad = 0): number | null {
  if (!nodo || typeof nodo !== "object" || profundidad > 6) return null;

  if (Array.isArray(nodo)) {
    for (const item of nodo) {
      const p = buscarPrecio(item, profundidad + 1);
      if (p !== null) return p;
    }
    return null;
  }

  const obj = nodo as Record<string, unknown>;

  const directo = aNumero(obj.price) ?? aNumero(obj.lowPrice);
  if (directo !== null) return directo;

  for (const clave of ["offers", "@graph", "priceSpecification"]) {
    if (obj[clave] !== undefined) {
      const p = buscarPrecio(obj[clave], profundidad + 1);
      if (p !== null) return p;
    }
  }

  return null;
}

/** Plan B: Microdata (`itemprop="price"`), muy común en tiendas PrestaShop/WooCommerce que no usan JSON-LD. */
function extraerPrecioDeMicrodata(html: string): number | null {
  // Caso 1: el valor va en el atributo content del propio tag ( <meta itemprop="price" content="6.10"> )
  const conContent = html.match(/<[^>]+itemprop=["']price["'][^>]*content=["']([^"']+)["']/i);
  if (conContent) {
    const p = textoAPrecio(conContent[1]);
    if (p !== null) return p;
  }
  // Caso 2: el valor es el texto visible del tag ( <span itemprop="price">6,10 €</span> )
  const conTexto = html.match(/<[^>]+itemprop=["']price["'][^>]*>([^<]+)</i);
  if (conTexto) {
    const p = textoAPrecio(conTexto[1]);
    if (p !== null) return p;
  }
  return null;
}

function extraerPrecioDeHTML(html: string): number | null {
  const bloques = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of bloques) {
    try {
      const json = JSON.parse(m[1].trim());
      const precio = buscarPrecio(json);
      if (precio !== null) return precio;
    } catch {
      // JSON-LD mal formado en esa página; probamos el siguiente bloque.
    }
  }
  return extraerPrecioDeMicrodata(html);
}

/**
 * Códigos con los que una tienda dice "no quiero peticiones automáticas".
 *
 * Las grandes cadenas españolas (Obramat, Leroy Merlin, Bricomart, Bauhaus,
 * Brico Depot) responden 403 a cualquier petición que no venga de un navegador
 * real, por muchas cabeceras que se le pongan: está comprobado. Es una decisión
 * suya y se respeta — no se intenta esquivar. Lo único que cambia es que el
 * usuario reciba un motivo claro y sepa qué hacer, en vez de un número de error.
 */
const BLOQUEO = new Set([401, 403, 429]);

export class TiendaBloquea extends Error {
  constructor() {
    super("Esta tienda no permite consultar el precio de forma automática. Abre su ficha y actualiza el precio a mano.");
    this.name = "TiendaBloquea";
  }
}

export async function comprobarPrecioUrl(url: string): Promise<number> {
  let r: Response;
  try {
    r = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
      },
    });
  } catch (e: any) {
    const lento = e?.name === "TimeoutError" || e?.name === "AbortError";
    throw new Error(
      lento
        ? "La tienda tardó demasiado en responder. Inténtalo de nuevo."
        : "No se pudo conectar con la tienda. Comprueba que la dirección sigue siendo válida."
    );
  }

  if (BLOQUEO.has(r.status)) throw new TiendaBloquea();
  if (r.status === 404) throw new Error("Esa página ya no existe. Puede que el producto se haya retirado.");
  if (!r.ok) throw new Error(`La tienda respondió con un error (${r.status}).`);

  const html = await r.text();
  const precio = extraerPrecioDeHTML(html);
  if (precio === null) {
    throw new Error("No se encontró un precio reconocible en esa página. Actualízalo a mano.");
  }
  return precio;
}
