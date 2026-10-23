// =============================================================================
// Las formas que devuelve el módulo de facturación de la API.
//
// OJO CON UNA DISTINCIÓN QUE SE CONFUNDE TODO EL TIEMPO: estos son los tipos de
// LA PLATAFORMA, no del servicio de facturación. Clientes y productos viven
// aquí; el servicio no sabe qué es un producto ni de dónde salió el precio, y
// esa ignorancia es lo que lo mantiene reutilizable.
//
// Lo único que cruza la frontera es la credencial, y solo el super
// administrador la toca.
// =============================================================================

/** GET /api/facturacion/clientes */
export interface ClienteEnLista {
  id: string

  /**
   * Catálogo 06 de SUNAT: «1» DNI, «6» RUC, «4» carné de extranjería,
   * «7» pasaporte, «0» sin documento.
   *
   * Se guarda el código, no un nombre: así viaja al servicio sin traducción, y
   * una traducción es donde se cuela el error que SUNAT devuelve tres pasos
   * más adelante.
   */
  tipoDocumento: string
  numeroDocumento: string

  razonSocial: string
  nombreComercial: string | null
  direccion: string | null
  ubigeo: string | null
  correo: string | null
  telefono: string | null

  /**
   * Catálogo 07: la afectación del IGV que se propone al facturarle.
   *
   * `null` es lo normal y quiere decir «nada especial, usa la del producto».
   * Se rellena para el cliente que siempre va igual —el de exportación, el de
   * la Amazonía— y entonces la pantalla del comprobante la propone sola y
   * avisa si una línea no coincide.
   *
   * AVISA, NO OBLIGA: un cliente de exportación puede comprar en el mercado
   * local, y prohibirlo llevaría a mentir en la ficha para poder facturar.
   */
  afectacionHabitual: string | null

  activo: boolean

  /** 043: su WhatsApp, solo dígitos con el código de país (51987654321). */
  whatsapp?: string | null
  /** 043: «enviarle sus comprobantes por WhatsApp» (la regla general). */
  whatsappActivo?: boolean
}

/** GET /api/facturacion/productos */
export interface ProductoEnLista {
  id: string
  codigo: string
  descripcion: string

  /** Catálogo 03: «NIU» unidad, «ZZ» servicio, «KGM» kilo… */
  unidadMedida: string

  /** Catálogo 07: «10» gravado, «20» exonerado, «30» inafecto… */
  tipoAfectacion: string

  /**
   * Con diez decimales, los mismos que la base.
   *
   * Llega como número de JavaScript y **eso está bien para mostrar, no para
   * calcular**: a partir de unos quince dígitos significativos deja de ser
   * exacto. El importe de un comprobante lo calcula el servicio, no esta
   * pantalla, y por eso aquí no hay ninguna suma.
   */
  precioUnitario: number

  incluyeIgv: boolean
  codigoSunat: string | null

  /** Cómo llama SUNAT a ese código («Azúcares naturales o productos endulzantes»). */
  codigoSunatNombre: string | null
  activo: boolean
}

/**
 * GET .../productos/codigos-sunat?q= — una fila del catálogo 25 de SUNAT.
 *
 * Puede ser un producto (50161509) o una clase entera (50161500, acaba en 00).
 * SUNAT acepta los dos: la clase es el nivel mínimo.
 */
export interface CodigoSunat {
  codigo: string
  descripcion: string

  /** La clase a la que pertenece. Null cuando la fila ya es una clase. */
  clase: string | null
  claseDescripcion: string | null
}

/** GET /api/facturacion/productos/catalogos */
export interface CatalogosSunat {
  afectaciones: { codigo: string; nombre: string }[]
  unidades: { codigo: string; nombre: string }[]
}

/**
 * Lo que dice el servicio del emisor (`GET /v1/emisor`), tal como lo guarda la
 * plataforma. Sin secretos: solo «está o no está» y datos de la propia empresa.
 * Con un servicio anterior a la parte C1, `alta`, `portal`, `direccion` y
 * `listo` no vienen.
 */
export interface EmisorDelServicio {
  ruc: string | null
  razonSocial: string | null
  nombreComercial: string | null
  ambiente: string | null
  certificadoValidoHasta: string | null

