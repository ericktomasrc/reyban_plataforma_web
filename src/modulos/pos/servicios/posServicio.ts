import { api } from '../../../nucleo/api/cliente'
import type { OfertaActiva, TipoOferta } from '../ofertas'

/** e173 (055) — el punto de venta y la caja. */

export interface SesionCaja {
  id: string
  cajaId: string
  caja: string
  sucursalId: string
  sucursal: string
  abiertaEn: string
  fondo: number
}

export interface CajaDeSucursal {
  id: string
  nombre: string
  abiertaPor: string | null
  ultimoCierre: { en: string; por: string; deja: number | null } | null
}

export interface SucursalPos { id: string; codigo: string; nombre: string; cajas: CajaDeSucursal[] }

export interface EstadoPos {
  sesion: SesionCaja | null
  sucursales: SucursalPos[]
  puede: { movimientos: boolean; descuentos: boolean; cajasVer: boolean }
}

export type MedioPago = 'efectivo' | 'yape' | 'tarjeta' | 'transferencia'
export const MEDIOS: { codigo: MedioPago; nombre: string }[] = [
  { codigo: 'efectivo', nombre: 'Efectivo' },
  { codigo: 'yape', nombre: 'Yape / Plin' },
  { codigo: 'tarjeta', nombre: 'Tarjeta' },
  { codigo: 'transferencia', nombre: 'Transferencia' },
]
export const nombreMedio = (m: string) => MEDIOS.find(x => x.codigo === m)?.nombre ?? m

export interface LineaPos {
  productoId: string | null
  codigo: string | null
  descripcion: string
  unidadMedida: string
  cantidad: number
  valorUnitario: number
  descuento: number
  tipoAfectacion: string
  /** 061: vendida en una presentación (CAJA X 12). */
  presentacionId?: string | null
}

export interface PeticionCobrar {
  tipo: '01' | '03'
  serie: string
  clienteId: string
  lineas: LineaPos[]
  pagos: { medio: MedioPago; monto: number; referencia?: string }[]
  recibido?: number
  whatsapp?: boolean
  documentoId?: string
}

export interface Cobrado {
  id: string
  numero: string
  estado: string
  total: number
  tipo: string
  vuelto: number
  mensaje: string
}

export interface ArqueoSistema {
  fondo: number
  medios: { medio: MedioPago; ventas: number; monto: number }[]
  ventas: number
  vendido: number
  efectivo: number
  ingresos: number
  retiros: number
  ingresosCuantos: number
  retirosCuantos: number
  noCuentan: number
}

export interface DetalleCaja {
  sesion: {
    id: string; caja: string; sucursal: string; usuario: string; abiertaEn: string; fondo: number; notaApertura: string | null
    cerradaEn: string | null; cerradaPor: string | null; esperado: number | null; contado: number | null; diferencia: number | null
    observacion: string | null; dejaEnCaja: number | null; entrega: number | null; resumen: ArqueoSistema | null
  }
  arqueo: ArqueoSistema
  esperado: number
  movimientos: { tipo: 'ingreso' | 'retiro'; monto: number; motivo: string; detalle: string | null; en: string; por: string | null }[]
  ventas: { id: string; tipo: string; estado: string; total: number; vuelto: number; en: string; numero: string; cliente: string
            pagos: { medio: MedioPago; monto: number; referencia: string | null }[] | null }[]
}

export interface FilaCaja {
  id: string; caja: string; sucursal: string; usuario: string; abiertaEn: string; cerradaEn: string | null; fondo: number
  ventas: number; vendido: number; esperado: number | null; contado: number | null; diferencia: number | null
}

/** e278 (093): las cajas de cada sucursal, para crearlas, nombrarlas o desactivarlas. */
export interface CajaConfig { id: string; nombre: string; activo: boolean; creadoEn: string; abiertaPor: string | null; aperturas: number; ultimoUso: string | null }
export interface SucursalCajas { id: string; codigo: string; nombre: string; cajas: CajaConfig[] }
export interface ConfigCajas { puedeCambiar: boolean; sucursales: SucursalCajas[] }

