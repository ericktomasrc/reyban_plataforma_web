import { importesGravada, valorSinIgv } from '../facturacion/importesLinea'

/**
 * e279 (094) — EL MOTOR DE LAS OFERTAS, IGUAL QUE LA API (Pos/MotorOfertas.cs).
 *
 * El punto de venta lo usa para mostrar el total con las ofertas antes de
 * cobrar; al cobrar, la API hace la misma cuenta y es la que manda. Si se
 * cambia uno, hay que cambiar el otro.
 *
 * Todo en ENTEROS: precios en céntimos con IGV y cantidades en diezmilésimas.
 * Ver los pasos en MotorOfertas.cs.
 */

export type TipoOferta = 'cantidad' | 'pack' | 'minimo' | 'lote'

export interface OfertaActiva {
  id: string
  nombre: string
  tipo: TipoOferta
  /** Con IGV. cantidad y pack: el grupo; minimo y lote: por unidad. */
  precio: number
  lote: string | null
  restante: number | null
  productos: { productoId: string; cantidad: number }[]
}

/** Lo mínimo de una línea del punto de venta que el motor necesita. */
export interface LineaParaOferta {
  productoId: string | null
  presentacionId?: string | null
  cantidad: number
  valorUnitario: number
  descuento: number
  tipoAfectacion: string
  lote?: string | null
}

export interface OfertaEnLinea {
  /** Descuento sin IGV, como lo pondrá la API en el comprobante. */
  descuento: number
  /** Lo que el cliente ahorra en esta línea, con IGV. */
  ahorro: number
  nombres: string[]
}

const U = 10_000
const cant4 = (c: number) => Math.round(c * U)
const valor = (t4: number, precio: number) => Math.floor((t4 * precio + U / 2) / U)
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** El precio con IGV, en céntimos (desde el valor unitario con 6 decimales). */
export function precioCentimos(valorUnitario: number, afectacion: string): number {
  const k = Math.round(valorUnitario * 1_000_000)
  return afectacion === '10' ? Math.floor((k * 118 + 500_000) / 1_000_000) : Math.floor((k + 5_000) / 10_000)
}

interface Linea { indice: number; productoId: string; lote: string | null; precio: number; resto: number; descuento: number; nombres: string[] }
interface Toma { l: Linea; cant: number; normal: number }

