import { api } from '../../nucleo/api/cliente'

/** e267 (090): cobros y pagos. «cobrar» = lo que te deben · «pagar» = lo que debes. */
export type Lado = 'cobrar' | 'pagar'
export type EstadoDeuda = 'vencida' | 'porvencer' | 'aldia' | 'pagada'
export type FiltroDeuda = 'pendientes' | 'vencidas' | 'porvencer' | 'pagadas' | 'todas'
export type MedioPago = 'efectivo' | 'yape' | 'tarjeta' | 'transferencia' | 'otro'

export interface Deuda {
  /** 097: «nota» = nota de venta fiada. */
  origen: 'documento' | 'compra' | 'nota'
  id: string
  nombre: string
  tipoDoc: string | null
  numeroDoc: string | null
  comprobante: string
  /** Por cobrar: 01 factura · 03 boleta · NV nota de venta. Por pagar: el tipo de la compra. */
  tipo: string
  clase: 'compra' | 'gasto' | null
  emitido: string
  vence: string
  /** La cuota que toca (1 de 3); null en una compra. */
  cuota: number | null
  cuotas: number | null
  moneda: 'PEN' | 'USD'
  total: number
  /** Lo que bajaron las notas de crédito. */
  nc: number
  pagado: number
  saldo: number
  estado: EstadoDeuda
  /** Días hasta que vence (negativo = días de atraso). */
  dias: number
  ultimoPago: string | null
}

export interface PagoDeuda {
  id: string
  fecha: string
  monto: number
  medio: MedioPago
  referencia: string | null
  nota: string | null
  anuladoEn: string | null
  anuladoMotivo: string | null
  registro: string
}

export interface DetalleDeuda extends Deuda {
  detalleCuotas: { numero: number; monto: number; vence: string }[]
  pagos: PagoDeuda[]
}

export interface PaginaDeudas {
  lado: Lado
  total: number
  pagina: number
  porPagina: number
  cifras: {
    pendiente: number; pendientes: number; pendienteUsd: number
    vencido: number; vencidas: number
    semana: number; porVencer: number
    personas: number; pagadas: number
    mes: number; pagosMes: number
  }
  filas: Deuda[]
}

export const MEDIOS: [MedioPago, string][] = [
  ['efectivo', 'Efectivo'], ['yape', 'Yape / Plin'], ['tarjeta', 'Tarjeta'], ['transferencia', 'Transferencia'], ['otro', 'Otro'],
]
export const NOMBRE_MEDIO: Record<string, string> = Object.fromEntries(MEDIOS)

const parametros = (f: { lado: Lado; estado?: FiltroDeuda; q?: string; pagina?: number; porPagina?: number }) => {
  const p = new URLSearchParams({ lado: f.lado })
  if (f.estado) p.set('estado', f.estado)
  if (f.q) p.set('q', f.q)
  if (f.pagina) p.set('pagina', String(f.pagina))
  if (f.porPagina) p.set('porPagina', String(f.porPagina))
  return p
}

export const deudasServicio = {
  listar: (f: { lado: Lado; estado?: FiltroDeuda; q?: string; pagina?: number; porPagina?: number }) =>
    api.obtener<PaginaDeudas>(`/api/deudas?${parametros(f)}`),
  excel: (f: { lado: Lado; estado?: FiltroDeuda; q?: string }) => {
    const p = parametros(f); p.set('formato', 'xlsx')
    return api.descargar(`/api/deudas?${p}`)
  },
  ver: (origen: Deuda['origen'], id: string) => api.obtener<DetalleDeuda>(`/api/deudas/${origen}/${id}`),
  pagar: (d: { origen: Deuda['origen']; id: string; monto: number; fecha: string; medio: MedioPago; referencia?: string | null; nota?: string | null }) =>
    api.crear<{ id: string; saldo: number; mensaje: string }>('/api/deudas/pagos', d),
  anularPago: (id: string, motivo: string) => api.crear<{ mensaje: string }>(`/api/deudas/pagos/${id}/anular`, { motivo }),
}