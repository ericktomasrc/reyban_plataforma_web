import { api } from '../../../nucleo/api/cliente'

/** GET /api/admin/cuentas — una fila (migración 016). */
export interface CuentaEnLista {
  id: string
  tipo: 'negocio' | 'profesional'
  estado: 'pendiente' | 'activa' | 'suspendida'

  /** registro: se registró sola. alta: nació con una empresa del super admin. */
  origen: 'registro' | 'alta'

  titularTipo: 'natural' | 'juridica' | null
  titularDocumento: string | null
  titularNombre: string | null

  /** Empresas nuevas por día. */
  tope: number

  creadoEn: string
  confirmadaEn: string | null
  suspendidaEn: string | null
  motivoSuspension: string | null

  /** Empresas activas de la cuenta. */
  empresas: number

  /** El primer usuario de la cuenta (el que se registró). */
  usuario: { correo: string; alias: string; nombre: string } | null

  /** e291 (101): cómo está hoy. La frase la arma la pantalla (estadoCuenta.ts). */
  situacion: SituacionCuenta | null
}

/** e291 (101): lo que se sabe de cada empresa de la cuenta (como en Mi cartera). */
export interface EmpresaSituacion {
  id: string
  esDelEstudio: boolean
  pausadaEn: string | null
  facturacionActiva: boolean
  listaParaEmitir: boolean | null
  faltan: string[] | null
  certificadoHasta: string | null
  rechazos: number
  ultimoDocumento: string | null
}

export interface SituacionCuenta {
  pago: 'al_dia' | 'reintento' | 'gracia' | 'no_emite' | 'cancelado' | null
  accesoTotal: boolean
  encendidos: boolean
  pruebaHasta: string | null
  /** Profesional: cuántas empresas de clientes cuentan para el mínimo. */
  cartera: number | null
  /** Profesional: el estado de «Mi empresa» (098). */
  estudio: { estado: 'activa' | 'sin_activar' | 'aviso' | 'no_emite'; tiene: number; minimo: number; faltan: number; empresaId: string | null; hasta: string | null } | null
  empresas: EmpresaSituacion[]
}

export const cuentasServicio = {
  listar: () =>
    api.obtener<CuentaEnLista[]>('/api/admin/cuentas'),

  suspender: (id: string, motivo: string) =>
    api.crear<{ mensaje: string; sesionesCortadas: number }>(
      `/api/admin/cuentas/${id}/suspender`, { motivo }),

  reactivar: (id: string) =>
    api.crear<{ mensaje: string }>(`/api/admin/cuentas/${id}/reactivar`),

  cambiarTope: (id: string, tope: number) =>
    api.cambiar<{ mensaje: string }>(`/api/admin/cuentas/${id}/tope`, { tope }),
}