/** Por cada línea (mismo orden), su oferta; null si no lleva. */
export function aplicarOfertas(lineas: LineaParaOferta[], ofertas: OfertaActiva[]): (OfertaEnLinea | null)[] {
  const eleg: Linea[] = []
  lineas.forEach((l, i) => {
    const af = (l.tipoAfectacion ?? '10').trim()
    if (!l.productoId || l.presentacionId || l.descuento !== 0 || !['10', '20', '30'].includes(af) || !(l.cantidad > 0) || !(l.valorUnitario > 0)) return
    eleg.push({ indice: i, productoId: l.productoId, precio: precioCentimos(l.valorUnitario, af), resto: cant4(l.cantidad),
                lote: l.lote?.trim() ? l.lote.trim().toUpperCase() : null, descuento: 0, nombres: [] })
  })
  const nombrar = (l: Linea, n: string) => { if (!l.nombres.includes(n)) l.nombres.push(n) }

  for (const o of ofertas) {
    if (eleg.length === 0) break
    if (!o.productos?.length) continue
    const precio = Math.round(o.precio * 100)
    const resto4 = o.restante != null ? cant4(o.restante) : Number.MAX_SAFE_INTEGER
    if (resto4 <= 0) continue
    if (o.tipo === 'lote' || o.tipo === 'minimo') {
      const p = o.productos[0].productoId
      let suyas = eleg.filter(x => x.productoId === p && x.resto > 0)
      let hay = resto4
      if (o.tipo === 'lote') {
        const lote = o.lote?.trim().toUpperCase() ?? null
        suyas = suyas.filter(x => x.lote === lote)
      } else {
        hay = Math.min(suyas.reduce((s, x) => s + x.resto, 0), resto4)
        if (hay < cant4(o.productos[0].cantidad)) continue
      }
      let veces = 0
      for (const l of suyas) {
        const t = Math.min(l.resto, hay - veces)
        if (t <= 0) break
        const d = valor(t, l.precio) - valor(t, precio)
        if (d <= 0) continue
        l.resto -= t; l.descuento += d; nombrar(l, o.nombre); veces += t
      }
      continue
    }
    // cantidad y pack: grupos completos.
    let k = resto4 === Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : Math.floor(resto4 / U)
    for (const it of o.productos) {
      const n = cant4(it.cantidad)
      if (n <= 0) { k = 0; break }
      const hay = eleg.filter(x => x.productoId === it.productoId).reduce((s, x) => s + x.resto, 0)
      k = Math.min(k, Math.floor(hay / n))
    }
    if (k <= 0 || k === Number.MAX_SAFE_INTEGER) continue
    const tomas: Toma[] = []
    for (const it of o.productos) {
      let falta = k * cant4(it.cantidad)
      for (const l of eleg.filter(x => x.productoId === it.productoId && x.resto > 0)) {
        if (falta <= 0) break
        const t = Math.min(l.resto, falta - tomas.filter(x => x.l === l).reduce((s, x) => s + x.cant, 0))
        if (t <= 0) continue
        tomas.push({ l, cant: t, normal: valor(t, l.precio) })
        falta -= t
      }
    }
    const total = tomas.reduce((s, x) => s + x.normal, 0)
    const dsc = total - k * precio
    if (dsc <= 0 || total <= 0) continue
    let repartido = 0
    const partes = tomas.map(x => { const d = Number(BigInt(dsc) * BigInt(x.normal) / BigInt(total)); repartido += d; return d })
    partes[0] += dsc - repartido
    tomas.forEach((x, i) => { x.l.resto -= x.cant; x.l.descuento += partes[i]; nombrar(x.l, o.nombre) })
  }

  // El descuento sin IGV va con dos decimales: si una línea no puede dar justo su
  // total, se elige lo más cercano y el céntimo que sobra o falta se compensa en
  // otra línea con oferta, para que el total de la venta sea justo.
  const salida: (OfertaEnLinea | null)[] = lineas.map(() => null)
  const con = eleg.filter(x => x.descuento > 0)
  const ops = con.map(l => opciones(lineas[l.indice], l.descuento))
  const elegida = ops.map(o => o.reduce((m, x, k) => Math.abs(x.dif) < Math.abs(o[m].dif) ? k : m, 0))
  let resto = con.reduce((s, _, i) => s + ops[i][elegida[i]].dif, 0)
  for (let vuelta = 0; vuelta < 50 && resto !== 0; vuelta++) {
    let mejor: [number, number, number, number] | null = null
    for (let i = 0; i < con.length; i++) {
      for (let k = 0; k < ops[i].length; k++) {
        if (k === elegida[i]) continue
        const queda = resto - ops[i][elegida[i]].dif + ops[i][k].dif
        if (Math.abs(queda) >= Math.abs(resto)) continue
        const c: [number, number, number, number] = [Math.abs(queda), Math.abs(ops[i][k].dif), i, k]
        if (!mejor || menor(c, mejor)) mejor = c
      }
    }
    if (!mejor) break
    const [, , i, k] = mejor
    resto = resto - ops[i][elegida[i]].dif + ops[i][k].dif
    elegida[i] = k
  }
  con.forEach((l, i) => { salida[l.indice] = { descuento: ops[i][elegida[i]].descuento, ahorro: l.descuento / 100, nombres: l.nombres } })
  return salida
}

const menor = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false }

const totalCon = (l: LineaParaOferta, d: number) => l.tipoAfectacion === '10'
  ? importesGravada(l.cantidad, l.valorUnitario, d).total
  : valorSinIgv(l.cantidad, l.valorUnitario, d)

/**
 * Los descuentos sin IGV (dos decimales) cerca del que da justo el total con
 * oferta, y cuántos céntimos se aleja cada uno: el calculado, +1, −1, +2, −2…
 */
export function opciones(l: LineaParaOferta, centimos: number): { descuento: number; dif: number }[] {
  // Exonerado o inafecto: sin IGV, el descuento es justo lo que se rebaja (la API llega a lo mismo).
  if (l.tipoAfectacion !== '10') return [{ descuento: centimos / 100, dif: 0 }]
  const metaC = Math.round(totalCon(l, 0) * 100) - centimos
  const c = r2(centimos / 100 / 1.18)
  const bruto = l.cantidad * l.valorUnitario
  const dif = (d: number) => Math.round(totalCon(l, d) * 100) - metaC
  const salida: { descuento: number; dif: number }[] = []
  for (const paso of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
    const d = r2(c + paso * 0.01)
    if (d <= 0 || d >= bruto) continue
    salida.push({ descuento: d, dif: dif(d) })
  }
  if (salida.length === 0) { const d = c > 0 ? c : 0.01; salida.push({ descuento: d, dif: dif(d) }) }
  return salida
}

export const NOMBRE_TIPO: Record<TipoOferta, string> = {
  cantidad: 'Lleva varios, paga menos',
  pack: 'Pack o combo',
  minimo: 'Por cantidad',
  lote: 'Liquidar lote',
}