/**
 * e182 — LOS IMPORTES DE UNA LÍNEA GRAVADA, IGUAL QUE EL SERVICIO.
 *
 * Si el valor sin IGV salió de un precio con IGV redondo (28.50 → 24.1525…),
 * se calcula DESDE EL TOTAL, como las demás facturadoras: 2 × 28.50 = 57.00,
 * valor de venta 57.00 / 1.18 = 48.31 e IGV la diferencia (8.69). Si no, desde
 * el valor (48.31 + 18 % = 57.01). Lo mismo hacen CalculoPrevio (plataforma) y
 * CalculadoraTotales (servicio): si se cambia uno, hay que cambiar los tres.
 */
const TASA = 0.18
const r = (n: number, d: number) => { const f = 10 ** d; return Math.round((n + Number.EPSILON) * f) / f }
const r2 = (n: number) => r(n, 2)

/** El precio con IGV del que salió este valor sin IGV, o null si no salió de uno redondo. */
export function precioConIgv(valorUnitario: number): number | null {
  if (!(valorUnitario > 0)) return null
  const conIgv = valorUnitario * (1 + TASA)
  const precio = r2(conIgv)
  return Math.abs(conIgv - precio) < 0.000001 ? precio : null
}

/** Valor de venta, IGV y total de una línea gravada (afectación 10). */
export function importesGravada(cantidad: number, valorUnitario: number, descuento: number) {
  const bruto = cantidad * valorUnitario
  const precio = precioConIgv(valorUnitario)
  if (precio !== null) {
    const pct = bruto > 0 && descuento > 0 ? r((descuento / bruto) * 100, 6) : 0
    const factor = r(pct / 100, 5)
    // e279: en enteros (cantidad en diezmilésimas, precio en céntimos), como el decimal del servicio:
    // 0.25 × 81.10 = 20.275 → 20.28 (con coma flotante salía 20.27).
    const brutoConIgv = Math.floor((Math.round(cantidad * 10_000) * Math.round(precio * 100) + 5_000) / 10_000) / 100
    // e279: también en enteros (céntimos × cienmilésimas), como el decimal del servicio.
    const total = factor > 0
      ? Math.floor((Math.round(brutoConIgv * 100) * (100_000 - Math.round(factor * 100_000)) + 50_000) / 100_000) / 100
      : brutoConIgv
    const valorVenta = r2(total / (1 + TASA))
    return { valorVenta, igv: r2(total - valorVenta), total }
  }
  const valorVenta = r2(Math.max(0, bruto - descuento))
  const igv = r2(valorVenta * TASA)
  return { valorVenta, igv, total: r2(valorVenta + igv) }
}
/**
 * e279 — EL VALOR DE VENTA DE UNA LÍNEA SIN IGV (exonerada, inafecta), EXACTO
 * como el decimal del servicio: 0.25 × 86.10 = 21.525 → 21.53 (con coma
 * flotante salía 21.52). En enteros: cantidad en diezmilésimas, valor en
 * millonésimas y descuento en céntimos.
 */
export function valorSinIgv(cantidad: number, valorUnitario: number, descuento: number): number {
  const bruto = BigInt(Math.round(cantidad * 10_000)) * BigInt(Math.round(valorUnitario * 1_000_000))   // en 1e-10
  const neto = bruto - BigInt(Math.round(descuento * 100)) * 100_000_000n
  if (neto <= 0n) return 0
  return Number((neto + 50_000_000n) / 100_000_000n) / 100
}