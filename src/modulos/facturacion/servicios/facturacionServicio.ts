import { api } from '../../../nucleo/api/cliente'
import type {
  Atrasados, CatalogosSunat, CodigoSunat, ClaveRevocada, ClienteEnLista, ComprobacionClave, ConfirmacionAlta,
  Conexion, DocumentoCompleto, Emitido, EstadoFacturacion, PaginaDocumentos, ProductoEnLista,
  PruebaConexion, CalculoNotaCredito, PeticionNotaCredito, PreviaNotaCredito,
} from '../tipos'

// =============================================================================
// LA CAPA DE SERVICIO DEL MÓDULO DE FACTURACIÓN
//
// Ninguna llamada manda un identificador de empresa: lo recorta el aislamiento
// de la base. La única excepción es `credenciales`, que es del super
// administrador y trabaja SOBRE una empresa, no DENTRO de ella.
// =============================================================================

export interface DatosCliente {
  tipoDocumento: string
  numeroDocumento: string
  razonSocial: string
  nombreComercial?: string | null
  direccion?: string | null
  ubigeo?: string | null
  correo?: string | null
  telefono?: string | null

  /** Catálogo 07. `null` = sin preferencia, manda la del producto. */
  afectacionHabitual?: string | null
}

export interface DatosProducto {
  codigo: string
  descripcion: string
  unidadMedida: string
  tipoAfectacion: string
  precioUnitario: number
  incluyeIgv: boolean
  codigoSunat?: string | null
}


export const clientesServicio = {
  /**
   * GET /api/facturacion/clientes — un solo campo de búsqueda.
   *
   * Busca a la vez por documento, razón social y nombre comercial. Partirlo en
   * tres filtros obligaría a decidir dónde escribir antes de buscar.
   */
  listar: (q?: string, incluirInactivos = false) =>
    api.obtener<ClienteEnLista[]>(
      `/api/facturacion/clientes?q=${encodeURIComponent(q ?? '')}` +
      `&incluirInactivos=${incluirInactivos}`),

  crear: (datos: DatosCliente) =>
    api.crear<{ id: string; razonSocial: string }>('/api/facturacion/clientes', datos),

  editar: (id: string, datos: DatosCliente) =>
    api.cambiar<{ mensaje: string }>(`/api/facturacion/clientes/${id}`, datos),

  /** No borra: los comprobantes ya emitidos siguen apuntando a este cliente. */
  desactivar: (id: string) =>
    api.crear<{ mensaje: string }>(`/api/facturacion/clientes/${id}/desactivar`),

  reactivar: (id: string) =>
    api.crear<{ mensaje: string }>(`/api/facturacion/clientes/${id}/reactivar`),

  /** «PÚBLICO EN GENERAL»: la boleta simple. Se crea sola la primera vez. */
  publicoGeneral: () =>
    api.crear<ClienteEnLista>('/api/facturacion/clientes/publico-general'),
}


/** Lo que trae SUNAT de un RUC (vía Decolecta, desde el back). */
export interface DatosRuc {
  numero: string
  razonSocial: string | null
  estado: string | null
  condicion: string | null
  direccion: string | null
  ubigeo: string | null
  distrito: string | null
  provincia: string | null
  departamento: string | null
}

/**
 * CONSULTAS DE RUC, DNI Y TIPO DE CAMBIO (17 oct). Siempre por el back: el
 * token del proveedor no llega al navegador. Si fallan, se escribe a mano.
 */
export const consultasServicio = {
  ruc: (numero: string) =>
    api.obtener<DatosRuc>(`/api/facturacion/consultas/ruc/${encodeURIComponent(numero)}`),

  dni: (numero: string) =>
    api.obtener<{ numero: string; nombreCompleto: string | null }>(
      `/api/facturacion/consultas/dni/${encodeURIComponent(numero)}`),

  /** El de SUNAT para esa fecha; en el comprobante va el de venta. */
  tipoCambio: (fecha: string) =>
    api.obtener<{ fecha: string; compra: number | null; venta: number; nota?: string | null }>(
      `/api/facturacion/consultas/tipo-cambio?fecha=${encodeURIComponent(fecha)}`),

  /** Super administrador: cuántas van este mes. */
  estadoMes: () =>
    api.obtener<{
      configurado: boolean; dniActivo: boolean; usadas: number; limite: number
      agotadaEn: string | null; whatsapp: string; correo: string
    }>('/api/admin/consultas-externas'),
}


