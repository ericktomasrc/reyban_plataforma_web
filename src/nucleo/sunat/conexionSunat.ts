import { useEffect, useState } from 'react'
import { api } from '../api/cliente'

/** GET /api/conexion-sunat — el modo de esta instalación (migración 030). */
export interface ConexionSunat {
  modo: 'beta' | 'real'
  /** Producción: siempre real, sin interruptor ni franja. */
  fija: boolean
  cambiadoEn: string | null
  cambiadoPor: string | null
}

let guardada: ConexionSunat | null = null
const oyentes = new Set<(c: ConexionSunat) => void>()

/** Vuelve a preguntar y avisa a todas las pantallas (la franja, el asistente…). */
export async function refrescarConexionSunat(): Promise<ConexionSunat | null> {
  try {
    guardada = await api.obtener<ConexionSunat>('/api/conexion-sunat')
    oyentes.forEach(o => o(guardada!))
  } catch {
    // Sin respuesta no se pinta franja: mejor nada que un aviso equivocado.
  }
  return guardada
}

/**
 * EL MODO PRUEBA / REAL (18 oct). Una sola consulta para toda la página: la
 * franja, el asistente y la pantalla del interruptor leen lo mismo.
 */
export function useConexionSunat(): ConexionSunat | null {
  const [c, setC] = useState<ConexionSunat | null>(guardada)

  useEffect(() => {
    oyentes.add(setC)
    if (!guardada) void refrescarConexionSunat()
    return () => { oyentes.delete(setC) }
  }, [])

  return c
}