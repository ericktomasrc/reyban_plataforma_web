import { api } from '../../../nucleo/api/cliente'

/** 069: Básico, Pro o Max. */
export type CodigoPlan = 'basico' | 'pro' | 'max'

export interface PlanCatalogo {
  codigo: CodigoPlan
  nombre: string
  orden: number
  paraQuien: string | null
  precioRegular: number
  precioOferta: number | null
  sucursalesMax: number | null
  carteraExtraRegular: number
  carteraExtraOferta: number | null
  /** 085: comprobantes al mes por empresa (normal y de lanzamiento). */
  topeRegular?: number | null
  topeOferta?: number | null
  funciones: { menu: string; nombre: string }[]
}
export interface Tramo { desde: number; hasta: number | null; precioOferta: number; precioRegular: number }
export interface Reglas {
  diasPrueba: number
  pruebaCarteraEmpresas: number
  rucGratisActivo: boolean
  rucGratisTope: number
  carteraMinimo: number
  ofertaHasta: string | null
  /** 079: el interruptor de la oferta (vale si está encendida y no pasó la fecha). */
  ofertaActiva?: boolean
  /** 079: meses que conserva el precio de lanzamiento quien entra durante la oferta. */
  lanzamientoMeses?: number
  anualMesesGratis: number
  /** 071: qué ve una empresa en su mes gratis. */
  planPrueba: CodigoPlan
  /** 085: el paquete extra de comprobantes. */
  paqueteCantidad?: number
  paquetePrecioRegular?: number
  paquetePrecioOferta?: number
}

/** 085: el tope de comprobantes del mes de una empresa. */
export interface TopeComprobantes {
  aplica: boolean
  empresa?: string
  emitidos?: number
  tope?: number
  topeNormal?: number
  oferta?: boolean
  saldo?: number
  disponible?: number
  porcentaje?: number
  bloqueado?: boolean
  reinicia?: string
  paquete?: { cantidad: number; precio: number; precioNormal: number }
  puedeComprar?: boolean
  tarjeta?: { marca: string; ultimos4: string } | null
  conTarjeta?: boolean
  sinDineroReal?: boolean
}
export interface UsoComprobantes { emitidos: number; tope: number; saldo: number; porcentaje: number; bloqueado: boolean; paquetes: number }
export interface Catalogo {
  encendidos: boolean
  enOferta: boolean
  reglas: Reglas
  planes: PlanCatalogo[]
  tramos: Tramo[]
}