export const productosServicio = {
  listar: (q?: string, incluirInactivos = false) =>
    api.obtener<ProductoEnLista[]>(
      `/api/facturacion/productos?q=${encodeURIComponent(q ?? '')}` +
      `&incluirInactivos=${incluirInactivos}`),

  /**
   * GET .../catalogos — las afectaciones y las unidades de SUNAT.
   *
   * VIENEN DEL BACK Y NO ESCRITAS AQUÍ: son los mismos códigos que usa la línea
   * de una factura y los que viajan al servicio. Escritos dos veces, el día que
   * cambie uno el otro se queda atrás.
   */
  catalogos: () =>
    api.obtener<CatalogosSunat>('/api/facturacion/productos/catalogos'),

  /**
   * GET .../codigos-sunat?q= — busca en el catálogo 25 de SUNAT.
   *
   * EL CATÁLOGO NO VIAJA ENTERO: son 53 mil filas. Se busca en el back y
   * llegan las 20 que más se parecen. Con 8 dígitos, devuelve ese código.
   */
  codigosSunat: (q: string) =>
    api.obtener<CodigoSunat[]>(
      `/api/facturacion/productos/codigos-sunat?q=${encodeURIComponent(q)}`),

  crear: (datos: DatosProducto) =>
    api.crear<{ id: string; codigo: string }>('/api/facturacion/productos', datos),

  editar: (id: string, datos: DatosProducto) =>
    api.cambiar<{ mensaje: string }>(`/api/facturacion/productos/${id}`, datos),

  desactivar: (id: string) =>
    api.crear<{ mensaje: string }>(`/api/facturacion/productos/${id}/desactivar`),

  reactivar: (id: string) =>
    api.crear<{ mensaje: string }>(`/api/facturacion/productos/${id}/reactivar`),
}


export const credencialesServicio = {
  ver: (empresaId: string) =>
    api.obtener<EstadoFacturacion>(`/api/admin/empresas/${empresaId}/facturacion`),

  /**
   * PUT — guarda o rota la clave.
   *
   * ES SIEMPRE UN ALTA: la anterior se desactiva y se inserta otra. Así la
   * bitácora conserva cuándo se cambió y quién lo hizo, que es justo la
   * pregunta del día malo.
   */
  guardar: (empresaId: string, baseUrl: string, clave: string) =>
    api.cambiar<{ mensaje: string; rotada: boolean; webhookConfigurado: boolean }>(
      `/api/admin/empresas/${empresaId}/facturacion`, { baseUrl, clave }),

  /**
   * PUT .../webhook — guarda SOLO el secreto `whsec_` del webhook.
   *
   * VA APARTE DE LA CLAVE A PROPÓSITO. El servicio enseña la clave `fac_` una
   * sola vez, al dar de alta la empresa; el webhook se registra después. Si
   * guardar el secreto exigiera volver a pegar la clave, habría que pedirle una
   * nueva al servicio solo para eso.
   *
   * Y al rotar la clave con `guardar`, el secreto se conserva solo: el back lo
   * copia de la fila anterior.
   */
  guardarSecretoWebhook: (empresaId: string, secreto: string) =>
    api.cambiar<{ mensaje: string; pista: string }>(
      `/api/admin/empresas/${empresaId}/facturacion/webhook`, { secreto }),

  /**
   * POST .../probar — llama de verdad a `GET /v1/emisor` del servicio.
   *
   * No a `/health`, que responde sin clave y diría que todo está bien con una
   * clave equivocada. Lo que hay que comprobar no es que el servicio esté
   * encendido, sino que ESTA clave sirve y a qué RUC corresponde.
   */
  probar: (empresaId: string) =>
    api.crear<PruebaConexion>(`/api/admin/empresas/${empresaId}/facturacion/probar`),

  /**
   * POST .../comprobar — de quién es esta clave, SIN GUARDARLA. Es la pantalla
   * intermedia: «Esta clave es de 20601234565 · MI EMPRESA SAC… ¿es esta?».
   */
  comprobar: (empresaId: string, baseUrl: string, clave: string) =>
    api.crear<ComprobacionClave>(
      `/api/admin/empresas/${empresaId}/facturacion/comprobar`, { baseUrl, clave }),

  /**
   * POST .../conectar — vuelve a preguntar, aplica la regla del RUC, registra
   * el webhook en el servicio y guarda todo. Después hay que llamar a
   * `confirmarAlta` y a `reintentarAvisos`, en ese orden y en peticiones aparte.
   */
  conectar: (empresaId: string, baseUrl: string, clave: string) =>
    api.crear<Conexion>(
      `/api/admin/empresas/${empresaId}/facturacion/conectar`, { baseUrl, clave }),

  /** POST .../reintentar-avisos — el servicio reenvía los avisos que se rechazaron. */
  reintentarAvisos: (empresaId: string) =>
    api.crear<{ ok: boolean; reencoladas: number; mensaje: string }>(
      `/api/admin/empresas/${empresaId}/facturacion/reintentar-avisos`),

  /**
   * POST .../confirmar-alta — le dice al servicio que el alta ya está guardada
   * aquí. Se puede llamar de más. Va SIEMPRE en otra petición, después.
   */
  confirmarAlta: (empresaId: string) =>
    api.crear<ConfirmacionAlta>(`/api/admin/empresas/${empresaId}/facturacion/confirmar-alta`),

  /**
   * POST .../clave-anterior/revocada — «Ya la revoqué». El back lo COMPRUEBA
   * contra el servicio; si todavía la acepta, responde 409 y el aviso sigue.
   */
  yaLaRevoque: (empresaId: string) =>
    api.crear<ClaveRevocada>(`/api/admin/empresas/${empresaId}/facturacion/clave-anterior/revocada`),
}


