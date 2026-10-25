/**
 * e169 — LAS OPERACIONES GRATUITAS («🎁 Es regalo»).
 *
 * El cliente no paga la línea, pero SUNAT quiere saber cuánto valía. Quien
 * emite no tiene que saber los códigos 11 al 37 del catálogo 07: marca «Es
 * regalo», elige por qué, y el código sale de eso y de cómo es el producto
 * (gravado, exonerado o inafecto).
 *
 * En la línea se guarda solo el código: de él se sabe el motivo y la
 * afectación de antes (para desmarcar y volver a la venta normal).
 */

export type MotivoRegalo =
  | 'bonificacion' | 'premio' | 'publicidad' | 'donacion' | 'trabajadores' | 'retiro' | 'muestras_medicas'

export const MOTIVOS_REGALO: { codigo: MotivoRegalo; nombre: string; soloInafecto?: boolean }[] = [
  { codigo: 'bonificacion', nombre: 'Bonificación (por la compra)' },
  { codigo: 'premio', nombre: 'Premio' },
  { codigo: 'publicidad', nombre: 'Publicidad o muestra' },
  { codigo: 'donacion', nombre: 'Donación' },
  { codigo: 'trabajadores', nombre: 'Entrega a trabajadores' },
  { codigo: 'retiro', nombre: 'Otro retiro' },
  { codigo: 'muestras_medicas', nombre: 'Muestras médicas', soloInafecto: true },
]

/** Afectación del producto → motivo → código de SUNAT (catálogo 07). */
const TABLA: Record<string, Partial<Record<MotivoRegalo, string>>> = {
  '10': { premio: '11', donacion: '12', retiro: '13', publicidad: '14', bonificacion: '15', trabajadores: '16' },
  '20': {
    bonificacion: '21', premio: '21', publicidad: '21', donacion: '21', trabajadores: '21', retiro: '21',
  },
  '30': {
    bonificacion: '31', retiro: '32', muestras_medicas: '33', trabajadores: '34', premio: '35', publicidad: '36', donacion: '37',
  },
}

/** Cómo lo dice SUNAT, en corto: para el «va a SUNAT como…». */
export const NOMBRE_REGALO: Record<string, string> = {
  '11': 'gravado, retiro por premio',
  '12': 'gravado, retiro por donación',
  '13': 'gravado, retiro',
  '14': 'gravado, retiro por publicidad',
  '15': 'gravado, bonificación',
  '16': 'gravado, entrega a trabajadores',
  '21': 'exonerado, transferencia gratuita',
  '31': 'inafecto, retiro por bonificación',
  '32': 'inafecto, retiro',
  '33': 'inafecto, retiro por muestras médicas',
  '34': 'inafecto, retiro por convenio colectivo',
  '35': 'inafecto, retiro por premio',
  '36': 'inafecto, retiro por publicidad',
  '37': 'inafecto, transferencia gratuita',
}

export const esRegalo = (codigo: string) => codigo in NOMBRE_REGALO

/** Solo lo gravado, exonerado o inafecto se puede regalar (no la exportación ni el IVAP). */
export const sePuedeRegalar = (afectacion: string) => afectacion in TABLA

/** El código para ese producto y ese motivo. */
export function codigoRegalo(base: string, motivo: MotivoRegalo): string {
  const fila = TABLA[base] ?? TABLA['10']
  return fila[motivo] ?? fila.bonificacion ?? fila.retiro!
}

/** De un código de regalo: la afectación del producto y el motivo. */
export function deRegalo(codigo: string): { base: string; motivo: MotivoRegalo } | null {
  if (!esRegalo(codigo)) return null
  const base = codigo.startsWith('1') ? '10' : codigo.startsWith('2') ? '20' : '30'
  const motivo = (Object.entries(TABLA[base]).find(([, c]) => c === codigo)?.[0] ?? 'bonificacion') as MotivoRegalo
  return { base, motivo }
}

/** Los motivos que tienen sentido para esa afectación. */
export const motivosPara = (base: string) => MOTIVOS_REGALO.filter(m => !m.soloInafecto || base === '30')

/** La afectación «de verdad» de una línea: la del producto si es regalo. */
export const afectacionBase = (codigo: string) => deRegalo(codigo)?.base ?? codigo