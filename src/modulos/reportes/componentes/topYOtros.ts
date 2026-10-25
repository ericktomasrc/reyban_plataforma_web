/**
 * e176: los 10 primeros y una barra «Otros (n)» con lo que queda, para que el
 * gráfico no crezca con cada cliente. Las filas ya vienen de mayor a menor.
 */
export function topYOtros<T>(filas: T[], etiqueta: (f: T) => string, valor: (f: T) => number, nota?: (f: T) => string | undefined, n = 10) {
  const orden = [...filas].sort((a, b) => valor(b) - valor(a))
  const top: { etiqueta: string; valor: number; nota?: string; aparte?: boolean }[] =
    orden.slice(0, n).map(f => ({ etiqueta: etiqueta(f), valor: valor(f), nota: nota?.(f) }))
  const resto = orden.slice(n)
  if (resto.length > 0)
    top.push({ etiqueta: `Otros (${resto.length})`, valor: resto.reduce((s, f) => s + valor(f), 0), aparte: true })
  return top
}