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