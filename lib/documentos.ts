/**
 * Catálogo de documentos que sabe redactar la aplicación.
 *
 * Se definen en una tabla y no repartidos por el código para que añadir un
 * documento nuevo sea escribir una entrada aquí: el asistente, el prompt y la
 * exportación leen todos de esta lista. Cada guion está sacado de la práctica
 * profesional española, no inventado.
 */

export type TipoDocumento =
  | "PATOLOGIAS"
  | "PERICIAL"
  | "ACTA_VISITA"
  | "ACTA_ENTREGA"
  | "CERTIFICADO_OBRA"
  | "MEMORIA_TECNICA"
  | "PLAN_TRABAJO"
  | "CERTIFICACION"
  | "RECLAMACION"
  | "CARTA_SEGURO"
  | "SOLICITUD_AYUNTAMIENTO";

export type DefinicionDocumento = {
  etiqueta: string;
  /** Familia con la que se agrupa en el desplegable del asistente. */
  grupo: string;
  /** Qué pedirle al usuario en el campo grande, en lugar de "daños observados". */
  pregunta: string;
  ejemplo: string;
  /** Apartados, en el orden y con la numeración con que deben salir. */
  guion: string;
  /** Si lleva presupuesto de partidas. Un acta de visita no lo lleva. */
  conPresupuesto: boolean;
  /** Si lo firma un técnico con titulación y número de colegiado. */
  conTecnico: boolean;
  /** Aviso que se le enseña al usuario antes de generar, cuando conviene. */
  advertencia?: string;
};

