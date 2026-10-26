import { api } from '../../../nucleo/api/cliente'
import type { ComprobanteParaNota, SerieEmitida } from '../../facturacion/tipos'

// =============================================================================
// 050 — GUÍAS DE REMISIÓN: tipos y llamadas
// =============================================================================

export type EstadoGuia = 'encolado' | 'aceptado' | 'observado' | 'rechazado' | 'error' | 'anulado'

export interface GuiaEnLista {
  id: string
  tipo: '09' | '31'
  estado: EstadoGuia
  ambiente: string
  numero: string | null
  serie: string
  fechaEmision: string
  fechaTraslado: string
  motivo: string
  modalidad: string
  destinatario: string
  destinatarioDoc: string
  llegada: string
  placa: string | null
  conductor: string | null
  transportista: string | null
  documento: string | null
  documentoId: string | null
  documentoRelacionado: string | null
  sucursal: string | null
  codigoSunat: string | null
  mensajeSunat: string | null
  anuladaEn: string | null
}

export interface PaginaGuias {
  total: number
  pagina: number
  porPagina: number
  conteo: { todas: number; remitente: number; transportista: number; rechazadas: number; enCamino: number }
  filas: GuiaEnLista[]
}

export interface SerieLocal { serie: string; ultimo: number; siguiente: string }

export interface LocalGuia {
  id: string
  codigo: string
  nombre: string
  direccion: string | null
  ubigeo: string | null
  lugar: string | null
  esPrincipal: boolean
  series09: SerieLocal[]
  series31: SerieLocal[]
  nueva09: string | null
  nueva31: string | null
}

export interface ContextoGuia {
  empresa: { ruc: string | null; razonSocial: string; ambiente: string; transportaCarga: boolean; registroMtc: string | null }
  sucursales: LocalGuia[]
  seriesLeidas: boolean
  motivos: { codigo: string; nombre: string }[]
  /** 24 oct: catálogo 61, los documentos relacionados que se pueden agregar. */
  tiposDocumento?: { codigo: string; nombre: string }[]
  hoy: string
}

export interface LineaDespacho {
  id: string
  numero: number
  productoId: string | null
  codigo: string | null
  descripcion: string
  unidad: string
  cantidad: number
  despachado: number
  pendiente: number
  esServicio: boolean
}

export interface Despacho {
  id: string
  tipo: string
  numero: string
  estado: string
  fechaEmision: string
  sucursalId: string | null
  ambiente: string | null
  cliente: {
    id: string; tipoDocumento: string; numeroDocumento: string; razonSocial: string
    direccion: string | null; ubigeo: string | null; lugar: string | null
  } | null
  puede: boolean
  problema: string | null
  todoDespachado: boolean
  lineas: LineaDespacho[]
  guias: { id: string; numero: string; estado: EstadoGuia; fechaTraslado: string; placa: string | null; bienes: { descripcion: string; cantidad: number; unidad: string }[] }[]
}

export interface Persona { tipoDocumento: string; numeroDocumento: string; razonSocial: string }
export interface Punto { direccion: string; ubigeo: string; codigoEstablecimiento?: string | null }
export interface VehiculoPeticion { placa: string; descripcion?: string; tuc?: string; autorizacion?: string; entidad?: string }
export interface ConductorPeticion { tipoDocumento: string; numeroDocumento: string; nombres: string; apellidos: string; licencia: string; usuarioId?: string | null }
export interface TransportistaPeticion { ruc: string; razonSocial: string; mtc?: string }
export interface BienPeticion { descripcion: string; cantidad: number; unidad: string; codigo?: string | null; productoId?: string | null; documentoLineaId?: string | null
  /** 068: en un traslado entre locales, los números de serie que viajan. */
  series?: string[] | null }

export interface PeticionGuia {
  clave: string
  tipo: '09' | '31'
  serie: string
  fechaTraslado: string
  motivo?: string
  motivoDescripcion?: string
  modalidad?: '01' | '02'
  destinatario: Persona
  clienteId?: string | null
  partida: Punto
  llegada: Punto
  pesoBruto: number
  bultos?: number | null
  bienes: BienPeticion[]
  vehiculo?: VehiculoPeticion | null
  conductor?: ConductorPeticion | null
  relevos?: ConductorPeticion[]
  transportista?: TransportistaPeticion | null
  entregaAlTransportista?: string | null
  vehiculoMenor?: boolean
  documentoId?: string | null
  observaciones?: string
  remitente?: Persona | null
  guiaRemitente?: string
  pagadorFlete?: Persona | null
  subcontratista?: TransportistaPeticion | null
  // --- 24 oct (de los manuales de SOL) ---
  unidadPeso?: 'KGM' | 'TNE'
  transbordoProgramado?: boolean
  retornoVacio?: boolean
  retornoConEnvases?: boolean
  documentos?: DocumentoRelacionado[]
}

