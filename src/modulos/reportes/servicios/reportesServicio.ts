import { api } from '../../../nucleo/api/cliente'

// =============================================================================
// 032 — REPORTES. Solo lectura. Las cuentas las hace la base; aquí se piden.
// `formato=xlsx` baja el mismo reporte en Excel.
// =============================================================================

export type NombreReporte = 'mi-dia' | 'ventas' | 'clientes' | 'productos' | 'vendedores' | 'sucursales'
  | 'igv' | 'registro' | 'problemas' | 'anulados' | 'personas-notas'
  | 'cartera' | 'admin/plataforma' | 'admin/empresas' | 'admin/rechazos' | 'admin/cuentas'
  | 'admin/activacion' | 'admin/riesgo' | 'admin/consumo'
  | 'pos' | 'compras'   // e178
  | 'margen' | 'resultados' | 'valorizado'   // e179

/** 036: los del super administrador viven en /api/admin/reportes. */
function ruta(reporte: NombreReporte) {
  return reporte.startsWith('admin/') ? `/api/admin/reportes/${reporte.slice(6)}` : `/api/reportes/${reporte}`
}

export interface Filtros {
  desde?: string
  hasta?: string
  moneda: 'PEN' | 'USD'
  /** 037: búsqueda y filtros. Se aplican en el servidor: la pantalla y el Excel traen lo mismo. */
  q?: string
  tipo?: string
  estado?: string
  sunat?: 'real' | 'prueba'
}

function consulta(f: Filtros, formato?: string) {
  const p = new URLSearchParams()
  if (f.desde) p.set('desde', f.desde)
  if (f.hasta) p.set('hasta', f.hasta)
  p.set('moneda', f.moneda)
  if (f.q) p.set('q', f.q)
  if (f.tipo) p.set('tipo', f.tipo)
  if (f.estado) p.set('estado', f.estado)
  if (f.sunat) p.set('sunat', f.sunat)
  if (formato) p.set('formato', formato)
  return p.toString()
}

interface Comun {
  ambiente: 'beta' | 'produccion'
  /** 037: viene en true cuando la búsqueda o un filtro dejó fuera alguna fila. */
  filtrado?: boolean
  desde: string
  hasta: string
  moneda: string
}

export interface ReporteMiDia extends Comun {
  total: number
  facturas: number
  boletas: number
  notas: number
  enCamino: number
  problemas: number
  porHora: { hora: number; total: number }[]
  ultimos: { id: string; tipo: string; numero: string; estado: string; total: number; cliente: string; hora: string }[]
}

export interface ReporteVentas extends Comun {
  kpis: { total: number; facturas: number; boletas: number; notas: number; montoNotas: number; promedio: number }
  igv: { gravado: number; exonerado: number; exportacion: number; igv: number; total: number }
  porDia: { fecha: string; total: number }[]
  porTipo: { tipo: string; cantidad: number; total: number }[]
  topClientes: { cliente: string; documento: string; total: number }[]
  anterior: { desde: string; hasta: string; total: number }
}

/** e179 (060): de dónde sale el costo. */
export type FuenteCosto = 'real' | 'manual' | 'sin'

export interface ReporteMargen extends Comun {
  activadoEn: string | null
  ventas: number
  costo: number
  ventasReal: number
  ventasManual: number
  ventasSinCosto: number
  porProducto: { producto: string; codigo: string | null; unidad: string; cantidad: number; venta: number; costo: number | null; fuente: FuenteCosto }[]
  porCliente: { cliente: string; documento: string; venta: number | null; costo: number | null; sinCosto: number }[]
  porMes: { mes: string; venta: number; costo: number; sinCosto: number; manual: number }[]
}

export interface ReporteResultados extends Comun {
  activadoEn: string | null
  meses: { mes: string; ventas: number; costo: number; sinCosto: number; gastos: number }[]
  gastos: { categoria: string; monto: number }[]
}

