import { api } from '../../nucleo/api/cliente'

/** e178 (059): compras y gastos. */
export type ClaseCompra = 'compra' | 'gasto'

export interface Compra {
  id: string
  clase: ClaseCompra
  fecha: string
  sucursalId: string | null
  proveedorTipoDoc: string | null
  proveedorDoc: string | null
  proveedorNombre: string | null
  comprobanteTipo: string
  serie: string | null
  numero: string | null
  moneda: 'PEN' | 'USD'
  tipoCambio: number | null
  base: number
  igv: number
  noGravado: number
  total: number
  categoria: string
  descripcion: string | null
  invOperacionId: string | null
  /** e182: el código del ingreso al stock (IN-0003), si entró. */
  ingreso?: string | null
  proveedorId?: string | null
  anuladaEn: string | null
  anuladaMotivo: string | null
  creadoEn: string
  registro: string
}

export interface PaginaCompras {
  total: number
  pagina: number
  porPagina: number
  totales: { base: number; igv: number; noGravado: number; total: number }
  conteo: { compras: number; gastos: number; anuladas: number }
  filas: Compra[]
}

export interface PeticionCompra {
  clase: ClaseCompra
  fecha: string
  proveedorTipoDoc?: string | null
  proveedorDoc?: string | null
  proveedorNombre?: string | null
  comprobanteTipo: string
  serie?: string | null
  numero?: string | null
  moneda: 'PEN' | 'USD'
  tipoCambio?: number | null
  base?: number | null
  igv?: number | null
  noGravado?: number | null
  total: number
  categoria: string
  descripcion?: string | null
}

export const TIPOS_COMPROBANTE: [string, string][] = [
  ['01', 'Factura'], ['03', 'Boleta'], ['02', 'Recibo por honorarios'], ['12', 'Ticket'], ['14', 'Recibo de servicios (luz, agua…)'], ['00', 'Sin comprobante'],
]
export const NOMBRE_TIPO: Record<string, string> = Object.fromEntries(TIPOS_COMPROBANTE)

export const CATEGORIAS: [string, string][] = [
  ['mercaderia', 'Mercadería para vender'], ['insumos', 'Insumos y materiales'], ['activos', 'Equipos y muebles'],
  ['alquiler', 'Alquiler'], ['servicios', 'Luz, agua, internet, teléfono'], ['sueldos', 'Sueldos y honorarios'],
  ['transporte', 'Transporte y movilidad'], ['impuestos', 'Impuestos y tasas'], ['publicidad', 'Publicidad'], ['otros', 'Otros'],
]
export const NOMBRE_CATEGORIA: Record<string, string> = Object.fromEntries(CATEGORIAS)

export const comprasServicio = {
  listar: (f: { desde: string; hasta: string; clase?: ClaseCompra; estado?: 'anuladas'; q?: string; pagina?: number; porPagina?: number }) => {
    const p = new URLSearchParams({ desde: f.desde, hasta: f.hasta })
    if (f.clase) p.set('clase', f.clase)
    if (f.estado) p.set('estado', f.estado)
    if (f.q) p.set('q', f.q)
    if (f.pagina) p.set('pagina', String(f.pagina))
    if (f.porPagina) p.set('porPagina', String(f.porPagina))
    return api.obtener<PaginaCompras>(`/api/compras?${p}`)
  },
  crear: (d: PeticionCompra) => api.crear<{ id: string; mensaje: string }>('/api/compras', d),
  editar: (id: string, d: PeticionCompra) => api.cambiar<{ id: string; mensaje: string }>(`/api/compras/${id}`, d),
  ver: (id: string) => api.obtener<Compra>(`/api/compras/${id}`),
  /** e182: la compra ya entró al stock con este ingreso. */
  enlazarIngreso: (id: string, operacionId: string) => api.crear<{ mensaje: string }>(`/api/compras/${id}/ingreso`, { operacionId }),
  anular: (id: string, motivo: string) => api.crear<{ mensaje: string }>(`/api/compras/${id}/anular`, { motivo }),
}