/** 051: una GRE por evento (solo se emite en SOL; aquí se registra). */
export type TipoEventoGuia = 'arribo' | 'transbordo' | 'ambos'
export interface EventoGuia {
  id: string; tipo: TipoEventoGuia; numeroSol: string; fecha: string
  reinicioDireccion: string; reinicioUbigeo: string; llegadaDireccion: string | null; llegadaUbigeo: string | null
  placa: string | null; conductorNombre: string | null; conductorDoc: string | null; licencia: string | null; observacion: string | null
}
export interface PeticionEvento {
  tipo: TipoEventoGuia; numeroSol: string; fecha: string | null
  reinicio: Punto; llegada: Punto | null; placa: string | null
  conductor: ConductorPeticion | null; observacion: string | null
}

/** 24 oct: otro documento relacionado (constancia de detracción, DAM, otra factura…). */
export interface DocumentoRelacionado { tipo: string; numero: string; ruc?: string }

export interface GuiaCompleta {
  id: string
  tipo: '09' | '31'
  serie: string
  correlativo: number | null
  numero: string | null
  estado: EstadoGuia
  ambiente: string
  fechaEmision: string
  fechaTraslado: string
  motivo: string
  motivoNombre: string
  motivoDescripcion: string | null
  modalidad: string
  destinatario: Persona
  partida: { direccion: string; ubigeo: string; lugar: string | null }
  llegada: { direccion: string; ubigeo: string; lugar: string | null }
  pesoBruto: number
  bultos: number | null
  placa: string | null
  conductor: string | null
  conductorDoc: string | null
  /** e174: el WhatsApp guardado del cliente (para mandarle la guía). */
  clienteWhatsapp?: string | null
  transportista: { ruc: string | null; razonSocial: string } | null
  documento: { id: string; tipo: string; numero: string } | null
  documentoRelacionado: string | null
  sucursal: string | null
  codigoSunat: string | null
  mensajeSunat: string | null
  anuladaEn: string | null
  anuladaMotivo: string | null
  puedeIniciarTraslado: boolean
  bienes: { numero: number; codigo: string | null; descripcion: string; unidad: string; cantidad: number; productoId: string | null; series?: string[] | null }[]
  peticion: (PeticionGuia & { relevos?: ConductorPeticion[] }) | null
  /** 051: las GRE por evento hechas en SOL y registradas aquí. */
  eventos?: EventoGuia[]
}

export interface Emitida { id: string; estado: EstadoGuia; numero: string; mensaje?: string; duplicado?: boolean }

// --- transporte guardado ------------------------------------------------------

export interface VehiculoGuardado { id: string; placa: string; descripcion: string | null; tuc: string | null; autorizacion: string | null; entidad: string | null; usos: number; ultimoUso: string | null; activo: boolean }
export interface ConductorGuardado { id: string; tipoDoc: string; numeroDoc: string; nombres: string; apellidos: string; licencia: string; usuarioId: string | null; usos: number; ultimoUso: string | null; activo: boolean }
export interface TransportistaGuardado { id: string; ruc: string; razonSocial: string; mtc: string | null; usos: number; ultimoUso: string | null; activo: boolean }
export interface Transporte { vehiculos: VehiculoGuardado[]; conductores: ConductorGuardado[]; transportistas: TransportistaGuardado[]; puedeGestionar: boolean }
export interface PersonaDelPersonal { usuarioId: string; tipoDoc: string; numeroDoc: string; nombres: string; apellidos: string; cargo: string | null }

export interface ConfiguracionGuias {
  transportaCarga: boolean
  registroMtc: string | null
  ambiente: string
  gre: { leido: boolean; habilitado: boolean; clientId: string | null; tieneSecreto: boolean }
  puedeGestionar: boolean
}

export type ClaseTransporte = 'vehiculos' | 'conductores' | 'transportistas'

/** e174: lo que devuelve POST /api/guias/{id}/whatsapp. */
export interface MensajeWhatsappGuia {
  numero: string
  numeroLegible: string
  mensaje: string
  enlace: string
  expiraEn: string
  abrir: string
}

