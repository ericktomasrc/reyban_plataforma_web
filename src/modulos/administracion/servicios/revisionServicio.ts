import { api } from '../../../nucleo/api/cliente'

/** 089: un acceso de revisión (Culqi, un banco…): usuario sin correo y sin segundo factor. */
export interface AccesoRevision {
  id: string
  para: string
  usuario: string
  tipo: 'negocio' | 'profesional'
  hasta: string
  creado: string
  estado: 'activo' | 'vencido' | 'apagado'
  pruebaHasta: string | null
  ultimoIngreso: string | null
  ingresos: number
  empresas: { nombre: string; ruc: string; plan: string | null }[]
  pagos: number
  rechazos: number
}

export const revisionServicio = {
  leer: () => api.obtener<AccesoRevision[]>('/api/admin/revision'),
  crear: (d: { usuario: string; para: string; tipo: 'negocio' | 'profesional'; dias: number; enPrueba: boolean }) =>
    api.crear<{ id: string; usuario: string; clave: string }>('/api/admin/revision', d),
  apagar: (id: string) => api.crear<{ mensaje: string }>(`/api/admin/revision/${id}/apagar`),
  alargar: (id: string, dias: number) => api.crear<{ mensaje: string }>(`/api/admin/revision/${id}/alargar`, { dias }),
  clave: (id: string) => api.crear<{ clave: string }>(`/api/admin/revision/${id}/clave`),
  prueba: (id: string, activa: boolean) => api.crear<{ mensaje: string }>(`/api/admin/revision/${id}/prueba`, { activa }),
}