import { api } from '../../../nucleo/api/cliente'
import { ErrorApi } from '../../../nucleo/api/errores'

// =============================================================================
// 052 — INVENTARIO POR SUCURSAL. Todo lo que el front le pide a la API.
// =============================================================================

export interface PaginaDe<T> { total: number; pagina: number; porPagina: number; filas: T[] }

function parametros(f: Record<string, string | number | boolean | undefined | null>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  return p.toString()
}

export type ModoInventario = 'directa' | 'despacho'

export interface MotivoAjuste { codigo: string; nombre: string; signo: -1 | 0 | 1 }

export interface SucursalInventario {
  id: string
  codigo: string
  nombre: string
  stockInicialEn: string | null
  controlaDesde: string | null
  conStockInicial: number
}

export interface EstadoInventario {
  /** 053: la empresa tiene el módulo de inventario contratado. */
  contratado?: boolean
  encendido: boolean
  modo: ModoInventario
  permitirSinStock: boolean
  avisarMinimo: boolean
  activadoEn: string | null
  productos: { bienes: number; controlados: number; sinControl: number; servicios: number }
  sucursales: SucursalInventario[]
  motivosAjuste: MotivoAjuste[]
}

export interface SucursalVisible { id: string; codigo: string; nombre: string }

export interface SaldoEnSucursal {
  sucursalId: string
  fisico: number
  reservado: number
  disponible: number
  minimo: number | null
  bajoMinimo: boolean
}

export interface FilaStock {
  productoId: string
  codigo: string
  descripcion: string
  unidad: string
  categoria: string | null
  sucursales: SaldoEnSucursal[]
  transito: number
  totalDisponible: number
  bajoMinimo: boolean
  sinStock: boolean
  negativo: boolean
}

export interface PaginaStock extends PaginaDe<FilaStock> { sucursales: SucursalVisible[] }

export interface FiltroStock {
  q?: string; sucursalId?: string; categoriaId?: string; mostrar?: string; pagina?: number; porPagina?: number
}

export interface OtraSucursal { sucursalId: string; codigo: string; nombre: string; disponible: number }

export interface DisponibleProducto {
  productoId: string
  controla: boolean
  disponible: number
  fisico: number
  reservado: number
  otras: OtraSucursal[]
}

export interface Disponible {
  encendido: boolean
  modo?: ModoInventario
  permitirSinStock?: boolean
  sucursalId?: string
  controla?: boolean
  bloquea?: boolean
  productos?: DisponibleProducto[]
}

export interface FilaKardex {
  id: string
  creadoEn: string
  sucursalId: string
  sucursalCodigo: string
  tipo: string
  cantidad: number
  reservado: number
  saldoFisico: number
  saldoReservado: number
  fuente: 'documento' | 'guia' | 'operacion' | 'traslado'
  fuenteId: string
  documentoId: string | null
  documentoNumero: string | null
  referenciaNumero: string | null
  guiaId: string | null
  guiaNumero: string | null
  operacionId: string | null
  operacionCodigo: string | null
  proveedor: string | null
  documentoProveedor: string | null
  motivo: string | null
  nota: string | null
  usuario: string | null
  costoUnitario: number | null
}

export interface Kardex extends PaginaDe<FilaKardex> {
  producto: { id: string; codigo: string; descripcion: string; unidadMedida: string; controlaStock: boolean }
  sucursales: SucursalVisible[]
  fisico: number
  reservado: number
  disponible: number
}

export interface FiltroKardex {
  sucursalId?: string; desde?: string; hasta?: string; movimiento?: string; pagina?: number; porPagina?: number
}

export interface MinimoEnSucursal { sucursalId: string; codigo: string; nombre: string; minimo: number | null; fisico: number; disponible: number }

export interface AlertaInventario { sucursalId: string; codigo: string; nombre: string; bajoMinimo: number; negativos: number }

export type TipoOperacion = 'ingreso' | 'ajuste' | 'stock_inicial' | 'conteo'

