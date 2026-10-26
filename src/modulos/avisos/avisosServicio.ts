import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../../nucleo/api/cliente'

/** e177 (058): la campanita. */
export type NivelAviso = 'rojo' | 'naranja' | 'verde' | 'info'

export interface Aviso {
  clave: string
  tipo: string
  nivel: NivelAviso
  titulo: string
  detalle: string | null
  enlace: string | null
  fecha: string | null
  leido: boolean
}

export interface Avisos {
  avisos: Aviso[]
  sinLeer: number
  nivel: NivelAviso | null
  /** El certificado, para el menú: cuántas empresas por vencer (≤ 30 días), el color y los días del que vence primero. */
  certificado: { empresas: number; nivel: NivelAviso | null; dias: number | null }
}

export const avisosServicio = {
  listar: () => api.obtener<Avisos>('/api/avisos'),
  leidos: (claves: string[]) => api.crear<{ leidos: number }>('/api/avisos/leidos', { claves }),
}

const CADA = 2 * 60_000

/** Los avisos, al entrar, al cambiar de pantalla y cada 2 minutos. */
export function useAvisos(activo: boolean) {
  const [datos, setDatos] = useState<Avisos>()
  const ruta = useLocation().pathname

  const cargar = useCallback(async () => {
    if (!activo) return
    try { setDatos(await avisosServicio.listar()) } catch { /* la campanita no tumba nada */ }
  }, [activo])

  useEffect(() => { void cargar() }, [cargar, ruta])
  useEffect(() => {
    if (!activo) return
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void cargar() }, CADA)
    return () => window.clearInterval(t)
  }, [activo, cargar])

  const marcar = useCallback(async (claves: string[]) => {
    if (claves.length === 0) return
    // Al momento en pantalla; si el servidor falla, la próxima carga lo corrige.
    setDatos(d => d && {
      ...d,
      avisos: d.avisos.map(a => claves.includes(a.clave) ? { ...a, leido: true } : a),
      sinLeer: d.avisos.filter(a => !a.leido && !claves.includes(a.clave)).length,
    })
    try { await avisosServicio.leidos(claves) } catch { /* se reintenta solo al volver a abrir */ }
  }, [])

  return { datos, marcar, recargar: cargar }
}