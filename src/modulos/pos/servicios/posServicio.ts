import { api } from '../../../nucleo/api/cliente'

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

export const posServicio = {
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