export interface EmpresaDeCuenta {
  id: string
  nombre: string
  ruc: string | null
  plan: CodigoPlan
  efectivo: 'todo' | CodigoPlan
  /** 070: lo que vería con los planes encendidos. */
  efectivoEncendido: 'todo' | CodigoPlan
  /** 071: lo que usó de lo que no trae el Básico y el plan que le conviene. */
  uso: { usos: string[]; recomendado: CodigoPlan } | null
  pruebaHasta: string | null
  pruebaMotivo: 'cuenta' | 'ruc_nuevo' | 'ajuste' | null
  esDelEstudio: boolean
  pausada: boolean
  suspendida: boolean
  /** 083: bajó de plan: el plan que empieza en el próximo cobro, y desde cuándo. */
  planProgramado?: CodigoPlan | null
  planProgramadoDesde?: string | null
}
export type TipoAjuste = 'cortesia' | 'meses_gratis' | 'precio_especial' | 'plan_mejor' | 'ampliar_prueba'
export interface AjusteCuenta {
  id: string
  tipo: TipoAjuste
  plan: CodigoPlan | null
  meses: number | null
  precio: number | null
  hasta: string
  motivo: string
  creadoEn: string
  anuladoEn: string | null
  anuladoMotivo: string | null
  vigente: boolean
}
export type EstadoCuenta = 'apagado' | 'acceso_total' | 'prueba' | 'cortesia' | 'meses_gratis' | 'precio_especial' | 'al_dia'
export interface ResumenCuenta {
  id: string
  tipo: 'negocio' | 'profesional'
  titular: string | null
  estadoCuenta: 'pendiente' | 'activa' | 'suspendida'
  creadaEn: string
  origen: 'registro' | 'alta'
  encendidos: boolean
  enOferta: boolean
  ofertaHasta: string | null
  /** 079: hasta cuándo esta cuenta conserva el precio de lanzamiento (null = paga el real). */
  lanzamientoHasta?: string | null
  /** 081: si canceló su plan, cuándo y por qué; y hasta cuándo tiene pagado. */
  canceladoEn?: string | null
  canceladoMotivo?: string | null
  activoHasta?: string | null
  pagoEstado?: string
  /** 079: si hay oferta general hoy (enOferta también es cierto si la cuenta guarda el precio). */
  ofertaGeneral?: boolean
  pruebaHasta: string | null
  accesoTotal: boolean
  accesoTotalMotivo: string | null
  cupos: number | null
  usados: number
  cobradas: number
  minimo: number
  empresas: EmpresaDeCuenta[]
  ajustes: AjusteCuenta[]
  estado: EstadoCuenta
  /** 070: el dueño de la cuenta (quien se registró). */
  dueno: { nombre: string; correo: string } | null
  /** 070: lo que pasaría con los planes encendidos (con los planes apagados, `estado` dice «apagado»). */
  estadoEncendido: Exclude<EstadoCuenta, 'apagado'>
  totalEncendido: number
  planPrueba: CodigoPlan
  mensual: { base: number; extras: number; total: number; regular: number; anual: number }
  /** 083: diferencias por subir de plan que se suman al próximo cobro. */
  pendientes?: number
}

/** 083: qué pasa si una empresa cambia de plan (lo calcula la base). */
export interface CotizacionCambio {
  accion: 'igual' | 'deshacer' | 'inmediato' | 'programado' | 'cobrar'
  actual: CodigoPlan
  nuevo: CodigoPlan
  /** programado: desde cuándo; deshacer: el que estaba programado. */
  desde?: string
  pagadoHasta?: string
  programado?: CodigoPlan | null
  /** cobrar */
  empresa?: string
  monto?: number
  diferenciaMensual?: number
  dias?: number
  diasPeriodo?: number
  hasta?: string
  periodo?: 'mensual' | 'anual'
  mesesGratisAnual?: number
  minimo?: number
  alProximo?: boolean
  nuevoMensual?: number
  /** de la API */
  tarjeta: { id: string; marca: string; ultimos4: string } | null
  comprobante: 'factura' | 'boleta' | null
  conTarjeta: boolean
  sinDineroReal: boolean
}

export interface MiPlan {
  catalogo: Catalogo
  cuenta: ResumenCuenta | null
  puedeCambiar: boolean
  empresa: { id: string; nombre: string; plan: CodigoPlan; efectivo: string; pruebaHasta: string | null } | null
}

export interface FuncionArmador {
  codigo: string
  menu: string
  menuOrden: number
  /** 072: el grupo dentro del menú (Reportes › Ganancias…). */
  grupo: string | null
  nombre: string
  orden: number
  plan: CodigoPlan | null
  fija: boolean
  nueva: boolean
  rutas: string[]
}
export interface Armador {
  encendidos: boolean
  planes: { codigo: CodigoPlan; nombre: string; orden: number }[]
  funciones: FuncionArmador[]
  empresasPorPlan: Record<string, number>
}
export interface Afectados { empresas: number; ganan: number; pierden: number; porPlan: Record<string, number> }

export interface ConfigPlanes {
  catalogo: Catalogo
  interruptor: { encendidos: boolean; decidido: boolean; cambiadoEn: string | null; cambiadoPor: string | null }
  /** 074: los datos de la página pública. */
  publica: DatosPublicos
}

/** 074: lo que se muestra de Reyban en la página pública. */
export interface DatosPublicos {
  razonSocial: string
  ruc: string | null
  direccion: string
  correo: string
  whatsapp: string | null
  actualizado: string
}

