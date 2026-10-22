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
  /** 22 oct: la carga en marcha, para la barra. null = nada en marcha. */
  avance: AvancePadron | null
  decolecta: { configurado: boolean; usadas: number; limite: number }
}

/**
 * 22 oct — EN QUÉ VA LA CARGA DEL PADRÓN.
 *   en_cola    pedido, esperando al cargador
 *   bajando    bajando el .zip de SUNAT (hecho/total en bytes)
 *   cargando   copiándolo a la base (hecho/total en bytes leídos; filas = RUC)
 *   activando  comprobando e indexando (sin porcentaje)
 */
export interface AvancePadron {
  etapa: 'en_cola' | 'bajando' | 'cargando' | 'activando'
  origen: string
  /** true = archivo subido a mano; false = bajado de SUNAT. */
  subido: boolean
  desde: string
  etapaDesde: string
  hecho: number
  total: number | null
  filas: number
  porcentaje: number | null
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
   *
   * 22 oct: con XMLHttpRequest (no fetch) para poder ir diciendo cuánto se
   * subió: `alSubir(enviados, total)` alimenta la barra de la pantalla.
   */
  subir: (archivo: File, alSubir?: (enviados: number, total: number) => void): Promise<{ mensaje: string }> =>
    new Promise((resolver, rechazar) => {
      const x = new XMLHttpRequest()
      x.open('POST', `/api/admin/consultas-sunat/padron/subir?nombre=${encodeURIComponent(archivo.name)}`)
      x.withCredentials = true
      x.setRequestHeader('Content-Type', 'application/octet-stream')
      x.upload.onprogress = e => { if (alSubir) alSubir(e.loaded, e.lengthComputable ? e.total : archivo.size) }
      x.onerror = () => rechazar(new ErrorApi(0, 'No se pudo enviar el archivo. Revisa tu conexión e inténtalo otra vez.'))
      x.onabort = () => rechazar(new ErrorApi(0, 'Se canceló la subida.'))
      x.onload = () => {
        const texto = x.responseText
        let datos: { error?: string; mensaje?: string } = {}
        try { datos = texto ? JSON.parse(texto) : {} } catch { datos = { error: texto.slice(0, 300) } }
        if (x.status < 200 || x.status >= 300) rechazar(new ErrorApi(x.status, datos.error ?? `Error ${x.status}`))
        else resolver({ mensaje: datos.mensaje ?? 'Recibido.' })
      }
      x.send(archivo)
    }),
}