  alta?: {
    /** `sin_confirmar`, `confirmada` o `abandonada`. */
    estado: string | null
    creadoEn: string | null
    confirmadaEn: string | null
  } | null

  portal?: {
    identificador: string | null
    correoRespuesta: string | null
    tieneLogo: boolean | null

    /** Sin identificador y correo de respuesta, ningún receptor recibe su correo. */
    correosAlReceptor: boolean | null
  } | null

  direccion?: {
    ubigeo: string | null
    direccion: string | null
    distrito: string | null
    provincia: string | null
    departamento: string | null
    revisadaEn: string | null
  } | null

  listo?: {
    paraEmitir: boolean | null
    certificado: boolean | null
    sol: boolean | null
    series: string[] | null
    direccion: boolean | null

    /** Lo que falta, en palabras y en el orden en que se hace. */
    faltan: string[] | null
  } | null
}

/** Un aviso de la ventana de Facturación, escrito por el back. */
export interface AvisoFacturacion {
  nivel: 'ambar' | 'rojo'
  codigo: string
  texto: string
  detalle?: string
}

/** GET /api/admin/empresas/{id}/facturacion */
export interface EstadoFacturacion {
  configurada: boolean

  /** Los datos oficiales, del servicio. `conectada` falso: todavía sin RUC. */
  empresa: {
    nombre: string
    ruc: string | null
    razonSocial: string | null
    ambiente: string | null
    datosOficialesEn: string | null
    conectada: boolean
  }

  /** La dirección del servicio según el .env de la plataforma, para proponerla. */
  servicio: {
    baseUrl: string | null
    altaDisponible: boolean
  }

  /** Nulo si no hay credencial. */
  alta: {
    creadaPorAlta: boolean
    confirmadaEn: string | null
    sinConfirmar: boolean
  } | null

  /** Lo último que dijo el servicio del emisor, y cuándo. */
  emisor: EmisorDelServicio | null
  emisorEn: string | null

  avisos: AvisoFacturacion[]

  credencial: {
    id: string
    baseUrl: string

    /** Los cuatro últimos caracteres de la clave. Nunca la clave entera. */
    pista: string | null

    rotadaEn: string | null

    /**
     * Las tres que contestan «¿por qué no se emite?» sin abrir un log.
     *
     * Si `ultimoFalloEn` es más reciente que `ultimaLlamadaEn`, algo está roto
     * y `ultimoFallo` dice qué.
     */
    ultimaLlamadaEn: string | null
    ultimoFalloEn: string | null
    ultimoFallo: string | null

    creadoEn: string
  } | null

  /**
   * `consultadoEn` nulo: nunca se preguntó. Consultado y `validoHasta` nulo:
   * el servicio no tiene certificado activo, y la empresa no puede emitir.
   */
  certificado: {
    validoHasta: string | null
    consultadoEn: string | null
    diasParaVencer: number | null
  } | null

  /**
   * El camino de vuelta: el servicio avisa aquí cuando SUNAT contesta.
   *
   * Sin el secreto guardado, todos los avisos se rechazan con 401 y los
   * comprobantes se quedan «en camino» para siempre, sin error en ningún sitio
   * de la plataforma. Por eso esta pantalla lo enseña.
   */
  webhook: {
    /** La dirección a la que el servicio tiene que mandar los avisos. */
    url: string

    configurado: boolean

    /** Los cuatro últimos caracteres del secreto `whsec_`. Nunca el secreto. */
    pista: string | null

    /**
     * El último aviso que llegó para esta empresa, bueno o malo.
     *
     * Con `firmaValida` en falso, el secreto guardado no es el del webhook que
     * se registró en el servicio.
     */
    ultimoAviso: {
      recibidoEn: string
      firmaValida: boolean
      procesadoEn: string | null
      nota: string | null
    } | null

    /** Lo que dice el servicio (GET /v1/webhook). `apuntaAqui` falso es el rojo. */
    urlServicio: string | null
    revisadoEn: string | null
    apuntaAqui: boolean | null
  }