type Mensaje = { mensaje: string }

export const planesServicio = {
  // La cuenta
  mio: () => api.obtener<MiPlan>('/api/planes/mio'),
  elegir: (empresaId: string, plan: CodigoPlan) => api.crear<Mensaje & { efectivo: string }>('/api/planes/elegir', { empresaId, plan }),
  /** 083: subir (pagando la diferencia) o bajar (en el próximo cobro). */
  cotizarCambio: (empresaId: string, plan: CodigoPlan) =>
    api.obtener<CotizacionCambio>(`/api/planes/cambio?empresa=${empresaId}&plan=${plan}`),
  cambiar: (empresaId: string, plan: CodigoPlan, pagar: boolean) =>
    api.crear<Mensaje & { estado: string; accion: string }>('/api/planes/cambio', { empresaId, plan, pagar }),
  cupos: (cupos: number) => api.crear<Mensaje & { cupos: number }>('/api/planes/cupos', { cupos }),
  // e232: lo que costaría subir de cupo hoy (null si no se cobra nada).
  cotizarCupos: (cupos: number) => api.obtener<{ texto: string | null }>(`/api/planes/cupos/cotizar?cupos=${cupos}`),
  estudio: (empresaId: string | null) => api.crear<Mensaje>('/api/planes/estudio', { empresaId }),
  /** 085: el tope de comprobantes del mes y comprar un paquete extra. */
  comprobantes: (empresaId?: string) =>
    api.obtener<TopeComprobantes>(`/api/planes/comprobantes${empresaId ? `?empresa=${empresaId}` : ''}`),
  comprarPaquete: (empresaId?: string) =>
    api.crear<Mensaje & { estado: string; error?: string }>('/api/planes/comprobantes/paquete', { empresaId: empresaId ?? null }),
  usoComprobantes: () => api.obtener<Record<string, UsoComprobantes>>('/api/admin/planes/comprobantes'),

  // La plataforma
  config: () => api.obtener<ConfigPlanes>('/api/admin/planes/config'),
  interruptor: (encendidos: boolean) => api.cambiar<Mensaje & { encendidos: boolean }>('/api/admin/planes/interruptor', { encendidos }),
  reglas: (r: Reglas) => api.cambiar<Mensaje>('/api/admin/planes/reglas', r),
  precios: (planes: Omit<PlanCatalogo, 'nombre' | 'orden' | 'paraQuien' | 'funciones'>[], tramos: Tramo[],
            paquete?: { cantidad: number; precioRegular: number; precioOferta: number }) =>
    api.cambiar<Mensaje>('/api/admin/planes/precios', { planes, tramos, paquete }),
  armador: () => api.obtener<Armador>('/api/admin/planes/armador'),
  afectados: (cambios: { codigo: string; plan: CodigoPlan | null }[]) =>
    api.crear<Afectados>('/api/admin/planes/armador/afectados', { cambios }),
  guardarArmador: (cambios: { codigo: string; plan: CodigoPlan | null }[]) =>
    api.cambiar<Mensaje & { cambiadas: number }>('/api/admin/planes/armador', { cambios }),
  cuentas: () => api.obtener<ResumenCuenta[]>('/api/admin/planes/cuentas'),
  cuenta: (id: string) => api.obtener<ResumenCuenta>(`/api/admin/planes/cuentas/${id}`),
  ajustar: (id: string, d: { tipo: TipoAjuste; plan?: CodigoPlan | null; meses?: number | null; precio?: number | null; hasta: string; motivo: string }) =>
    api.crear<Mensaje>(`/api/admin/planes/cuentas/${id}/ajustes`, d),
  anularAjuste: (id: string, motivo: string) => api.crear<Mensaje>(`/api/admin/planes/ajustes/${id}/anular`, { motivo }),
  accesoTotal: (id: string, activo: boolean, motivo: string) =>
    api.cambiar<Mensaje>(`/api/admin/planes/cuentas/${id}/acceso-total`, { activo, motivo }),
  cancelar: (motivo: string | null) => api.crear<Mensaje & { hasta: string | null }>('/api/planes/cancelar', { motivo }),
  reactivar: () => api.crear<Mensaje>('/api/planes/reactivar'),
  lanzamiento: (id: string, hasta: string | null) =>
    api.cambiar<Mensaje>(`/api/admin/planes/cuentas/${id}/lanzamiento`, { hasta }),
  planEmpresa: (empresaId: string, plan: CodigoPlan) => api.cambiar<Mensaje>(`/api/admin/planes/empresas/${empresaId}/plan`, { plan }),
  cuposCuenta: (id: string, cupos: number) => api.cambiar<Mensaje>(`/api/admin/planes/cuentas/${id}/cupos`, { cupos }),
  paginaPublica: (d: DatosPublicos) => api.cambiar<Mensaje>('/api/admin/planes/pagina-publica', d),
}

