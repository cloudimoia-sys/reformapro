/**
 * Imprimir un documento HTML sin abrir una ventana nueva.
 *
 * ANTES: `window.open("", "_blank")` + `document.write` + `print()`.
 *
 * Eso funciona en un navegador de escritorio y se rompe justo donde peor queda:
 * en la aplicación instalada en el móvil. Una PWA en modo `standalone` no tiene
 * barra de direcciones ni pestañas, así que no hay dónde poner esa ventana
 * nueva. Según el sistema, `window.open` devuelve `null` (y no pasa nada, que ya
 * es malo: el botón parece roto), abre una pestaña del navegador de fuera que
 * pierde la sesión, o tumba la aplicación entera. Un cliente lo describió como
 * "se cierra la app", y es literalmente lo que ocurría.
 *
 * AHORA se escribe el documento en un iframe oculto de la propia página y se
 * imprime ese iframe. No hay ventana que abrir, así que no hay nada que
 * bloquear: funciona igual en escritorio, en el navegador del móvil y en la
 * aplicación instalada. El diálogo del sistema ofrece "Guardar como PDF", que es
 * lo que la gente usa para guardar el documento.
 *
 * De paso desaparece el bloqueador de ventanas emergentes del escritorio, que
 * era otra vía por la que este botón no hacía nada sin explicar por qué.
 */

/** Cuánto se espera como mucho a que carguen las imágenes antes de imprimir. */
const ESPERA_MAXIMA_IMAGENES = 3000;

/**
 * El iframe se retira tarde a propósito.
 *
 * En Chrome el diálogo de impresión es asíncrono: `print()` vuelve enseguida y
 * el usuario todavía está eligiendo impresora. Quitar el iframe en ese momento
 * cancela la impresión y sale una hoja en blanco.
 */
const RETIRAR_A_LOS = 60000;

export function imprimirDocumento(html: string) {
  const marco = document.createElement("iframe");
  marco.setAttribute("aria-hidden", "true");
  marco.setAttribute("title", "Documento para imprimir");
  // Fuera de la vista, pero CON tamaño: un iframe de 0×0 imprime en blanco en
  // Safari, que decide que no hay nada que maquetar.
  marco.style.cssText =
    "position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;pointer-events:none";
  document.body.appendChild(marco);

  const doc = marco.contentWindow?.document;
  if (!doc) {
    marco.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const imprimir = () => {
    try {
      marco.contentWindow?.focus();
      marco.contentWindow?.print();
    } catch {
      // Si el navegador no deja imprimir, dejar el iframe puesto no arregla nada.
      marco.remove();
      return;
    }
    setTimeout(() => marco.remove(), RETIRAR_A_LOS);
  };

  /*
   * Se espera a las imágenes antes de imprimir.
   *
   * El logo de la empresa entra como data URI y tarda un instante en decodificar;
   * si se imprime antes, sale el documento sin logo. Antes se resolvía con un
   * `setTimeout` de 400 ms, que es adivinar: sobra cuando no hay logo y se queda
   * corto cuando lo hay y es grande.
   */
  const imagenes = Array.from(doc.images);
  const cargadas = Promise.all(
    imagenes.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((listo) => {
            // `onerror` también resuelve: una imagen que no carga no puede dejar
            // el documento sin imprimirse para siempre.
            img.onload = img.onerror = () => listo();
          })
    )
  );

  const tope = new Promise<void>((listo) => setTimeout(listo, ESPERA_MAXIMA_IMAGENES));
  Promise.race([cargadas, tope]).then(imprimir);
}