export const DOCUMENTOS: Record<TipoDocumento, DefinicionDocumento> = {
  PATOLOGIAS: {
    etiqueta: "Informe técnico de patologías",
    grupo: "Informes técnicos",
    pregunta: "Daños observados: descríbelos con detalle",
    ejemplo:
      "Fisuras a 45º en tabiquería de planta primera, más abiertas hacia la medianera; desnivel en el solado del salón; puerta de paso que roza.",
    conPresupuesto: true,
    conTecnico: true,
    guion: `
1. ANTECEDENTES Y OBJETO DEL INFORME — qué se inspecciona y por qué.
2. DESCRIPCIÓN TÉCNICA DE LOS DESPERFECTOS — un subapartado por elemento afectado, cada uno con Ubicación, Patología, Efectos colaterales, Causa origen y Evolución previsible.
3. VALORACIÓN TÉCNICA Y DIAGNÓSTICO DE RIESGOS — un subapartado por elemento, empezando por "NIVEL DE GRAVEDAD: BAJO|MODERADO|ALTO|MUY ALTO" y el riesgo concreto.
4. PROPUESTA DE ACTUACIÓN Y PLAN DE REMEDIACIÓN — fases ordenadas por urgencia, con la solución constructiva concreta y su justificación.
5. VALORACIÓN ECONÓMICA ESTIMADA — se genera de las partidas, no lo redactes como texto.
6. CONCLUSIÓN DEL INFORME — criterio seguido y recomendación.`,
  },

  PERICIAL: {
    etiqueta: "Dictamen pericial",
    grupo: "Informes técnicos",
    pregunta: "Daños y hechos objeto del dictamen",
    ejemplo:
      "Fisuras a 45º en planta primera tras el vaciado de la parcela colindante. Desnivel en solado. Grieta vertical en fachada junto a la medianera.",
    conPresupuesto: true,
    conTecnico: true,
    advertencia:
      "Un dictamen pericial lo firma un técnico competente que jura bajo el art. 335 LEC y responde penalmente de su contenido.",
    guion: `
1. IDENTIFICACIÓN — datos del técnico redactor y su formación, solicitante del dictamen y ubicación del inmueble.
2. OBJETO Y ALCANCE — qué cuestiones se pide resolver y, muy importante, hasta dónde llega el informe: qué NO se ha podido comprobar y por qué.
3. ANTECEDENTES — hechos previos relevantes en orden cronológico.
4. PERITO, JURAMENTO Y DECLARACIÓN DE TACHAS — juramento del art. 335 LEC y declaración de no incurrir en las causas de tacha del art. 343 LEC.
5. INTERVINIENTES — agentes de la edificación conocidos. Si no constan, dilo expresamente.
6. DOCUMENTACIÓN CONSULTADA Y NORMATIVA APLICADA — documentos examinados y normativa en que se apoya (CTE y sus DB, EHE-08, NTE, UNE). Solo la que aplique.
7. CONSIDERACIONES PRELIMINARES — criterios y definiciones necesarios para entender el estudio.
8. TIPOLOGÍA ESTRUCTURAL Y CONSTRUCTIVA — descripción del inmueble y su cimentación.
9. INSPECCIÓN OCULAR E IDENTIFICACIÓN DE DAÑOS — fecha, alcance y descripción de cada lesión.
10. METODOLOGÍA — cómo se ha analizado (inspección visual, catas, testigos, nivelación, cálculo).
11. ORIGEN DE LAS LESIONES Y ANÁLISIS DE CAUSAS — relación causa-efecto y causas concurrentes.
12. CONCLUSIONES SOBRE LA LESIÓN Y SU REPARACIÓN — límites admisibles y solución.
13. MEDICIÓN Y PRESUPUESTO DE REPARACIÓN — se genera de las partidas, no lo redactes como texto.
14. ANEXO DE CÁLCULO — justificación numérica cuando proceda; si no procede, dilo.`,
  },

  ACTA_VISITA: {
    etiqueta: "Acta de visita de obra",
    grupo: "Actas y seguimiento",
    pregunta: "¿Qué se ha visto y decidido en la visita?",
    ejemplo:
      "Visita del 12 de marzo. Ejecutada la tabiquería de planta baja. Se detecta desviación en el hueco de la ventana del salón. Se acuerda replantear antes de continuar. Falta el material de fontanería.",
    conPresupuesto: false,
    conTecnico: true,
    guion: `
1. DATOS DE LA VISITA — fecha, hora, obra y asistentes con su papel (propiedad, contrata, dirección facultativa).
2. ESTADO DE LA OBRA — qué está ejecutado y en qué fase, por capítulos.
3. INCIDENCIAS DETECTADAS — cada una con su ubicación, qué se ha observado y su repercusión en plazo o coste.
4. INSTRUCCIONES Y DECISIONES — lo que se ordena ejecutar, quién lo asume y en qué plazo. Una línea por decisión, con responsable.
5. PENDIENTE PARA LA PRÓXIMA VISITA — lo que debe estar resuelto y lo que hay que comprobar.
6. OBSERVACIONES — lo que no encaje en lo anterior; si no hay nada, dilo.`,
  },

  ACTA_ENTREGA: {
    etiqueta: "Acta de recepción y entrega de obra",
    grupo: "Actas y seguimiento",
    pregunta: "¿Qué se entrega y en qué estado?",
    ejemplo:
      "Entrega de la reforma del baño principal. Quedan pendientes el sellado de la mampara y el remate del rodapié junto a la puerta. El cliente acepta la entrega con esas reservas.",
    conPresupuesto: false,
    conTecnico: true,
    guion: `
1. IDENTIFICACIÓN — obra, emplazamiento, quien entrega y quien recibe, y fecha de la recepción.
2. OBJETO DE LA ENTREGA — qué trabajos se entregan, por capítulos.
3. ESTADO DE LOS TRABAJOS — conformidad de lo ejecutado respecto a lo contratado.
4. RESERVAS Y REPASOS PENDIENTES — lista numerada de cada reserva con su plazo de subsanación. Si se entrega sin reservas, dilo expresamente: es lo que después se discute.
5. DOCUMENTACIÓN ENTREGADA — garantías, manuales, boletines de instalación, certificados.
6. GARANTÍAS Y PLAZOS — plazos legales de garantía que aplican a lo entregado.
7. CONFORMIDAD — declaración de recepción y firmas de ambas partes.`,
  },

  CERTIFICADO_OBRA: {
    etiqueta: "Certificado técnico de obra",
    grupo: "Certificados",
    pregunta: "¿Qué hay que certificar y sobre qué inmueble?",
    ejemplo:
      "Certificar que la reforma ejecutada en la vivienda no ha afectado a elementos estructurales y que las instalaciones cumplen la normativa vigente.",
    conPresupuesto: false,
    conTecnico: true,
    advertencia: "Un certificado técnico solo lo puede firmar un técnico competente y colegiado.",
    guion: `
1. DATOS DEL TÉCNICO QUE CERTIFICA — nombre, titulación y número de colegiado.
2. DATOS DEL INMUEBLE — emplazamiento, referencia catastral y titular.
3. OBJETO DEL CERTIFICADO — qué se certifica exactamente, en una frase precisa.
4. ACTUACIONES COMPROBADAS — qué se ha inspeccionado y cuándo, y con qué alcance.
5. NORMATIVA APLICADA — la que respalda lo certificado.
6. CERTIFICA — la declaración, redactada en el registro formal de un certificado ("CERTIFICA: Que…"), con sus puntos numerados.
7. VALIDEZ Y LIMITACIONES — para qué sirve el certificado y qué queda fuera de él.`,
  },

  MEMORIA_TECNICA: {
    etiqueta: "Memoria técnica",
    grupo: "Documentación técnica",
    pregunta: "¿Qué obra hay que describir?",
    ejemplo:
      "Reforma interior de vivienda: redistribución de tabiquería sin afectar a estructura, renovación de instalaciones de fontanería y electricidad, y sustitución de acabados.",
    conPresupuesto: true,
    conTecnico: true,
    guion: `
1. OBJETO DE LA MEMORIA — qué obra se describe y para qué se redacta el documento.
2. DATOS DEL INMUEBLE — emplazamiento, referencia catastral, superficie, año de construcción y uso.
3. ESTADO ACTUAL — descripción de lo existente antes de intervenir.
4. DESCRIPCIÓN DE LA OBRA — los trabajos previstos, por capítulos y en el orden de ejecución.
5. SOLUCIONES CONSTRUCTIVAS Y MATERIALES — qué se emplea y por qué.
6. NORMATIVA DE APLICACIÓN — la que afecte de verdad a esta obra.
7. CUMPLIMIENTO NORMATIVO — cómo la solución adoptada satisface cada exigencia citada.
8. GESTIÓN DE RESIDUOS Y SEGURIDAD Y SALUD — previsión de residuos y medidas preventivas.
9. PRESUPUESTO — se genera de las partidas, no lo redactes como texto.
10. CONCLUSIÓN — declaración de que la obra descrita es viable y ajustada a normativa.`,
  },

  PLAN_TRABAJO: {
    etiqueta: "Plan de trabajo y planificación de obra",
    grupo: "Documentación técnica",
    pregunta: "¿Qué obra hay que planificar y con qué condicionantes?",
    ejemplo:
      "Reforma integral de vivienda de 90 m² con la propiedad viviendo dentro. Un oficial y un peón. No se puede hacer ruido antes de las 9:00. Plazo objetivo de 6 semanas.",
    conPresupuesto: false,
    conTecnico: false,
    guion: `
1. OBJETO Y ALCANCE — qué obra se planifica y qué condicionantes la marcan.
2. FASES DE EJECUCIÓN — cada fase con su nombre, los trabajos que incluye y su duración estimada en días laborables. Una fase por subapartado.
3. SECUENCIA Y DEPENDENCIAS — qué no puede empezar hasta que termine otra cosa, y por qué (fraguados, secados, inspecciones).
4. RECURSOS PREVISTOS — oficios necesarios en cada fase y medios auxiliares.
5. HITOS DE CONTROL — momentos en que hay que comprobar o decidir algo antes de seguir.
6. RIESGOS DE PLAZO — lo que puede retrasar la obra y cómo se mitiga.
7. RESUMEN DE PLAZOS — duración total y fecha estimada de finalización si se conoce la de inicio.`,
  },

  CERTIFICACION: {
    etiqueta: "Certificación de obra ejecutada",
    grupo: "Certificados",
    pregunta: "¿Qué periodo se certifica y qué se ha ejecutado?",
    ejemplo:
      "Certificación nº 2, mes de marzo. Ejecutado el 100% de demoliciones, el 60% de la tabiquería y el 30% de las instalaciones.",
    conPresupuesto: true,
    conTecnico: true,
    guion: `
1. DATOS DE LA CERTIFICACIÓN — número, periodo certificado, obra y contrata.
2. OBRA EJECUTADA EN EL PERIODO — qué se ha ejecutado, por capítulos, con su grado de avance.
3. MEDICIÓN DE LO EJECUTADO — se genera de las partidas: cada una con la cantidad realmente ejecutada en este periodo, no la contratada.
4. RESUMEN ECONÓMICO — importe de esta certificación y observaciones sobre el origen de las diferencias.
5. OBSERVACIONES — trabajos a cuenta, acopios y cualquier salvedad.`,
  },

  RECLAMACION: {
    etiqueta: "Reclamación formal",
    grupo: "Escritos y reclamaciones",
    pregunta: "¿Qué reclamas, a quién y con qué base?",
    ejemplo:
      "Reclamación al proveedor por entrega de material defectuoso: 40 m² de porcelánico con desportillados en 12 piezas. Se solicita sustitución y abono del sobrecoste de la mano de obra parada.",
    conPresupuesto: true,
    conTecnico: false,
    guion: `
1. IDENTIFICACIÓN DE LAS PARTES — quién reclama y a quién, con sus datos.
2. ANTECEDENTES — los hechos en orden cronológico, con fechas concretas y referencias a albaranes, pedidos o contratos.
3. HECHOS OBJETO DE RECLAMACIÓN — qué ha ocurrido exactamente, descrito de forma objetiva y verificable.
4. FUNDAMENTOS — en qué se apoya la reclamación: contrato, pedido aceptado, normativa o garantía aplicable.
5. DAÑOS Y PERJUICIOS — se genera de las partidas: el coste de cada consecuencia.
6. SOLICITUD — qué se pide exactamente y en qué plazo, con sus puntos numerados.
7. RESERVA DE ACCIONES — advertencia de las acciones que se emprenderán si no hay respuesta.`,
  },

  CARTA_SEGURO: {
    etiqueta: "Comunicación de siniestro a la aseguradora",
    grupo: "Escritos y reclamaciones",
    pregunta: "¿Qué ha pasado, cuándo y qué daños ha provocado?",
    ejemplo:
      "Rotura de bajante comunitaria el 3 de abril. Ha afectado al techo del baño y al tabique del pasillo de la vivienda. Póliza nº 123456 de la compañía X.",
    conPresupuesto: true,
    conTecnico: false,
    guion: `
1. DATOS DEL ASEGURADO Y DE LA PÓLIZA — tomador, número de póliza y compañía. Si algún dato no consta, dilo.
2. DESCRIPCIÓN DEL SINIESTRO — qué ha ocurrido, cuándo se produjo y cuándo se detectó.
3. CAUSA PROBABLE — el origen técnico del daño, con la prudencia de decir "probable" salvo que sea evidente.
4. DAÑOS OCASIONADOS — relación de elementos afectados, uno por línea, con su ubicación y alcance.
5. MEDIDAS URGENTES ADOPTADAS — lo hecho para evitar que el daño siga creciendo, que la póliza suele exigir.
6. VALORACIÓN DE LA REPARACIÓN — se genera de las partidas, no lo redactes como texto.
7. DOCUMENTACIÓN QUE SE ADJUNTA — fotografías, facturas, informes.
8. SOLICITUD — qué se pide a la compañía y en qué plazo.`,
  },

  SOLICITUD_AYUNTAMIENTO: {
    etiqueta: "Solicitud o comunicación al ayuntamiento",
    grupo: "Escritos y reclamaciones",
    pregunta: "¿Qué se solicita y para qué obra?",
    ejemplo:
      "Comunicación previa de obra menor para la reforma interior de una vivienda: sustitución de acabados e instalaciones, sin afectar a estructura, fachada ni distribución de huecos.",
    conPresupuesto: true,
    conTecnico: false,
    advertencia:
      "Cada ayuntamiento tiene su propio impreso y sus requisitos. Este documento sirve de memoria adjunta, no sustituye al formulario oficial.",
    guion: `
1. DATOS DEL SOLICITANTE — nombre, NIF y domicilio a efectos de notificaciones.
2. DATOS DEL INMUEBLE — emplazamiento, referencia catastral y uso.
3. OBJETO DE LA SOLICITUD — qué se pide exactamente (comunicación previa, licencia de obra menor, ocupación de vía pública…).
4. DESCRIPCIÓN DE LA OBRA — los trabajos previstos, dejando claro que NO se afecta a estructura, fachada ni distribución si es el caso: es lo que determina si basta una comunicación previa.
5. PLAZO DE EJECUCIÓN — duración prevista y fechas.
6. PRESUPUESTO DE EJECUCIÓN MATERIAL — se genera de las partidas: es la base del impuesto de construcciones.
7. DOCUMENTACIÓN QUE SE ADJUNTA — la que acompaña a la solicitud.
8. SOLICITA — la petición formal, redactada como tal.`,
  },
};

export const TIPOS_DOCUMENTO = Object.keys(DOCUMENTOS) as TipoDocumento[];

/** Agrupados para el desplegable del asistente. */
export function documentosPorGrupo() {
  const grupos = new Map<string, { tipo: TipoDocumento; def: DefinicionDocumento }[]>();
  for (const tipo of TIPOS_DOCUMENTO) {
    const def = DOCUMENTOS[tipo];
    if (!grupos.has(def.grupo)) grupos.set(def.grupo, []);
    grupos.get(def.grupo)!.push({ tipo, def });
  }
  return [...grupos.entries()].map(([grupo, docs]) => ({ grupo, docs }));
}

/** Nunca confía en lo que llega del navegador para elegir plantilla. */
export function definicionDe(tipo: string): { tipo: TipoDocumento; def: DefinicionDocumento } {
  const t = (TIPOS_DOCUMENTO as string[]).includes(tipo) ? (tipo as TipoDocumento) : "PATOLOGIAS";
  return { tipo: t, def: DOCUMENTOS[t] };
}
