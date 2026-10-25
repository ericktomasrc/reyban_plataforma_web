import { useState } from 'react'

/**
 * 24 OCT — PAGINAR UNA LISTA QUE YA ESTÁ ENTERA EN LA PANTALLA (personal,
 * roles, sucursales, transporte…). Son listas acotadas: se traen enteras y se
 * filtran y paginan aquí.
 *
 * `clave` resume los filtros: si cambia, se vuelve a la página 1 sola (sin
 * efecto: la página guardada solo vale para la clave con la que se eligió).
 */
export function usePaginaLocal<T>(filas: T[], clave: string, porDefecto = 20) {
  const [estado, setEstado] = useState({ clave, pagina: 1 })
  const [porPagina, setPorPagina] = useState(porDefecto)

  const paginas = Math.max(1, Math.ceil(filas.length / porPagina))
  const pagina = Math.min(estado.clave === clave ? estado.pagina : 1, paginas)
  const visibles = filas.slice((pagina - 1) * porPagina, pagina * porPagina)

  return {
    visibles,
    paginacion: {
      total: filas.length,
      pagina,
      porPagina,
      onCambiar: (p: number) => setEstado({ clave, pagina: p }),
      onPorPagina: (n: number) => { setPorPagina(n); setEstado({ clave, pagina: 1 }) },
    },
  }
}

/** ¿El texto aparece en alguno de los campos? (sin mayúsculas ni tildes). */
export function contiene(texto: string, ...campos: (string | null | undefined)[]): boolean {
  const q = normalizar(texto.trim())
  if (!q) return true
  return campos.some(c => c && normalizar(c).includes(q))
}

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Lo más nuevo arriba (por `creadoEn`); los que no lo traen, al final. */
export function masNuevoPrimero<T extends { creadoEn?: string | null }>(filas: T[]): T[] {
  return [...filas].sort((a, b) => (b.creadoEn ?? '').localeCompare(a.creadoEn ?? ''))
}