export interface ReporteValorizado extends Comun {
  filas: { id: string; codigo: string; producto: string; unidad: string; sucursal: string; fisico: number; costo: number | null; fuente: FuenteCosto; valor: number | null }[]
}

/** e178 (059): compras y gastos. */
export interface ReporteCompras extends Comun {
  compras: number
  gastos: number
  igv: number
  porProveedor: { proveedor: string; documento: string; comprobantes: number; base: number; igv: number; total: number }[]
  porCategoria: { categoria: string; clase: 'compra' | 'gasto'; cuantos: number; total: number }[]
  porMes: { mes: string; compras: number | null; gastos: number | null; igv: number | null }[]
  registro: { id: string; fecha: string; tipo: string; serie: string | null; numero: string | null; tipoDoc: string | null; documento: string | null;
              proveedor: string | null; moneda: string; tipoCambio: number | null; base: number; igv: number; noGravado: number; total: number;
              clase: 'compra' | 'gasto'; categoria: string; descripcion: string | null }[]
}

/** e178: los reportes del punto de venta. */
export interface ReportePos extends Comun {
  ventas: number
  total: number
  cajeros: { cajero: string; caja: string; ventas: number; total: number; promedio: number; turnos: number }[]
  medios: { medio: string; ventas: number; monto: number }[]
  mediosPorDia: { fecha: string; medio: string; monto: number }[]
  horas: { hora: number; ventas: number; total: number }[]
  diferencias: { id: string; cerrada: string; cajero: string; caja: string; esperado: number | null; contado: number | null; diferencia: number | null; observacion: string | null }[]
  movimientos: { tipo: 'ingreso' | 'retiro'; motivo: string; veces: number; monto: number }[]
  productos: { codigo: string; producto: string; unidad: string; cantidad: number; total: number; ventas: number }[]
}

export interface ReporteClientes extends Comun {
  total: number
  filas: { cliente: string; documento: string; comprobantes: number; base: number; igv: number; total: number }[]
}

export interface ReporteProductos extends Comun {
  total: number
  filas: { producto: string; codigo: string | null; unidad: string; cantidad: number | null; base: number; total: number }[]
}

export interface ReporteVendedores extends Comun {
  total: number
  /** e147: la empresa tiene más de un local: sale la columna «Sucursal» (una fila por persona y sucursal). */
  variasSucursales?: boolean
  filas: { vendedor: string; sucursal?: string; comprobantes: number; notas: number; total: number }[]
}

/** e147: Ventas por sucursal (también las que no vendieron, si las puede ver). */
export interface ReporteSucursales extends Comun {
  total: number
  filas: { codigo: string | null; sucursal: string; activa: boolean; facturas: number; boletas: number; notas: number;
           base: number; igv: number; total: number }[]
}

// --- 034: SUNAT y contabilidad (montos en soles) ----------------------------

export interface ReporteIgv extends Comun {
  sinTipoCambio: number
  filas: { mes: string; comprobantes: number; notas: number; gravado: number; exonerado: number;
           inafecto: number; exportacion: number; igv: number; total: number }[]
  porTipo: { tipo: string; cantidad: number; base: number; igv: number; total: number }[]
  /** e176: lo mismo por día (para abrir cada mes). */
  dias?: { fecha: string; comprobantes: number; notas: number; gravado: number; exonerado: number;
           inafecto: number; exportacion: number; igv: number; total: number }[]
}

export interface ReporteRegistro extends Comun {
  filas: { id: string; fecha: string; vence: string | null; tipo: string; serie: string; numero: number;
           tipoDoc: string; documento: string; cliente: string; exportacion: number; gravado: number;
           exonerado: number; inafecto: number; igv: number; total: number; moneda: string;
           tipoCambio: number | null; refFecha: string | null; refTipo: string | null;
           refSerie: string | null; refNumero: number | null; estado: string }[]
}

export interface ReporteProblemas extends Comun {
  filas: { id: string; fecha: string; tipo: string; numero: string | null; cliente: string; total: number;
           moneda: string; estado: string; codigo: string | null; mensaje: string | null;
           observaciones: string[] | null }[]
}