/** El precio de hoy de un plan (el de lanzamiento mientras dure la oferta). */
export const precioHoy = (p: PlanCatalogo, oferta: boolean) => oferta ? (p.precioOferta ?? p.precioRegular) : p.precioRegular
export const extraHoy = (p: PlanCatalogo, oferta: boolean) => oferta ? (p.carteraExtraOferta ?? p.carteraExtraRegular) : p.carteraExtraRegular

/** Lo que paga la Cartera por n empresas (cada una al precio de su tramo). */
export function precioCartera(tramos: Tramo[], n: number, regular: boolean): number {
  return tramos.reduce((s, t) => {
    if (t.desde > n) return s
    const cuantas = Math.min(n, t.hasta ?? n) - t.desde + 1
    return s + Math.max(0, cuantas) * (regular ? t.precioRegular : t.precioOferta)
  }, 0)
}

export const NOMBRE_ESTADO: Record<EstadoCuenta, string> = {
  apagado: 'Planes apagados', acceso_total: 'Acceso total', prueba: 'Mes gratis', cortesia: 'Cortesía',
  meses_gratis: 'Meses gratis', precio_especial: 'Precio especial', al_dia: 'Al día',
}
export const NOMBRE_AJUSTE: Record<TipoAjuste, string> = {
  cortesia: 'Cortesía', meses_gratis: 'Meses gratis', precio_especial: 'Precio especial',
  plan_mejor: 'Un plan mejor', ampliar_prueba: 'Más prueba',
}

/** 1 nov: lo que un plan agrega, agrupado por menú: «Inventario: stock, traslados…». */
export function menusDelPlan(funciones: { menu: string; nombre: string }[]): string[] {
  const porMenu = new Map<string, string[]>()
  for (const f of funciones) porMenu.set(f.menu, [...(porMenu.get(f.menu) ?? []), f.nombre])
  return [...porMenu.entries()].map(([m, fs]) =>
    fs.length === 1 && fs[0] === m ? m
    : fs.length > 4 ? `${m} (${fs.length}): ${fs.slice(0, 3).join(', ').toLowerCase()} y ${fs.length - 3} más`
    : `${m}: ${fs.join(', ').toLowerCase()}`)
}

/**
 * 1 nov: la etiqueta «contiene» de cada plan, armada con lo que esté en el
 * armador: Básico «Lo esencial para emitir»; los demás «Todo lo del anterior +
 * los menús que agrega».
 */
export function etiquetaPlan(planes: { nombre: string; funciones: { menu: string }[] }[], i: number): string {
  if (i === 0) return 'Lo esencial para emitir'
  const menus = [...new Set(planes[i].funciones.map(f => f.menu))].map(m => m.toLowerCase())
  const lista = menus.length <= 1 ? menus.join('') : menus.slice(0, -1).join(', ') + ' y ' + menus[menus.length - 1]
  return `Todo lo del ${planes[i - 1].nombre}${lista ? ' + ' + lista : ''}`
}