export interface DatosLinea {
  productoId: string | null
  codigo: string | null
  descripcion: string
  unidadMedida: string
  cantidad: number

  /** SIN IGV y SIN descuento: es lo que el servicio espera. */
  valorUnitario: number

  /** En soles, no en porcentaje. El back lo convierte al hablar con el servicio. */
  descuento: number

  tipoAfectacion: string
}

export interface DatosDocumento {
  tipo: string
  serie: string
  clienteId: string
  fechaEmision?: string
  moneda: string
  /** Soles por dólar, 3 decimales. Solo en moneda extranjera (migración 026). */
  tipoCambio?: number | null
  lineas: DatosLinea[]
  datosExtra?: Record<string, string>

  // 040: solo facturas.
  formaPago?: 'contado' | 'credito'
  cuotas?: { monto: number; vence: string }[]
  detraccion?: { codigo: string; porcentaje: number; cuenta: string; medioPago: string } | null
}

/** 21 oct: una serie de la empresa, con el número que sigue («F002-00000010»). */
export interface SerieEmpresa {
  tipo: string
  serie: string
  ultimo: number
  siguiente: string
}

/** 040: lo habitual de la detracción de la empresa. */
export interface PreferenciasDetraccion {
  cuenta: string | null
  codigo: string | null
  porcentaje: number | null
}


/**
 * 031: NOTAS DE CRÉDITO, siempre desde el comprobante original.
 *
 * `calcular` no emite nada: devuelve el total con los redondeos con que se
 * emitiría. `emitir` lleva la misma `clave` que nació al abrir la pantalla:
 * un doble clic no hace dos notas.
 */
export const notaCreditoServicio = {
  previa: (id: string) =>
    api.obtener<PreviaNotaCredito>(`/api/facturacion/documentos/${id}/nota-credito`),

  calcular: (id: string, datos: PeticionNotaCredito) =>
    api.crear<CalculoNotaCredito>(`/api/facturacion/documentos/${id}/nota-credito`, { ...datos, simular: true }),

  emitir: (id: string, datos: PeticionNotaCredito) =>
    api.crear<{ id: string; numero: string; estado: string; importeTotal: number; mensaje: string }>(
      `/api/facturacion/documentos/${id}/nota-credito`, { ...datos, simular: false }),
}

