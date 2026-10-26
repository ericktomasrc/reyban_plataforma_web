import { useEffect, useRef, useState } from 'react'
import { productosServicio } from '../servicios/facturacionServicio'
import { enPresentacion, type ProductoEnLista } from '../tipos'

interface Props {
  onElegir: (p: ProductoEnLista) => void
  placeholder?: string
  /**
   * 061: ofrecer también sus presentaciones (CAJA X 12…) como opciones
   * propias: «venta» al facturar, «compra» al ingresar. Sin esto, solo el
   * producto en su unidad. Lo elegido llega con `presentacion` puesta.
   */
  presentaciones?: 'venta' | 'compra'
}

/** Una opción de la lista: el producto, o el producto en una presentación. */
interface Opcion { clave: string; p: ProductoEnLista; detalle: string; sub: boolean }

/**
 * Buscar un producto para rellenar una línea.
 *
 * NO ES OBLIGATORIO USARLO, y esa es la decisión de diseño: elegir un producto
 * rellena la línea, pero la línea se puede escribir a mano igualmente.
 *
 * Por qué: en una ferretería el 90% de lo que se factura está en el catálogo,
 * pero el otro 10% es «flete», «instalación» o algo que se vendió una vez.
 * Obligar a dar de alta un producto para poder facturarlo convierte el catálogo
 * en un basurero de cosas usadas una sola vez.
 *
 * LO QUE PASA AL ELEGIR, y es lo importante: si el precio guardado lleva IGV,
 * se le quita antes de ponerlo en la línea, porque el servicio espera el valor
 * unitario sin él. En un solo sitio, para que nadie divida entre 1.18 a mano.
 */
export function BuscadorProducto({ onElegir, placeholder = 'Buscar un producto…', presentaciones }: Props) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<ProductoEnLista[]>([])
  const [abierto, setAbierto] = useState(false)

  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  useEffect(() => {
    if (q.trim().length < 2) { setResultados([]); return }

    let vivo = true

    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await productosServicio.listar(q)
          if (vivo) { setResultados(r.slice(0, 8)); setAbierto(true) }
        } catch {
          if (vivo) setResultados([])
        }
      })()
    }, 300)

    return () => { vivo = false; clearTimeout(t) }
  }, [q])

  // 061: cada producto y, debajo, sus presentaciones. Si lo escrito es el
  // código de barras de una caja, esa va primero (el lector la pide sola).
  const texto = q.trim()
  const opciones: Opcion[] = []
  for (const p of resultados) {
    const precio = (x: ProductoEnLista) => `${x.precioUnitario.toFixed(2)} ${x.incluyeIgv ? 'c/IGV' : 's/IGV'}`
    opciones.push({ clave: p.id, p, detalle: `${p.codigo} · ${precio(p)}`, sub: false })
    if (!presentaciones) continue
    for (const pr of p.presentaciones ?? []) {
      if (presentaciones === 'venta' ? !pr.paraVenta : !pr.paraCompra) continue
      const x = enPresentacion(p, pr)
      const op = { clave: `${p.id}:${pr.id}`, p: x, detalle: `${pr.unidadMedida} = ${pr.factor} ${p.unidadMedida} · ${precio(x)}`, sub: true }
      if (pr.codigoBarras && pr.codigoBarras === texto) opciones.unshift(op)
      else opciones.push(op)
    }
  }

  return (
    <div className="buscador en-linea" ref={caja}>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => resultados.length > 0 && setAbierto(true)}
        placeholder={placeholder}
        aria-label="Agregar un producto del catálogo"
        autoComplete="off"
      />

      {abierto && resultados.length > 0 && (
        <ul className="sugerencias">
          {opciones.map(o => (
            <li key={o.clave} className={o.sub ? 'sugerencia-presentacion' : undefined}>
              <button
                type="button"
                onClick={() => { onElegir(o.p); setQ(''); setAbierto(false) }}
              >
                <span className="principal">{o.sub ? `↳ ${o.p.presentacion!.nombre}` : o.p.descripcion}</span>
                <span className="secundario mono">{o.detalle}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
