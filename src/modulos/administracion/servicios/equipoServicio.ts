import { api } from '../../../nucleo/api/cliente'

/** 067: alguien del equipo de la plataforma. permisos null = dueño (todo). */
export interface MiembroEquipo {
  id: string
  nombre: string
  correo: string
  activo: boolean
  ultimoIngresoEn: string | null
  dosfaActivo: boolean
  duenio: boolean
  permisos: string[] | null
  yo: boolean
}
export interface EquipoPlataforma {
  gente: MiembroEquipo[]
  permisos: { codigo: string; descripcion: string }[]
  soyDuenio: boolean
}

export const equipoServicio = {
  leer: () => api.obtener<EquipoPlataforma>('/api/admin/equipo'),
  agregar: (d: { nombre: string; correo: string; permisos: string[] | null }) =>
    api.crear<{ id: string; mensaje: string; enlaceDePrueba?: string | null }>('/api/admin/equipo', d),
  permisos: (id: string, permisos: string[] | null) =>
    api.cambiar<{ mensaje: string }>(`/api/admin/equipo/${id}/permisos`, { permisos }),
  desactivar: (id: string) => api.crear<{ mensaje: string }>(`/api/admin/equipo/${id}/desactivar`),
  reactivar: (id: string) => api.crear<{ mensaje: string }>(`/api/admin/equipo/${id}/reactivar`),
  reenviar: (id: string) => api.crear<{ mensaje: string; enlaceDePrueba?: string | null }>(`/api/admin/equipo/${id}/reenviar`),
}