/** e279 (094): las ofertas. */
export type EstadoOferta = 'activa' | 'programada' | 'pausada' | 'terminada'
export interface ProductoDeOferta { productoId: string; codigo: string; descripcion: string; cantidad: number; precio: number }
export interface FilaOferta {
  id: string; nombre: string; tipo: TipoOferta; precio: number; lote: string | null; loteVence: string | null; loteQuedan: number | null
  desde: string; hasta: string | null; todasSucursales: boolean; sucursales: string[]; nombresSucursales: string[]
  limite: number | null; estado: 'activa' | 'pausada' | 'terminada'; estadoLista: EstadoOferta
  vendidas: number; cobrado: number; descuento: number; productos: ProductoDeOferta[]; creadoEn: string
}
export interface ListaOfertas {
  puedeCambiar: boolean; hoy: string; activas: number; terminanSemana: number; cobradoMes: number; descuentoMes: number
  ventasMes: number; lotesPorVencer: number; filas: FilaOferta[]
}
export interface ProductoParaOferta {
  id: string; codigo: string; descripcion: string; unidadMedida: string; precio: number; tipoAfectacion: string; manejaLotes: boolean; costo: number | null
}
export interface PeticionOferta {
  nombre: string; tipo: TipoOferta; precio: number; lote: string | null; desde: string; hasta: string | null
  todasSucursales: boolean; sucursales: string[]; limite: number | null; productos: { productoId: string; cantidad: number }[]
}

export const posServicio = {
  ofertas: () => api.obtener<ListaOfertas>('/api/pos/ofertas'),
  ofertasExcel: () => api.descargar('/api/pos/ofertas?formato=xlsx'),
  ofertasActivas: (sucursalId: string) => api.obtener<OfertaActiva[]>(`/api/pos/ofertas/activas?sucursalId=${sucursalId}`),
  productosParaOferta: () => api.obtener<ProductoParaOferta[]>('/api/pos/ofertas/productos'),
  lotesParaOferta: (productoId: string) => api.obtener<{ lote: string; vence: string | null; quedan: number }[]>(`/api/pos/ofertas/lotes?productoId=${productoId}`),
  crearOferta: (d: PeticionOferta) => api.crear<{ id: string; mensaje: string }>('/api/pos/ofertas', d),
  cambiarOferta: (id: string, d: PeticionOferta) => api.cambiar<{ mensaje: string }>(`/api/pos/ofertas/${id}`, d),
  estadoOferta: (id: string, estado: 'activa' | 'pausada' | 'terminada') => api.crear<{ mensaje: string }>(`/api/pos/ofertas/${id}/estado`, { estado }),
  configCajas: () => api.obtener<ConfigCajas>('/api/pos/config-cajas'),
  crearCaja: (sucursalId: string, nombre: string) => api.crear<{ id: string; mensaje: string }>('/api/pos/config-cajas', { sucursalId, nombre }),
  renombrarCaja: (id: string, nombre: string) => api.cambiar<{ mensaje: string }>(`/api/pos/config-cajas/${id}`, { nombre }),
  activarCaja: (id: string, activo: boolean) => api.crear<{ mensaje: string }>(`/api/pos/config-cajas/${id}/activo`, { activo }),
  estado: () => api.obtener<EstadoPos>('/api/pos/estado'),
  abrir: (d: { sucursalId: string; fondo: number; nota?: string; cajaId?: string }) =>
    api.crear<{ sesion: SesionCaja; mensaje: string }>('/api/pos/abrir', d),
  movimiento: (d: { tipo: 'ingreso' | 'retiro'; monto: number; motivo: string; detalle?: string }) =>
    api.crear<{ mensaje: string }>('/api/pos/movimientos', d),
  cobrar: (d: PeticionCobrar) => api.crear<Cobrado>('/api/pos/cobrar', d),
  resumen: () => api.obtener<DetalleCaja>('/api/pos/resumen'),
  cerrar: (d: { contado: number; observacion?: string; dejaEnCaja?: number; entrega?: number }) =>
    api.crear<{ id: string; mensaje: string }>('/api/pos/cerrar', d),
  cajas: (pagina = 1) =>
    api.obtener<{ total: number; pagina: number; porPagina: number; filas: FilaCaja[] }>(`/api/pos/cajas?pagina=${pagina}`),
  caja: (id: string) => api.obtener<DetalleCaja>(`/api/pos/cajas/${id}`),
}