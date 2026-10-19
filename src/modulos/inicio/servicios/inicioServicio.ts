import { api } from '../../../nucleo/api/cliente'
import type { EstadoDocumento } from '../../facturacion/tipos'

/** GET /api/inicio/resumen — el mes de la empresa abierta. */
export interface Resumen {
  /** El primer día del mes (hora de Lima), «2026-10-01». */
  desde: string
  ambiente: 'beta' | 'produccion' | null

  /** 021: cuándo volvió a su titular, y si falta revisar series y clave SOL. */
  recuperadaEn: string | null
  revisionPendiente: boolean

  /** En soles con IGV: facturas, boletas y notas de débito, menos notas de crédito. */
  vendido: number
  vendidoUsd: number

  emitidos: number
  aceptados: number
  enCamino: number
  rechazados: number
  conError: number

  ultimoRechazo: { id: string; numero: string | null; mensaje: string | null } | null
  certificadoHasta: string | null
  series: string[]
  usuarios: number
  ultimos: UltimoComprobante[]
}

export interface UltimoComprobante {
  id: string
  tipo: string
  serie: string | null
  correlativo: number | null
  cliente: string
  creadoEn: string
  fechaEmision: string
  importeTotal: number
  moneda: string
  estado: EstadoDocumento
}

export const inicioServicio = {
  resumen: () => api.obtener<Resumen>('/api/inicio/resumen'),

  revisionHecha: () => api.crear<{ mensaje: string }>('/api/inicio/revision-hecha'),
}