export interface FilaOperacion {
  id: string
  tipo: TipoOperacion
  codigo: string
  estado: 'registrada' | 'anulada' | 'abierto' | 'cerrado'
  fecha: string
  creadoEn: string
  sucursalId: string
  sucursal: string
  proveedor: string | null
  documentoProveedor: string | null
  moneda: string | null
  motivo: string | null
  motivoNombre: string | null
  nota: string | null
  usuario: string | null
  lineas: number
  unidades: number
  costo: number | null
}

export interface LineaDeOperacion {
  productoId: string
  codigo: string | null
  descripcion: string | null
  unidad: string | null
  cantidad: number
  costoUnitario: number | null
  sistema: number | null
  contado: number | null
  fisicoAhora: number
  quedariaSiAnula: number
}

export interface Operacion {
  id: string
  tipo: TipoOperacion
  codigo: string
  estado: FilaOperacion['estado']
  fecha: string
  creadoEn: string
  usuario: string | null
  sucursalId: string
  sucursal: string
  proveedor: { id: string; tipoDocumento: string; numeroDocumento: string; razonSocial: string } | null
  documentoProveedor: string | null
  moneda: string | null
  motivo: string | null
  motivoNombre: string | null
  nota: string | null
  aplicadaEn: string | null
  anuladaEn: string | null
  anuladaMotivo: string | null
  lineas: LineaDeOperacion[]
}

export interface LineaOperacion { productoId: string; cantidad: number; costoUnitario?: number | null }

export interface ProveedorNuevo { tipoDocumento: string; numeroDocumento: string; razonSocial: string; direccion?: string | null }

export interface Proveedor {
  id: string
  tipoDocumento: string
  numeroDocumento: string
  razonSocial: string
  direccion?: string | null
  correo?: string | null
  telefono?: string | null
  activo?: boolean
  creadoEn?: string
  ultimaCompra?: string | null
}

export interface Categoria { id: string; nombre: string; activo: boolean; creadoEn: string; productos: number }

export interface FilaTraslado {
  id: string
  guiaId: string
  guiaNumero: string | null
  guiaEstado: string
  origenId: string
  origen: string
  destinoId: string
  destino: string
  estado: 'en_transito' | 'recibido' | 'con_diferencia' | 'anulado'
  salioEn: string
  recibidoEn: string | null
  recibidoPor: string | null
  nota: string | null
  productos: string | null
  enviado: number
  recibido: number | null
  puedeRecibir: boolean
}

export interface PaginaTraslados extends PaginaDe<FilaTraslado> { porRecibir: number; conDiferencia: number }

export interface Traslado {
  id: string
  guiaId: string
  guiaNumero: string
  guiaEstado: string
  origenId: string
  origen: string
  destinoId: string
  destino: string
  estado: FilaTraslado['estado']
  salioEn: string
  recibidoEn: string | null
  nota: string | null
  puedeRecibir: boolean
  lineas: { productoId: string; codigo: string | null; descripcion: string | null; unidad: string | null; enviado: number; recibido: number | null; motivoDiferencia: string | null }[]
}

export interface RevisionStockInicial {
  cargan: number
  errores: number
  filas: { fila: number; codigo: string; descripcion?: string; sucursal?: string; cantidad?: number; costo?: number | null; resultado: 'carga' | 'error'; mensaje: string | null }[]
}

/** El tipo de movimiento en palabras (igual que en el back). */
export const NOMBRE_MOVIMIENTO: Record<string, string> = {
  stock_inicial: 'Stock inicial',
  compra: 'Ingreso por compra',
  compra_anulada: 'Ingreso anulado',
  ajuste: 'Ajuste',
  ajuste_anulado: 'Ajuste anulado',
  conteo: 'Conteo físico',
  venta: 'Venta',
  venta_revertida: 'Venta revertida',
  reserva: 'Reserva',
  reserva_liberada: 'Reserva liberada',
  reserva_revertida: 'Reserva revertida',
  despacho: 'Despacho (guía)',
  despacho_revertido: 'Despacho revertido',
  guia_salida: 'Salida con guía',
  guia_revertida: 'Salida con guía revertida',
  devolucion: 'Devolución',
  devolucion_revertida: 'Devolución revertida',
  traslado_salida: 'Traslado salida',
  traslado_revertido: 'Traslado revertido',
  traslado_entrada: 'Traslado entrada',
  traslado_faltante: 'Faltante en traslado',
  traslado_retorno: 'Vuelve al origen',
}

