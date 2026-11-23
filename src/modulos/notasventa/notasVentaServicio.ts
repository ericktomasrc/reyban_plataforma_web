import { api } from '../../nucleo/api/cliente'
import type { MedioPago } from '../deudas/deudasServicio'

/** e282 (097): notas de venta (sin SUNAT): contado, fiado o pedido. */
export type FormaNota = 'contado' | 'fiado' | 'pedido'
export type EstadoNota = 'por_cobrar' | 'pagada' | 'pedido' | 'convertida' | 'anulada'
export type FiltroNota = 'todas' | 'por_cobrar' | 'pedidos' | 'pagadas' | 'convertidas' | 'anuladas'

export interface FilaNota {
  id: string
  numero: string
  fecha: string
  cliente: string
  clienteDoc: string | null
  forma: FormaNota
  medio: MedioPago | null
  vence: string | null
  entregaFecha: string | null
  /** null = todavía no se lo lleva (el stock está separado). */
  entregadoEn: string | null
  total: number
  pagado: number
  saldo: number
  documentoId: string | null
  documento: string | null
  documentoTipo: string | null
  estado: EstadoNota
  vendedor: string | null
}

export interface PaginaNotas {
  total: number
  pagina: number
  porPagina: number
  cifras: {
    vendidoMes: number; notasMes: number
    fiado: number; fiadoClientes: number
    pedidos: number; pedidosMonto: number
    convertidasMes: number
  }
  filas: FilaNota[]
}

export interface LineaNota {
  numero: number
  productoId: string
  codigo: string | null
  descripcion: string
  unidadMedida: string
  tipoAfectacion: string
  cantidad: number
  /** Por unidad, con IGV si es gravado (lo que se cobra). */
  precio: number
  /** Lo mismo sin IGV (para convertirla en boleta o factura). */
  valorUnitario: number
  importe: number
  presentacionId: string | null
  factor: number | null
}

export interface PagoNota {
  id: string
  fecha: string
  monto: number
  medio: MedioPago
  referencia: string | null
  anuladoEn: string | null
  anuladoMotivo: string | null
  registro: string
}

export interface NotaVenta {
  id: string
  numero: string
  fecha: string
  sucursalId: string
  cliente: { id: string; nombre: string; tipoDocumento: string | null; numeroDocumento: string | null } | null
  clienteNombre: string
  forma: FormaNota
  medio: MedioPago | null
  vence: string | null
  entregaFecha: string | null
  entregadoEn: string | null
  total: number
  pagado: number
  saldo: number
  estado: EstadoNota
  vendedor: string | null
  nota: string | null
  anuladoEn: string | null
  anuladoMotivo: string | null
  documento: { id: string; numero: string; tipo: string } | null
  /** Boletas o facturas a medio hacer (borrador o que no llegaron) desde esta nota. */
  borradores: { id: string; tipo: string }[]
  lineas: LineaNota[]
  pagos: PagoNota[]
  emisor: { nombre: string; razonSocial: string | null; ruc: string | null; direccion: string | null; sucursal: string; telefono: string | null } | null
  puede: { emitir: boolean; anular: boolean }
}

export interface PeticionNota {
  sucursalId?: string | null
  clienteId?: string | null
  forma: FormaNota
  medio?: MedioPago | null
  vence?: string | null
  entregaFecha?: string | null
  seLoLleva?: boolean
  lineas: { productoId: string; cantidad: number; precio: number; presentacionId?: string | null }[]
  nota?: string | null
}

export const NOMBRE_FORMA: Record<FormaNota, string> = { contado: 'Contado', fiado: 'Fiado', pedido: 'Pedido' }
export const NOMBRE_ESTADO: Record<EstadoNota, string> = {
  por_cobrar: 'Por cobrar', pagada: 'Pagada', pedido: 'Pedido', convertida: 'Convertida', anulada: 'Anulada',
}

type Filtro = { estado?: FiltroNota; q?: string; desde?: string; hasta?: string; pagina?: number; porPagina?: number }
const parametros = (f: Filtro) => {
  const p = new URLSearchParams()
  if (f.estado && f.estado !== 'todas') p.set('estado', f.estado)
  if (f.q) p.set('q', f.q)
  if (f.desde) p.set('desde', f.desde)
  if (f.hasta) p.set('hasta', f.hasta)
  if (f.pagina) p.set('pagina', String(f.pagina))
  if (f.porPagina) p.set('porPagina', String(f.porPagina))
  return p
}

export const notasVentaServicio = {
  listar: (f: Filtro) => api.obtener<PaginaNotas>(`/api/notas-venta?${parametros(f)}`),
  excel: (f: Filtro) => { const p = parametros(f); p.set('formato', 'xlsx'); return api.descargar(`/api/notas-venta?${p}`) },
  ver: (id: string) => api.obtener<NotaVenta>(`/api/notas-venta/${id}`),
  crear: (p: PeticionNota) => api.crear<{ id: string; numero: string; mensaje: string }>('/api/notas-venta', p),
  entregar: (id: string, p: { forma?: 'contado' | 'fiado'; medio?: MedioPago; vence?: string }) =>
    api.crear<{ mensaje: string }>(`/api/notas-venta/${id}/entregar`, p),
  anular: (id: string, motivo: string) => api.crear<{ mensaje: string }>(`/api/notas-venta/${id}/anular`, { motivo }),
  pagar: (id: string, p: { monto: number; fecha: string; medio: MedioPago; referencia?: string | null }) =>
    api.crear<{ saldo: number; mensaje: string }>(`/api/notas-venta/${id}/pagos`, p),
  anularPago: (id: string, motivo: string) => api.crear<{ mensaje: string }>(`/api/notas-venta/pagos/${id}/anular`, { motivo }),
}