  /**
   * Las claves anteriores. Una retirada que conserva su copia puede seguir
   * valiendo en el servicio: es el aviso rojo. Se apaga con «Ya la revoqué».
   */
  claveAnterior: {
    pendientes: { id: string; pista: string | null; rotadaEn: string | null }[]
    ultimaComprobada: {
      pista: string | null
      comprobadaEn: string
      por: string | null
      comprobacion: string | null
    } | null
  }
}

/** POST /api/admin/empresas/{id}/facturacion/probar — «Volver a preguntar al servicio». */
export interface PruebaConexion {
  ok: boolean

  emisor?: EmisorDelServicio

  /**
   * Falso cuando la clave funciona pero corresponde a OTRA empresa.
   *
   * Es el error que de verdad pasa al copiar y pegar, y el que más caro sale:
   * emitir con la clave de otro cliente son comprobantes tributarios a nombre
   * de quien no los pidió.
   */
  rucCoincide?: boolean

  avisos?: AvisoFacturacion[]

  error?: string
  detalle?: string
  pista?: string | null
  mensaje?: string
}

/** POST …/facturacion/comprobar — de quién es una clave, sin guardarla. */
export interface ComprobacionClave {
  ok: boolean
  puedeConectar: boolean

  /** Por qué no se puede conectar, escrito para quien está delante. */
  problema: string | null

  emisor: {
    ruc: string
    razonSocial: string | null
    ambiente: string | null
    certificadoValidoHasta: string | null
    certificadoDiasParaVencer: number | null
    alta?: EmisorDelServicio['alta']
    portal?: EmisorDelServicio['portal']
    listo?: EmisorDelServicio['listo']
  }

  empresa: { nombre: string; ruc: string | null; conectada: boolean }

  /** Verdadero si la empresa ya tenía RUC: esto es rotar la clave. */
  rotacion: boolean
}

/** POST …/facturacion/conectar */
export interface Conexion {
  ok: boolean
  rotada: boolean
  empresa: { nombre: string; ruc: string | null; razonSocial: string | null; ambiente: string | null }

  /** Solo si se rotó a OTRA clave: la anterior sigue valiendo hasta revocarla. */
  avisoClaveAnterior: string | null

  avisos: AvisoFacturacion[]
  mensaje: string
}

/** POST …/facturacion/confirmar-alta */
export interface ConfirmacionAlta {
  ok: boolean
  alta: string
  emisor: EmisorDelServicio | null
  emisorEn: string | null
  avisos: AvisoFacturacion[]
  mensaje: string
}

/** POST …/facturacion/clave-anterior/revocada — «Ya la revoqué», cuando sale bien. */
export interface ClaveRevocada {
  ok: boolean
  comprobadas: number
  mensaje: string
}


// =============================================================================
// LOS COMPROBANTES
// =============================================================================

/**
 * Los estados por los que pasa un comprobante.
 *
 * `encolado` ES EL ESTADO NORMAL durante unos segundos después de emitir, no un
 * problema: el servicio responde en milisegundos porque no espera a SUNAT.
 *
 * Y `error` NO ES `rechazado`. «Error» es que no se pudo ni entregar al
 * servicio —se arregla reintentando—; «rechazado» es que SUNAT dijo que no
 * —se arregla corrigiendo el documento, y no se reintenta nunca—.
 */
export type EstadoDocumento =
  | 'borrador' | 'encolado' | 'aceptado' | 'observado'
  | 'rechazado' | 'anulado' | 'error'

/** GET /api/facturacion/documentos */
export interface DocumentoEnLista {
  id: string
  tipo: string
  serie: string | null
  correlativo: number | null
  estado: EstadoDocumento
  fechaEmision: string
  moneda: string
  importeTotal: number
  codigoSunat: string | null
  mensajeSunat: string | null

  /** El identificador en el servicio. Con él se piden el XML, el CDR y el PDF. */
  comprobanteId: string | null

  /** 030: «beta» = prueba, sin valor ante SUNAT; «produccion» = real. Null en un borrador. */
  ambiente?: 'beta' | 'produccion' | null

  cliente: { razonSocial: string; numeroDocumento: string }

  /** 031: en una nota de crédito, el número del comprobante al que afecta. */
  afecta?: string | null
}

