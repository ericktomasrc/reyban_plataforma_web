import { api } from '../../../nucleo/api/cliente'
import { ErrorApi } from '../../../nucleo/api/errores'

// =============================================================================
// 042 — CONSULTAS SUNAT: el modo (SUNAT sin costo / Decolecta) y el padrón.
// =============================================================================

export type ModoConsultas = 'sunat' | 'decolecta'

export interface CargaPadron {
  id: string
  origen: 'automatica' | 'manual'
  estado: 'en_curso' | 'ok' | 'error'
  iniciadaEn: string
  terminadaEn: string | null
  archivo: string | null
  bytes: number | null
  filas: number | null
  descartadas: number | null
  motivo: string | null
  usuario: string | null
}

export interface EstadoConsultas {
  padron: {
    modo: ModoConsultas
    enUso: { filas: number; cargadoEn: string; origen: string; archivo: string | null } | null
    enCurso: boolean
    cargas: CargaPadron[]
  }
  automatico: { activo: boolean; hora: number; url: string; minimo: number }
  decolecta: { configurado: boolean; usadas: number; limite: number }
}

export const consultasSunatServicio = {
  estado: () =>
    api.obtener<EstadoConsultas>('/api/admin/consultas-sunat'),

  cambiarModo: (modo: ModoConsultas) =>
    api.cambiar<{ modo: ModoConsultas; mensaje: string }>('/api/admin/consultas-sunat/modo', { modo }),

  descargar: () =>
    api.crear<{ mensaje: string }>('/api/admin/consultas-sunat/padron/descargar'),

  /**
   * El .zip de SUNAT (o el .txt), tal cual, como cuerpo. Puede pesar cientos
   * de MB: va directo, sin JSON. Si no es el padrón, el back dice por qué.
   */
  subir: async (archivo: File): Promise<{ mensaje: string }> => {
    let r: Response
    try {
      r = await fetch(`/api/admin/consultas-sunat/padron/subir?nombre=${encodeURIComponent(archivo.name)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: archivo,
      })
    } catch {
      throw new ErrorApi(0, 'No se pudo enviar el archivo. Revisa tu conexión e inténtalo otra vez.')
    }
    const texto = await r.text()
    let datos: { error?: string; mensaje?: string } = {}
    try { datos = texto ? JSON.parse(texto) : {} } catch { datos = { error: texto.slice(0, 300) } }
    if (!r.ok) throw new ErrorApi(r.status, datos.error ?? `Error ${r.status}`)
    return { mensaje: datos.mensaje ?? 'Recibido.' }
  },
}