export const guiasServicio = {
  listar: (f: { tipo?: string; estado?: string; q?: string; pagina?: number
                desde?: string; hasta?: string; sucursalId?: string; porPagina?: number }) => {
    const p = new URLSearchParams()
    if (f.tipo) p.set('tipo', f.tipo)
    if (f.estado) p.set('estado', f.estado)
    if (f.q) p.set('q', f.q)
    if (f.pagina) p.set('pagina', String(f.pagina))
    // 24 oct: fechas, sucursal y cuántos por página.
    if (f.desde) p.set('desde', f.desde)
    if (f.hasta) p.set('hasta', f.hasta)
    if (f.sucursalId) p.set('sucursalId', f.sucursalId)
    if (f.porPagina) p.set('porPagina', String(f.porPagina))
    return api.obtener<PaginaGuias>(`/api/guias?${p}`)
  },
  contexto: () => api.obtener<ContextoGuia>('/api/guias/contexto'),
  desde: (documentoId: string) => api.obtener<Despacho>(`/api/guias/desde/${documentoId}`),
  emitir: (p: PeticionGuia) => api.crear<Emitida>('/api/guias', p),
  ver: (id: string) => api.obtener<GuiaCompleta>(`/api/guias/${id}`),
  actualizar: (id: string) => api.crear<{ estado: EstadoGuia; cambio: boolean }>(`/api/guias/${id}/actualizar`),
  reintentar: (id: string) => api.crear<Emitida>(`/api/guias/${id}/reintentar`),
  /** 24 oct: buscar la factura o boleta de la que sale una guía (número o cliente). */
  buscarComprobante: (q: string) =>
    api.obtener<ComprobanteParaNota[]>(`/api/guias/buscar-comprobante?q=${encodeURIComponent(q)}`),
  seriesComprobante: () => api.obtener<SerieEmitida[]>('/api/guias/buscar-comprobante/series'),
  /** 051: registrar una GRE por evento hecha en SOL. */
  registrarEvento: (id: string, datos: PeticionEvento) =>
    api.crear<{ mensaje: string }>(`/api/guias/${id}/evento`, datos),
  anular: (id: string, motivo: string, fecha?: string) =>
    api.crear<{ estado: EstadoGuia; mensaje: string }>(`/api/guias/${id}/anulacion`, { motivo, fecha: fecha || null }),
  descargar: (id: string, archivo: 'pdf' | 'xml' | 'cdr') => api.descargar(`/api/guias/${id}/${archivo}`),
  archivo: (id: string) => api.archivo(`/api/guias/${id}/pdf`),
  /** e174 (057): el mensaje y el enlace para mandar la guía por WhatsApp. */
  whatsapp: (id: string, para: 'cliente' | 'conductor', numero?: string) =>
    api.crear<MensajeWhatsappGuia>(`/api/guias/${id}/whatsapp`, { para, numero: numero || null }),

  transporte: () => api.obtener<Transporte>('/api/guias/transporte'),
  personal: () => api.obtener<PersonaDelPersonal[]>('/api/guias/transporte/personal'),
  guardar: (clase: ClaseTransporte, datos: object, id?: string) =>
    id ? api.cambiar<{ id: string; mensaje: string }>(`/api/guias/transporte/${clase}/${id}`, datos)
       : api.crear<{ id: string; mensaje: string }>(`/api/guias/transporte/${clase}`, datos),
  activar: (clase: ClaseTransporte, id: string, activo: boolean) =>
    api.crear<{ mensaje: string }>(`/api/guias/transporte/${clase}/${id}/${activo ? 'reactivar' : 'desactivar'}`),

  configuracion: () => api.obtener<ConfiguracionGuias>('/api/guias/configuracion'),
  guardarTransporteEmpresa: (transportaCarga: boolean, registroMtc: string) =>
    api.cambiar<{ mensaje: string }>('/api/guias/configuracion/transporte', { transportaCarga, registroMtc }),
  guardarGre: (clientId: string, clientSecret: string) =>
    api.cambiar<{ mensaje: string }>('/api/guias/configuracion/gre', { clientId, clientSecret }),
}

/** Catálogo 03: las unidades que se ofrecen al escribir un bien a mano. */
export const UNIDADES: [string, string][] = [
  ['NIU', 'Unidad'], ['KGM', 'Kilogramo'], ['TNE', 'Tonelada'], ['BX', 'Caja'], ['BG', 'Bolsa'],
  ['PK', 'Paquete'], ['SA', 'Saco'], ['LTR', 'Litro'], ['GLL', 'Galón'], ['MTR', 'Metro'],
  ['MTK', 'Metro²'], ['MTQ', 'Metro³'], ['DZN', 'Docena'], ['SET', 'Juego'], ['PR', 'Par'],
  ['RO', 'Rollo'], ['CY', 'Cilindro'], ['BO', 'Botella'], ['PL', 'Balde'],
]

export const nombreUnidad = (codigo: string) => UNIDADES.find(u => u[0] === codigo)?.[1] ?? codigo

/** Catálogo 37: quién da la autorización especial del vehículo. */
export const ENTIDADES: [string, string][] = [
  ['01', 'MTC'], ['02', 'Produce'], ['03', 'Digesa'], ['04', 'Senasa'], ['06', 'MINEM'], ['07', 'Sucamec'],
]

export function nuevaClave() {
  try { return crypto.randomUUID().replace(/-/g, '') }
  catch { return `${Date.now()}${Math.random().toString(16).slice(2)}`.padEnd(24, '0') }
}