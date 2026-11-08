import { api } from '../../../nucleo/api/cliente'

/** e225: los errores del sistema, leídos de los logs de cada día. */
export interface ConteoDia { errores: number; avisos: number; existe: boolean }

export interface ResumenErrores {
  hoy: string
  procesos: { clave: string; nombre: string; carpeta: boolean }[]
  dias: { dia: string; conteos: Record<string, ConteoDia> }[]
  ultimo: { proceso: string; hora: string; titulo: string; significado: string | null; errores: number } | null
  /** e229: errores de hoy, cuántos llegaron después de «Ya los revisé» y a qué hora se revisó. */
  erroresHoy: number; nuevos: number; revisadoA: string | null
}

export interface GrupoError {
  firma: string; titulo: string; significado: string | null; veces: number
  primera: string; ultima: string; categoria: string; ejemplo: string
}

export interface ErroresDelDia {
  dia: string; proceso: string; nombre: string; errores: number; avisos: number; existe: boolean
  grupos: GrupoError[]
}

const base = '/api/admin/errores'

export const erroresServicio = {
  resumen: (dias = 14, desde?: string) =>
    api.obtener<ResumenErrores>(`${base}/resumen?dias=${dias}${desde ? `&desde=${encodeURIComponent(desde)}` : ''}`),
  hoy: (desde?: string) =>
    api.obtener<{ errores: number; nuevos: number }>(`${base}/hoy${desde ? `?desde=${encodeURIComponent(desde)}` : ''}`),
  delDia: (dia: string, proceso: string, avisos: boolean) =>
    api.obtener<ErroresDelDia>(`${base}/${dia}/${proceso}?avisos=${avisos}`),
  descargar: (dia: string, proceso: string, avisos: boolean, firma?: string) =>
    api.descargar(`${base}/${dia}/${proceso}/descargar?avisos=${avisos}${firma ? `&firma=${firma}` : ''}`),
}