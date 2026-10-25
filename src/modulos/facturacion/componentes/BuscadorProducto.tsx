import { useEffect, useRef, useState } from 'react'
import { productosServicio } from '../servicios/facturacionServicio'
import type { ProductoEnLista } from '../tipos'

interface Props {
  onElegir: (p: ProductoEnLista) => void
  placeholder?: string
}

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
export function BuscadorProducto({ onElegir, placeholder = 'Buscar un producto…' }: Props) {
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
          {resultados.map(p => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => { onElegir(p); setQ(''); setAbierto(false) }}
              >
                <span className="principal">{p.descripcion}</span>
                <span className="secundario mono">
                  {p.codigo} · {p.precioUnitario.toFixed(2)} {p.incluyeIgv ? 'c/IGV' : 's/IGV'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
