import { api } from '../../../nucleo/api/cliente'

// 038 — Administración › Correos (solo el super administrador).

export interface EstadoCorreo {
  habilitado: boolean
  cuenta: string
  ok: boolean
  motivo: string | null
  fallaDesde: string | null
  ultimaVez: string | null
}

export interface CorreoFallido {
  id: string
  destino: string
  tipo: 'confirmar_registro' | 'invitacion' | 'restablecer_clave'
  motivo: string
  intentos: number
  ultimoEn: string
  usuarioId: string | null
  nombre: string | null
}

export const correosServicio = {
  leer: () =>
    api.obtener<{ estado: EstadoCorreo; fallidos: CorreoFallido[] }>('/api/admin/correos'),

  probar: () =>
    api.crear<{ enviado: boolean; motivo: string | null; estado: EstadoCorreo }>('/api/admin/correos/probar'),

  reenviar: (id: string) =>
    api.crear<{ mensaje: string }>(`/api/admin/correos/${id}/reenviar`),
}