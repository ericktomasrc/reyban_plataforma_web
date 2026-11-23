import { NOMBRE_MEDIO } from '../deudas/deudasServicio'
import type { FilaNota } from './notasVentaServicio'

/** e282 (097): formatos compartidos de las notas de venta. */
export const dinero = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const enLima = (iso: string) => new Date(iso).toLocaleString('es-PE', {
  timeZone: 'America/Lima', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
export const claseEstado: Record<string, string> = { por_cobrar: 'ojo', pagada: 'bien', pedido: 'gris', convertida: 'bien', anulada: 'mal' }

/** «Fiado · vence 30 nov.», «Contado · efectivo», «Pedido · entrega 23 nov.». */
export function detalleNota(n: Pick<FilaNota, 'forma' | 'medio' | 'vence' | 'entregaFecha' | 'entregadoEn' | 'estado'>) {
  const corto = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
  const partes = [n.forma === 'contado' ? 'Contado' : n.forma === 'fiado' ? 'Fiado' : 'Pedido']
  if (n.forma === 'contado' && n.medio) partes.push(NOMBRE_MEDIO[n.medio]?.toLowerCase() ?? n.medio)
  if (n.forma === 'fiado' && n.vence) partes.push(`paga hasta el ${corto(n.vence)}`)
  if (n.forma === 'pedido') partes.push(n.entregaFecha ? `entrega ${corto(n.entregaFecha)}` : 'por entregar')
  else if (!n.entregadoEn && n.estado !== 'anulada') partes.push('se lo lleva después')
  return partes.join(' · ')
}