export const PREFIJO_OPERACION: Record<TipoOperacion, string> = {
  ingreso: 'Ingreso por compra', ajuste: 'Ajuste', stock_inicial: 'Stock inicial', conteo: 'Conteo físico',
}

/** Una cantidad como la lee la gente: 1 200 · 62.5 */
export function cantidad(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('es-PE', { maximumFractionDigits: 4 })
}

async function subirExcel<T>(ruta: string, archivo: File): Promise<T> {
  let r: Response
  try {
    r = await fetch(ruta, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream' }, body: archivo })
  } catch {
    throw new ErrorApi(0, 'No se pudo enviar el archivo. Revisa tu conexión e inténtalo otra vez.')
  }
  const texto = await r.text()
  let datos: (T & { error?: string; detalle?: string }) | null = null
  try { datos = texto ? JSON.parse(texto) : null } catch { /* no es JSON */ }
  if (!r.ok) throw new ErrorApi(r.status, [datos?.error, datos?.detalle].filter(Boolean).join(' ') || `Error ${r.status}`)
  return datos as T
}

export const inventarioServicio = {
  estado: () => api.obtener<EstadoInventario>('/api/inventario/estado'),

  configurar: (d: { encendido: boolean; modo: ModoInventario; permitirSinStock: boolean; avisarMinimo: boolean }) =>
    api.cambiar<{ mensaje: string }>('/api/inventario/configuracion', d),

  controlar: (sucursalIds: string[], controlar = true) =>
    api.crear<{ mensaje: string }>('/api/inventario/controlar', { sucursalIds, controlar }),

  marcarBienes: () => api.crear<{ marcados: number; mensaje: string }>('/api/inventario/marcar-bienes'),

  stock: (f: FiltroStock) => api.obtener<PaginaStock>(`/api/inventario/stock?${parametros({ ...f })}`),
  stockExcel: (f: FiltroStock) => api.descargar(`/api/inventario/stock/excel?${parametros({ ...f, pagina: undefined, porPagina: undefined })}`),

  disponible: (productos: string[], f: { sucursalId?: string; tipo?: string; serie?: string }) =>
    api.obtener<Disponible>(`/api/inventario/disponible?${parametros({ productos: productos.join(','), ...f })}`),

  kardex: (productoId: string, f: FiltroKardex) =>
    api.obtener<Kardex>(`/api/inventario/kardex/${productoId}?${parametros({ ...f })}`),
  kardexExcel: (productoId: string, f: FiltroKardex) =>
    api.descargar(`/api/inventario/kardex/${productoId}/excel?${parametros({ ...f, pagina: undefined, porPagina: undefined })}`),

  minimos: (productoId: string) => api.obtener<MinimoEnSucursal[]>(`/api/inventario/minimos/${productoId}`),
  guardarMinimos: (productoId: string, m: { sucursalId: string; minimo: number | null }[]) =>
    api.cambiar<{ mensaje: string }>(`/api/inventario/minimos/${productoId}`, m),

  alertas: () => api.obtener<AlertaInventario[]>('/api/inventario/alertas'),

  // --- Operaciones ---------------------------------------------------------------
  operaciones: (f: { tipo?: string; estado?: string; desde?: string; hasta?: string; sucursalId?: string; q?: string; pagina?: number; porPagina?: number }) =>
    api.obtener<PaginaDe<FilaOperacion>>(`/api/inventario/operaciones?${parametros(f)}`),
  operacion: (id: string) => api.obtener<Operacion>(`/api/inventario/operaciones/${id}`),

  ingresar: (d: {
    sucursalId: string; proveedorId?: string | null; proveedor?: ProveedorNuevo | null; documentoProveedor?: string | null
    fecha?: string | null; moneda: string; nota?: string | null; lineas: LineaOperacion[]
  }) => api.crear<{ id: string; codigo: string; mensaje: string }>('/api/inventario/ingresos', d),

  ajustar: (d: { sucursalId: string; motivo: string; nota: string; lineas: LineaOperacion[] }) =>
    api.crear<{ id: string; codigo: string; mensaje: string }>('/api/inventario/ajustes', d),

  stockInicial: (d: { sucursalId: string; nota?: string | null; lineas: LineaOperacion[] }) =>
    api.crear<{ id: string; codigo: string; mensaje: string }>('/api/inventario/stock-inicial', d),

  plantillaStockInicial: () => api.descargar('/api/inventario/stock-inicial/plantilla'),
  importarStockInicial: (archivo: File, simular: boolean) =>
    subirExcel<RevisionStockInicial & { mensaje?: string }>(`/api/inventario/stock-inicial/importar?simular=${simular}`, archivo),

  anular: (id: string, motivo: string) =>
    api.crear<{ mensaje: string }>(`/api/inventario/operaciones/${id}/anular`, { motivo }),

  abrirConteo: (d: { sucursalId: string; categoriaId?: string | null; productoIds?: string[] | null; nota?: string | null }) =>
    api.crear<{ id: string; codigo: string; mensaje: string }>('/api/inventario/conteos', d),
  guardarConteo: (id: string, lineas: { productoId: string; contado: number | null }[], nota?: string | null) =>
    api.cambiar<{ mensaje: string }>(`/api/inventario/conteos/${id}`, { lineas, nota }),
  cerrarConteo: (id: string) => api.crear<{ mensaje: string }>(`/api/inventario/conteos/${id}/cerrar`),
  descartarConteo: (id: string) => api.crear<{ mensaje: string }>(`/api/inventario/conteos/${id}/descartar`),

  // --- Traslados -----------------------------------------------------------------
  traslados: (f: { filtro?: string; desde?: string; hasta?: string; pagina?: number; porPagina?: number }) =>
    api.obtener<PaginaTraslados>(`/api/inventario/traslados?${parametros(f)}`),
  traslado: (id: string) => api.obtener<Traslado>(`/api/inventario/traslados/${id}`),
  recibir: (id: string, lineas: { productoId: string; recibido: number; motivo?: string | null }[], nota?: string | null) =>
    api.crear<{ estado: string; mensaje: string }>(`/api/inventario/traslados/${id}/recibir`, { lineas, nota }),

  // --- Maestras ------------------------------------------------------------------
  buscarProveedores: (q: string) => api.obtener<Proveedor[]>(`/api/inventario/proveedores?q=${encodeURIComponent(q)}`),
  proveedores: (f: { q?: string; estado?: string; pagina?: number; porPagina?: number }) =>
    api.obtener<PaginaDe<Proveedor>>(`/api/inventario/proveedores/pagina?${parametros(f)}`),
  crearProveedor: (d: Omit<Proveedor, 'id'>) => api.crear<{ id: string; mensaje: string }>('/api/inventario/proveedores', d),
  editarProveedor: (id: string, d: Omit<Proveedor, 'id'>) => api.cambiar<{ mensaje: string }>(`/api/inventario/proveedores/${id}`, d),
  activarProveedor: (id: string, activo: boolean) =>
    api.crear<{ mensaje: string }>(`/api/inventario/proveedores/${id}/${activo ? 'reactivar' : 'desactivar'}`),

  categorias: (todas = false) => api.obtener<Categoria[]>(`/api/inventario/categorias${todas ? '?todas=true' : ''}`),
  crearCategoria: (nombre: string) => api.crear<{ id: string; nombre: string; mensaje: string }>('/api/inventario/categorias', { nombre }),
  renombrarCategoria: (id: string, nombre: string) => api.cambiar<{ mensaje: string }>(`/api/inventario/categorias/${id}`, { nombre }),
  desactivarCategoria: (id: string) => api.crear<{ mensaje: string }>(`/api/inventario/categorias/${id}/desactivar`),
  reactivarCategoria: (id: string) => api.crear<{ mensaje: string }>(`/api/inventario/categorias/${id}/reactivar`),
}