/**
 * GET /api/facturacion/documentos/atrasados — los que no llegaron a SUNAT y se
 * acercan a su plazo, o ya lo pasaron.
 *
 * Solo `encolado` y `error`, y cada tipo con su plazo: factura 3 días, boleta
 * 7, contados desde la fecha de emisión. Una boleta «encolada» al día
 * siguiente es lo normal y NO sale aquí.
 */
export interface Atrasado {
  id: string
  tipo: string

  /** Nulo si el servicio todavía no le dio número (un `error` del primer intento). */
  numero: string | null

  estado: EstadoDocumento
  fechaEmision: string

  /** El último día del plazo, incluido. */
  venceEl: string

  /** 0 = vence hoy; negativo = ya venció. */
  diasRestantes: number
  vencido: boolean

  cliente: string
}

export interface Atrasados {
  /** Hoy en hora de Perú, para que la pantalla no use el reloj del navegador. */
  hoy: string

  /** Cuántos hay en total. `atrasados` trae solo los más urgentes. */
  total: number

  /** Cuántos de ese total ya pasaron su plazo. */
  vencidos: number

  /** Los cinco más urgentes, ordenados por el día en que vence su plazo. */
  atrasados: Atrasado[]
}

export interface PaginaDocumentos {
  total: number
  pagina: number
  porPagina: number
  filas: DocumentoEnLista[]
}

export interface LineaDocumento {
  id?: string
  numero: number
  productoId: string | null
  codigo: string | null
  descripcion: string
  unidadMedida: string
  cantidad: number

  /** Sin IGV y sin descuento. Es lo que espera el servicio. */
  valorUnitario: number

  /** Con IGV. Solo para la pantalla. */
  precioUnitario: number

  descuento: number
  tipoAfectacion: string
  igv: number
  valorVenta: number
  importeTotal: number
}

/** GET /api/facturacion/documentos/{id} */
export interface DocumentoCompleto {
  id: string
  tipo: string
  serie: string | null
  correlativo: number | null
  estado: EstadoDocumento
  numero: string
  fechaEmision: string
  moneda: string
  /** Solo en moneda extranjera (migración 026). */
  tipoCambio: number | null
  comprobanteId: string | null
  codigoSunat: string | null
  mensajeSunat: string | null
  observaciones: string[] | null

  /** 030: «beta» = prueba, sin valor ante SUNAT; «produccion» = real. */
  ambiente?: 'beta' | 'produccion' | null

  /** Falso en cuanto se entregó al servicio. A partir de ahí no hay vuelta atrás. */
  sePuedeEditar: boolean

  cliente: {
    id: string
    tipoDocumento: string
    numeroDocumento: string
    razonSocial: string
    direccion: string | null
    whatsapp?: string | null       // 043
    whatsappActivo?: boolean       // 043
  } | null

  /** 043: WhatsApp de este comprobante. */
  whatsapp?: {
    enviar: boolean
    estado: 'pendiente' | 'enviado' | 'sin_whatsapp' | 'no_enviado' | null
    numero: string | null
    en: string | null
  }

  /**
   * COPIA INFORMATIVA mientras es un borrador; la cifra del servicio en cuanto
   * se emite. Si algún día las dos difieren, gana la del servicio.
   */
  totales: {
    totalGravado: number
    totalExonerado: number
    totalInafecto: number
    totalGratuito: number
    totalExportacion: number
    totalDescuentos: number
    totalIgv: number
    totalIsc: number
    totalOtros: number
    importeTotal: number
  }

  lineas: LineaDocumento[]
  datosExtra: Record<string, string>

  // --- 040: forma de pago y detracción ---------------------------------------
  formaPago?: 'contado' | 'credito'
  cuotas?: { numero: number; monto: number; vence: string }[]
  /** `monto` en soles, redondeado al entero. */
  detraccion?: { codigo: string; porcentaje: number; cuenta: string; medioPago: string; monto: number | null } | null

  /** Lo escribe un disparador de la base, no el código. Es de solo inserción. */
  historial: {
    ocurridoEn: string
    estadoAnterior: string | null
    estadoNuevo: string
    origen: string
    codigoSunat: string | null
    mensaje: string | null
  }[]

