import { useEffect, useRef, useState } from 'react'
import { productosServicio } from '../../facturacion/servicios/facturacionServicio'
import type { ProductoEnLista } from '../../facturacion/tipos'

/**
 * 052 — Buscar un producto que CONTROLA STOCK (para ingresos, ajustes,
 * stock inicial y conteos). Los servicios y los que no controlan no salen.
 */
export function BuscadorProductoStock({ onElegir, excluir = [] }: {
  onElegir: (p: ProductoEnLista) => void
  excluir?: string[]
}) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<ProductoEnLista[]>([])
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  // En una referencia: la lista cambia en cada repintado de quien la pasa.
  const fuera = useRef(excluir)
  useEffect(() => { fuera.current = excluir })

  useEffect(() => {
    function cerrar(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  useEffect(() => {
    if (q.trim().length < 2) return
    let vivo = true
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await productosServicio.listar(q)
          if (vivo) {
            setResultados(r.filter(p => p.controlaStock !== false && !fuera.current.includes(p.id)).slice(0, 8))
            setAbierto(true)
          }
        } catch {
          if (vivo) setResultados([])
        }
      })()
    }, 300)
    return () => { vivo = false; clearTimeout(t) }
  }, [q])

  return (
    <div className="buscador en-linea" ref={caja}>
      <input value={q} onChange={e => { setQ(e.target.value); if (e.target.value.trim().length < 2) setResultados([]) }} onFocus={() => resultados.length > 0 && setAbierto(true)}
             placeholder="+ Agregar producto (código o nombre)…" autoComplete="off" aria-label="Agregar producto" />
      {abierto && (
        <ul className="sugerencias">
          {resultados.length === 0 && q.trim().length >= 2 && (
            <li><span className="secundario">Ningún producto que controle stock con «{q}».</span></li>
          )}
          {resultados.map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => { onElegir(p); setQ(''); setAbierto(false) }}>
                <span className="principal">{p.descripcion}</span>
                <span className="secundario mono">{p.codigo} · {p.unidadMedida}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}