export interface ReporteAnulados extends Comun {
  filas: { id: string; fecha: string; tipo: string; numero: string; cliente: string; total: number; moneda: string;
           estado: string; tipoNota: string | null; motivo: string | null; afecta: string | null; afectaId: string | null
           /** e147 */
           sucursal?: string; emitio?: string; anulo?: string | null }[]
}

/** e147: Notas y anulaciones por persona (en soles). */
export interface ReportePersonasNotas extends Comun {
  filas: { persona: string; cargo: string | null; notasCredito: number; montoNotasCredito: number;
           notasDebito: number; montoNotasDebito: number; anulaciones: number; montoAnulaciones: number;
           acciones: number }[]
}

// --- 036: cartera y plataforma ----------------------------------------------

interface Periodo { desde: string; hasta: string; ambiente?: string; filtrado?: boolean }

export interface ReporteCartera extends Periodo {
  filas: { id: string; nombre: string; ruc: string | null; ambiente: string; pausada: boolean;
           certificadoHasta: string | null; comprobantes: number; notas: number; total: number;
           rechazados: number; pendientes: number; ultimo: string | null }[]
}

export interface ReportePlataforma extends Periodo {
  empresas: number; empresasReal: number; cuentas: number; cuentasNuevas: number
  reales: number; prueba: number; rechazados: number
  porDia: { fecha: string; reales: number; prueba: number }[]
  topEmpresas: { empresa: string; ruc: string | null; comprobantes: number }[]
}

export interface ReporteEmpresasMes extends Periodo {
  filas: { empresa: string; ruc: string | null; mes: string; ambiente: string; facturas: number; boletas: number;
           notas: number; rechazados: number; total: number }[]
}

export interface ReporteRechazos extends Periodo {
  filas: { codigo: string; cantidad: number; empresas: number; mensaje: string | null; ultimo: string }[]
}

export interface ReporteCuentas extends Periodo {
  porDia: { fecha: string; negocio: number; profesional: number }[]
  filas: { fecha: string; tipo: string; titular: string | null; correo: string | null; empresas: number }[]
}

/** e148: en qué paso se quedó cada cuenta registrada en el periodo (1 a 7). */
export interface ReporteActivacion extends Periodo {
  embudo: { paso: number; cuentas: number }[]
  filas: { fecha: string; tipo: string; titular: string | null; correo: string | null; empresas: number;
           paso: number; ultimo: string; diasParada: number | null }[]
}

/** e148: empresas que pueden dejar de facturar (hoy). */
export interface ReporteRiesgo extends Periodo {
  filas: { id: string; empresa: string; ruc: string | null; ambiente: string; titular: string | null; correo: string | null;
           nivel: 'alto' | 'medio'; motivos: string[]; motivo: string; certificado: string | null; ultimo: string | null }[]
}

/** e148: lo que usa cada cuenta, mes a mes. */
export interface ReporteConsumo extends Periodo {
  filas: { mes: string; tipo: string; titular: string | null; correo: string | null; empresas: number;
           empresasCuenta: number; reales: number; prueba: number; notas: number; rechazados: number;
           whatsapp: number; total: number }[]
}

export const reportesServicio = {
  obtener: <T>(reporte: NombreReporte, f: Filtros) =>
    api.obtener<T>(`${ruta(reporte)}?${consulta(f)}`),

  excel: (reporte: NombreReporte, f: Filtros) =>
    api.descargar(`${ruta(reporte)}?${consulta(f, 'xlsx')}`),

  /** 034: un .zip con los XML, CDR y PDF del periodo (hasta 200 comprobantes). */
  descargaMasiva: (o: { desde: string; hasta: string; xml: boolean; cdr: boolean; pdf: boolean }) =>
    api.descargar(`/api/reportes/descarga?desde=${o.desde}&hasta=${o.hasta}&xml=${o.xml}&cdr=${o.cdr}&pdf=${o.pdf}`),
}