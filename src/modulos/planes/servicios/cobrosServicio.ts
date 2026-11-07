import { api } from '../../../nucleo/api/cliente'

/**
 * 073 — COBROS (primera parte).
 *
 * El modo en que está la plataforma:
 *   apagado   nadie paga con tarjeta (solo transferencia, si está aceptada)
 *   simulado  tarjetas de prueba, sin Culqi ni dinero (bloqueado en producción)
 *   prueba    Culqi con llaves de prueba: sin dinero real
 *   real      Culqi con llaves reales
 */
export type ModoPago = 'apagado' | 'simulado' | 'prueba' | 'real'
export type EstadoPagoCuenta = 'al_dia' | 'reintento' | 'gracia' | 'no_emite'
export type EstadoCobro = 'procesando' | 'pagado' | 'rechazado' | 'devuelto' | 'anulado'
export type MedioPago = 'tarjeta' | 'transferencia' | 'deposito' | 'yape' | 'efectivo' | 'otro'
export type Periodo = 'mensual' | 'anual'

interface Mensaje { mensaje: string }

export interface DatosPago {
  tipoDoc: 'ruc' | 'dni'
  numero: string
  nombre: string
  direccion: string | null
  correo: string
  telefono: string | null
}

export interface MontoPago {
  nada: boolean
  motivo?: string
  monto?: number
  mensual?: number
  periodo?: Periodo
  desde?: string
  hasta?: string
  concepto?: string
  adelantado?: boolean
  mesesGratisAnual?: number
  apagados?: boolean
}

export interface TarjetaGuardada { id: string; marca: string; ultimos4: string; principal: boolean; creadaEn: string }

export interface PagoDeCuenta {
  id: string
  numero: number
  fecha: string
  monto: number
  concepto: string
  medio: MedioPago
  modo: 'simulado' | 'prueba' | 'real' | 'manual'
  estado: EstadoCobro
  desde: string
  hasta: string
  error: string | null
  tarjeta: string | null
  comprobante: 'pendiente' | 'emitido' | 'error' | 'no_aplica'
  comprobanteNumero: string | null
}

export interface MisPagos {
  modo: ModoPago
  puedePagar: boolean
  medios: { tarjeta: boolean; transferencia: boolean; yape: boolean }
  transferencia: string | null
  correoPagos: string | null
  estado: { pago: EstadoPagoCuenta; proximo: string | null; fallaDesde: string | null; pruebaHasta: string | null;
            graciaDias: number; reintentos: number[] }
  datos: DatosPago | null
  sugerido: Partial<DatosPago> | null
  tarjetas: TarjetaGuardada[]
  mensual: MontoPago | null
  anual: MontoPago | null
  pagos: PagoDeCuenta[]
  culqi: { llavePublica: string } | null
  /** 079: hasta cuándo conserva el precio de lanzamiento. */
  lanzamientoHasta?: string | null
}

export interface Autenticacion3ds {
  eci?: string; xid?: string; cavv?: string; protocolVersion?: string; directoryServerTransactionId?: string
}

export interface RespuestaTarjeta { id?: string; requiere3ds?: boolean; mensaje: string }
export interface RespuestaPago { estado: EstadoCobro; monto?: number; proximo?: string | null; mensaje?: string; error?: string }

// --- La plataforma -----------------------------------------------------------

export interface Emisora { id: string; nombre: string; ruc: string; razonSocial: string; seriesFactura: string[]; seriesBoleta: string[] }

export interface ConfigCobros {
  modo: 'apagado' | 'simulado' | 'culqi'
  reintentoDias: number[]
  graciaDias: number
  avisoDias: number
  alVencer: 'no_emite' | 'solo_aviso'
  emisora: string | null
  serieFactura: string | null
  serieBoleta: string | null
  enviarCorreo: boolean
  descripcion: string
  aceptaTarjeta: boolean
  aceptaTransferencia: boolean
  aceptaYape: boolean
  transferenciaDatos: string | null
  correoPagos: string | null
  ultimoEventoEn: string | null
  prueba: { en: string | null; ok: boolean | null; detalle: string | null }
  modificadoEn: string | null
  modificadoPor: string | null
  emisoras: Emisora[]
  eventos: { id: number; en: string; tipo: string | null; valido: boolean; aplicado: boolean; resultado: string | null }[]
  mes: { pagos: number; monto: number; rechazados: number }
  conexion: {
    modoEfectivo: ModoPago
    problema: string | null
    aviso: string | null
    produccion: boolean
    llaves: 'sin_llaves' | 'prueba' | 'real' | 'no_coinciden' | 'mal_escritas'
    llavePublica: string | null
    llaveSecreta: boolean
    webhookProtegido: boolean
    webhookUrl: string
  }
}

