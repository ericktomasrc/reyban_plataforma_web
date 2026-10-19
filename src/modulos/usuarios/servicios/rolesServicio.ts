import { api } from '../../../nucleo/api/cliente'

// =============================================================================
// 035 — ROLES PROPIOS. Lo usa el Administrador de la empresa.
// =============================================================================

export interface RolCompleto {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  /** De la plataforma: se copia, o se ajusta solo para esta empresa (037). */
  deSistema: boolean
  /** 037: la empresa ajustó este rol de la plataforma (sus permisos son los del ajuste). */
  ajustado?: boolean
  /** 037: los permisos del rol de la plataforma, cuando está ajustado. */
  original?: string[] | null
  /** El Administrador: fijo, ni se cambia ni se copia. */
  esAdministrador: boolean
  permisos: string[]
  usuarios: number
}

export interface PermisoAsignable {
  codigo: string
  area: string
  descripcion: string
  /** La llave del Administrador: nunca va en un rol propio. */
  soloAdministrador: boolean
}

export interface DatosRol {
  nombre: string
  descripcion: string
  permisos: string[]
}

export const rolesServicio = {
  todos: () => api.obtener<RolCompleto[]>('/api/roles/todos'),
  permisos: () => api.obtener<PermisoAsignable[]>('/api/roles/permisos'),
  crear: (d: DatosRol) => api.crear<{ id: string; mensaje: string }>('/api/roles', d),
  cambiar: (id: string, d: DatosRol) => api.cambiar<{ mensaje: string }>(`/api/roles/${id}`, d),
  desactivar: (id: string) => api.crear<{ mensaje: string }>(`/api/roles/${id}/desactivar`),
  activar: (id: string) => api.crear<{ mensaje: string }>(`/api/roles/${id}/activar`),
  /** 037: los permisos de un rol de la plataforma, solo para esta empresa. */
  ajustar: (id: string, permisos: string[]) => api.cambiar<{ mensaje: string }>(`/api/roles/${id}/ajuste`, { permisos }),
  original: (id: string) => api.crear<{ mensaje: string }>(`/api/roles/${id}/original`),
}