  // --- 031: notas de crédito -------------------------------------------------
  /** En una nota: el motivo (catálogo 09) y su explicación. */
  tipoNota?: string | null
  motivoNota?: string | null
  /** En una nota: el comprobante al que afecta. */
  afecta?: { id: string; numero: string; tipo: string } | null
  /** En una factura o boleta: sus notas de crédito. */
  notasCredito?: NotaCreditoResumen[]
  /** Lo que queda del total después de las notas que valen. */
  saldo?: number
  /** 22 oct: en una factura o boleta, sus notas de débito. */
  notasDebito?: NotaCreditoResumen[]
  /** 23 oct: notas de crédito o débito que valen (emitidas, aceptadas o en camino). Con alguna, no hay baja. */
  notasVigentes?: number
  /** 23 oct: cuándo se pidió la baja / anulación, si SUNAT todavía no contesta. Mientras tanto, no hay notas. */
  bajaPedidaEn?: string | null
}

/** 031: una nota de crédito de un comprobante. `cuenta` = vale y resta del saldo. */
export interface NotaCreditoResumen {
  id: string
  numero: string
  tipoNota: string | null
  motivoNota: string | null
  importeTotal: number
  estado: EstadoDocumento
  fechaEmision: string
  cuenta: boolean
}

/** 031: GET .../{id}/nota-credito */
export interface PreviaNotaCredito {
  id: string
  tipo: string
  numero: string
  moneda: string
  fechaEmision: string
  importeTotal: number
  ambiente?: 'beta' | 'produccion' | null
  cliente: { razonSocial: string; numeroDocumento: string } | null
  saldo: number
  serieNota: string
  /** 22 oct: la serie no existe todavía: se crea sola al emitir la primera nota. */
  serieNueva?: boolean
  puede: boolean
  problema: string | null
  diasDesdeEmision: number
  aTiempoDeBaja: boolean
  hayNotas: boolean
  afectacionUnica: boolean
  notas: NotaCreditoResumen[]
  lineas: {
    numero: number
    descripcion: string
    unidadMedida: string
    cantidad: number
    precioUnitario: number
    importeTotal: number
    tipoAfectacion: string
    devuelta: number
    disponible: number
  }[]
}

/** 031: POST .../{id}/nota-credito con simular. */
export interface CalculoNotaCredito {
  problema?: string | null
  total?: number
  gravado?: number
  igv?: number
  saldoDespues?: number
  serie?: string
}

/** 031: lo que se manda para calcular o emitir. */
export interface PeticionNotaCredito {
  clave: string
  motivo?: string
  descripcion: string
  lineas?: { numero: number; cantidad: number }[]
  monto?: number
  linea?: number
}

/** 22 oct: GET .../{id}/nota-debito */
export interface PreviaNotaDebito {
  id: string
  tipo: string
  numero: string
  moneda: string
  fechaEmision: string
  importeTotal: number
  ambiente?: 'beta' | 'produccion' | null
  formaPago?: 'contado' | 'credito'
  vence: string | null
  cliente: { razonSocial: string; numeroDocumento: string } | null
  serieNota: string
  serieNueva?: boolean   // 22 oct
  puede: boolean
  problema: string | null
  debitos: number
  creditos: number
  notas: NotaCreditoResumen[]
  lineas: { numero: number; descripcion: string; importeTotal: number; tipoAfectacion: string; sePuede: boolean }[]
}

/** 22 oct: POST .../{id}/nota-debito con simular. */
export interface CalculoNotaDebito {
  problema?: string | null
  total?: number
  gravado?: number
  igv?: number
  serie?: string
  descripcionLinea?: string
}

/** 22 oct: lo que se manda para calcular o emitir una nota de débito. */
export interface PeticionNotaDebito {
  clave: string
  motivo?: string
  descripcion: string
  monto?: number
  afectacion?: string
  linea?: number
}

/** POST .../emitir */
export interface Emitido {
  /** 043: quedó pendiente de mandarse por WhatsApp. */
  whatsapp?: boolean
  id: string
  numero: string
  estado: EstadoDocumento
  importeTotal: number
  comprobanteId: string
  mensaje: string
}