export interface PagoAdmin {
  id: string
  numero: number
  fecha: string
  cuentaId: string
  cuenta: string | null
  tipoCuenta: 'negocio' | 'profesional'
  monto: number
  concepto: string
  medio: MedioPago
  modo: 'simulado' | 'prueba' | 'real' | 'manual'
  estado: EstadoCobro
  referencia: string | null
  error: string | null
  desde: string
  hasta: string
  comprador: string | null
  documento: string | null
  comprobante: string
  comprobanteNumero: string | null
  registradoPor: string | null
  notas: string | null
  anuladoMotivo: string | null
  puedeAnular: boolean
}

export interface CuentaParaPago {
  id: string; tipo: 'negocio' | 'profesional'; nombre: string | null; correo: string | null
  proximo: string | null; pruebaHasta: string | null; datos: string | null
}

const q = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams()
  Object.entries(o).forEach(([k, v]) => { if (v) p.set(k, v) })
  const s = p.toString()
  return s ? '?' + s : ''
}

export const cobrosServicio = {
  mio: () => api.obtener<MisPagos>('/api/cobros/mio'),
  datos: (d: DatosPago) => api.cambiar<Mensaje>('/api/cobros/datos', d),
  tarjeta: (token: string, autenticacion?: Autenticacion3ds) =>
    api.crear<RespuestaTarjeta>('/api/cobros/tarjetas', { token, autenticacion }),
  quitarTarjeta: (id: string) => api.borrar<Mensaje>(`/api/cobros/tarjetas/${id}`),
  principal: (id: string) => api.crear<Mensaje>(`/api/cobros/tarjetas/${id}/principal`),
  pagar: (tarjetaId: string, periodo: Periodo) => api.crear<RespuestaPago>('/api/cobros/pagar', { tarjetaId, periodo }),

  config: () => api.obtener<ConfigCobros>('/api/admin/cobros/config'),
  guardarConfig: (c: Partial<ConfigCobros>) => api.cambiar<Mensaje>('/api/admin/cobros/config', c),
  probar: () => api.crear<Mensaje & { ok: boolean }>('/api/admin/cobros/probar'),
  pagos: (f: { estado?: string; texto?: string; desde?: string; hasta?: string }) =>
    api.obtener<PagoAdmin[]>('/api/admin/cobros/pagos' + q(f)),
  cuentas: (texto: string) => api.obtener<CuentaParaPago[]>('/api/admin/cobros/cuentas' + q({ texto })),
  manual: (p: { cuentaId: string; monto: number; medio: string; referencia: string; meses: number; notas?: string }) =>
    api.crear<Mensaje & { id: string }>('/api/admin/cobros/manual', p),
  anular: (id: string, motivo: string) => api.crear<Mensaje>(`/api/admin/cobros/pagos/${id}/anular`, { motivo }),
}

export const NOMBRE_MODO: Record<ModoPago, string> = {
  apagado: 'Apagado',
  simulado: 'Simulado',
  prueba: 'Prueba de Culqi',
  real: 'Real',
}

export const NOMBRE_ESTADO_COBRO: Record<EstadoCobro, string> = {
  procesando: 'Procesando',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
  devuelto: 'Devuelto',
  anulado: 'Anulado',
}

export const NOMBRE_MEDIO: Record<MedioPago, string> = {
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
  yape: 'Yape',
  efectivo: 'Efectivo',
  otro: 'Otro',
}

export const NOMBRE_ESTADO_PAGO: Record<EstadoPagoCuenta, string> = {
  al_dia: 'Al día',
  reintento: 'Reintentando el cobro',
  gracia: 'En días de gracia',
  no_emite: 'Sin emitir hasta pagar',
}

/** Las tarjetas del modo simulado. Solo estas sirven: así nadie escribe una real. */
export const TARJETAS_SIMULADAS = [
  { numero: '4111 1111 1111 1111', caso: 'aprobada', marca: 'Visa', texto: 'Se guarda y el pago se aprueba' },
  { numero: '4000 0000 0000 0002', caso: 'fondos', marca: 'Visa', texto: 'Se guarda, pero el pago se rechaza (sin fondos)' },
  { numero: '4000 0000 0000 0119', caso: 'rechazada', marca: 'Visa', texto: 'El banco no deja guardarla' },
  { numero: '4000 0000 0000 3220', caso: '3ds', marca: 'Visa', texto: 'Pide confirmar que eres tú (3DS) y luego pasa' },
  { numero: '5111 1111 1111 1118', caso: 'aprobada', marca: 'Mastercard', texto: 'Mastercard que se aprueba' },
] as const