export const documentosServicio = {
  listar: (estado?: string, q?: string, pagina = 1, tipo?: string) =>
    api.obtener<PaginaDocumentos>(
      `/api/facturacion/documentos?pagina=${pagina}` +
      `&estado=${encodeURIComponent(estado ?? '')}` +
      `&q=${encodeURIComponent(q ?? '')}` +
      `&tipo=${encodeURIComponent(tipo ?? '')}`),

  ver: (id: string) =>
    api.obtener<DocumentoCompleto>(`/api/facturacion/documentos/${id}`),

  /** 18 oct: factura → comunicación de baja; boleta → anulación en el resumen. 7 días. */
  anular: (id: string, motivo: string) =>
    api.crear<{ mensaje: string }>(`/api/facturacion/documentos/${id}/anular`, { motivo }),

  /** 18 oct: subir el último número de una serie (error 1033). Solo hacia arriba. */
  ajustarSerie: (tipoComprobante: string, serie: string, ultimoCorrelativo: number, motivo: string) =>
    api.crear<{ mensaje: string; siguiente: string }>('/api/facturacion/series/ajustar',
      { tipoComprobante, serie, ultimoCorrelativo, motivo }),

  /**
   * GET .../atrasados — los que no llegaron a SUNAT y se acercan al plazo.
   *
   * Cada tipo con el suyo (factura 3 días, boleta 7) y contando desde la fecha
   * de emisión: lo decide el back, que es quien sabe qué día es en Perú.
   */
  atrasados: () =>
    api.obtener<Atrasados>('/api/facturacion/documentos/atrasados'),

  tipos: () =>
    api.obtener<{ codigo: string; nombre: string }[]>('/api/facturacion/documentos/tipos'),

  /** 21 oct: las series de mi empresa (del servicio) y el número que sigue. */
  series: () =>
    api.obtener<SerieEmpresa[]>('/api/facturacion/documentos/series'),

  /** 040: la cuenta de detracciones y el código habitual de mi empresa. */
  preferenciasDetraccion: () =>
    api.obtener<PreferenciasDetraccion>('/api/facturacion/documentos/preferencias-detraccion'),

  /**
   * Guarda el borrador.
   *
   * LA CLAVE DE IDEMPOTENCIA NACE AQUÍ, en el back, al crear el borrador — no
   * al emitir. Si naciera al emitir, dos clics serían dos claves distintas y el
   * servicio no sabría que son el mismo documento.
   */
  crear: (datos: DatosDocumento) =>
    api.crear<{ id: string; estado: string; importeTotal: number }>(
      '/api/facturacion/documentos', datos),

  editar: (id: string, datos: DatosDocumento) =>
    api.cambiar<{ id: string; estado: string; importeTotal: number }>(
      `/api/facturacion/documentos/${id}`, datos),

  /**
   * Descartar un borrador. Solo borradores: en cuanto se emite, deja de poder
   * descartarse. Para siempre.
   *
   * NO LO BORRA DE LA BASE, lo desactiva —nada se borra en la plataforma—, pero
   * desde aquí da igual: desaparece de la lista y del detalle.
   */
  borrar: (id: string) =>
    api.borrar<{ mensaje: string }>(`/api/facturacion/documentos/${id}`),

  /**
   * POST .../emitir — el paso que no tiene vuelta atrás.
   *
   * Después de esto el comprobante gastó un correlativo y forma parte de una
   * secuencia que SUNAT revisa. Corregirlo es emitir una nota de crédito.
   */
  emitir: (id: string) =>
    api.crear<Emitido>(`/api/facturacion/documentos/${id}/emitir`),

  /**
   * GET .../xml, .../cdr o .../pdf — los baja al disco de quien pulsa.
   *
   * LOS ARCHIVOS NO ESTÁN EN LA PLATAFORMA: la API los pide al servicio con el
   * `comprobante_id` cada vez. El CDR llega como ZIP, que es como lo manda
   * SUNAT. Qué botones se enseñan lo decide `ArchivosComprobante.tsx`.
   */
  descargar: (id: string, archivo: 'xml' | 'cdr' | 'pdf') =>
    api.descargar(`/api/facturacion/documentos/${id}/${archivo}`),
}