import { api } from '../../nucleo/api/cliente'

/**
 * e274 (091) — VENTAS (la plataforma) y PAGOS Y COMPROBANTES (la cuenta).
 * Solo lectura. Las ventas, por defecto, son solo dinero de verdad (Culqi
 * real y pagos a mano); `pruebas` suma los de prueba.
 */
export type EstadoVenta = 'pagado' | 'rechazado' | 'devuelto' | 'anulado' | 'procesando'

export interface ResumenVentas {
  mes: number; mesPagos: number; hoy: number; hoyPagos: number
  fijo: number; clientes: number; semana: number; semanaCuentas: number
  atrasados: number; atrasadoMonto: number; rechazadosMes: number
}

export interface Venta {
  id: string; numero: number; fecha: string; cuentaId: string; cuenta: string | null; tipoCuenta: string
  empresa: string | null; empresas: number; plan: string; periodo: 'mensual' | 'anual' | 'otro'; concepto: string
  medio: string; modo: string; tarjeta: string | null; monto: number; estado: EstadoVenta; error: string | null
  referencia: string | null; comprobante: string; comprobanteNumero: string | null
}

export interface PaginaVentas { total: number; suma: number; filas: Venta[] }

export interface FiltroVentas {
  estado?: EstadoVenta | ''; q?: string; desde?: string; hasta?: string; plan?: string; medio?: '' | 'tarjeta' | 'otro'
  pruebas?: boolean; pagina?: number; porPagina?: number
}

export interface ReportesVentas {
  meses: { mes: string; cobrado: number; pagos: number }[]
  planes: { plan: string; clientes: number; cobrado: number }[]
  atrasados: {
    cuentaId: string; cuenta: string | null; estado: 'reintento' | 'gracia' | 'no_emite'; intentos: number
    proximo: string | null; fallaDesde: string | null; plan: string | null; tarjeta: string | null; debe: number | null; error: string | null
  }[]
}

export interface PagoMio {
  id: string; numero: number; fecha: string; concepto: string; desde: string; hasta: string; medio: string; modo: string
  tarjeta: string | null; monto: number; estado: EstadoVenta; error: string | null
  comprobanteNumero: string | null; comprobanteTipo: '01' | '03' | null; comprobanteListo: boolean
}

export interface MisPagos {
  anio: number; anios: number[]; pagadoAnio: number; pagosAnio: number; pagadoMes: number
  plan: string | null; planMensual: number | null; proximo: string | null; estadoPago: string; tarjeta: string | null
  filas: PagoMio[]; porMes: { mes: number; pagos: number; total: number }[]
}

function parametros(f: FiltroVentas, excel = false) {
  const p = new URLSearchParams()
  if (f.estado) p.set('estado', f.estado)
  if (f.q) p.set('q', f.q)
  if (f.desde) p.set('desde', f.desde)
  if (f.hasta) p.set('hasta', f.hasta)
  if (f.plan) p.set('plan', f.plan)
  if (f.medio) p.set('medio', f.medio)
  if (f.pruebas) p.set('pruebas', 'true')
  if (excel) p.set('formato', 'xlsx')
  else { p.set('pagina', String(f.pagina ?? 1)); p.set('porPagina', String(f.porPagina ?? 20)) }
  return p.toString()
}

export const ventasServicio = {
  resumen: (pruebas: boolean) => api.obtener<ResumenVentas>(`/api/admin/ventas/resumen${pruebas ? '?pruebas=true' : ''}`),
  listar: (f: FiltroVentas) => api.obtener<PaginaVentas>(`/api/admin/ventas?${parametros(f)}`),
  excel: (f: FiltroVentas) => api.descargar(`/api/admin/ventas?${parametros(f, true)}`),
  reportes: (meses: number, pruebas: boolean) =>
    api.obtener<ReportesVentas>(`/api/admin/ventas/reportes?meses=${meses}${pruebas ? '&pruebas=true' : ''}`),
  reportesExcel: (meses: number, pruebas: boolean) =>
    api.descargar(`/api/admin/ventas/reportes?meses=${meses}${pruebas ? '&pruebas=true' : ''}&formato=xlsx`),

  misPagos: (anio?: number) => api.obtener<MisPagos>(`/api/cobros/mis-pagos${anio ? `?anio=${anio}` : ''}`),
  misPagosExcel: (anio: number) => api.descargar(`/api/cobros/mis-pagos?anio=${anio}&formato=xlsx`),
  comprobante: (id: string, archivo: 'pdf' | 'xml') => api.descargar(`/api/cobros/${id}/comprobante/${archivo}`),
}

export const dinero = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const NOMBRE_ESTADO: Record<EstadoVenta, string> = {
  pagado: 'Pagado', rechazado: 'Rechazado', devuelto: 'Devuelto', anulado: 'Anulado', procesando: 'Procesando',
}
export const CLASE_ESTADO: Record<EstadoVenta, string> = {
  pagado: 'bien', rechazado: 'mal', devuelto: 'gris', anulado: 'gris', procesando: 'ojo',
}
export function textoMedio(medio: string, tarjeta: string | null) {
  if (medio === 'tarjeta') return tarjeta ?? 'Tarjeta'
  return ({ transferencia: 'Transferencia', deposito: 'Depósito', yape: 'Yape', efectivo: 'Efectivo' } as Record<string, string>)[medio] ?? 'Otro'
}
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']