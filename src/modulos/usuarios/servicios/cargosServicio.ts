import { api } from '../../../nucleo/api/cliente'

// =============================================================================
// 047 — LA MAESTRA DE CARGOS. Dos maestras con las mismas llamadas:
//   · la de la empresa abierta   /api/cargos
//   · la del estudio (Mi equipo) /api/cartera/cargos
// =============================================================================

export interface CargoEnLista {
  id: string
  nombre: string
  activo: boolean
  /** El porqué del último cambio de nombre. */
  motivo: string | null
  usos: number
  usosActivos: number
  personas: { id: string; nombre: string; activo: boolean }[]
}

type Respuesta = { mensaje: string }

export function cargosServicio(deEstudio: boolean) {
  const base = deEstudio ? '/api/cartera/cargos' : '/api/cargos'
  return {
    listar: () => api.obtener<CargoEnLista[]>(base),
    crear: (nombre: string) => api.crear<Respuesta>(base, { nombre }),
    renombrar: (id: string, nombre: string, motivo: string | null) =>
      api.cambiar<Respuesta>(`${base}/${id}`, { nombre, motivo }),
    activar: (id: string) => api.crear<Respuesta>(`${base}/${id}/activar`),
    desactivar: (id: string) => api.crear<Respuesta>(`${base}/${id}/desactivar`),
    /** usuarios null = todas las personas de ese cargo. */
    pasar: (id: string, hacia: string, usuarios: string[] | null) =>
      api.crear<Respuesta>(`${base}/${id}/pasar`, { hacia, usuarios }),
  }
}

/** Los nombres de los cargos activos, para sugerir mientras se escribe en la ficha. */
export async function nombresDeCargos(deEstudio: boolean): Promise<string[]> {
  try {
    return (await cargosServicio(deEstudio).listar()).filter(c => c.activo).map(c => c.nombre)
  } catch {
    return []
  }
}