import { useEffect, useState } from 'react'
import { inventarioServicio, type LoteParaVender } from '../servicios/inventarioServicio'
import '../inventario.css'

const dia = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * 068 — EL LOTE DEL QUE SE VENDE. Por defecto, «el que vence primero» (lo hace
 * la base sola); si se elige uno, sale primero de ese y, si no alcanza, de los
 * demás en orden de vencimiento.
 */
export function ElegirLote({ productoId, sucursalId, valor, onCambiar, descripcion }: {
  productoId: string
  sucursalId?: string | null
  valor?: string | null
  onCambiar: (lote: string | null) => void
  descripcion: string
}) {
  const [lotes, setLotes] = useState<LoteParaVender[]>()

  useEffect(() => {
    let vivo = true
    inventarioServicio.lotesParaVender(productoId, sucursalId)
      .then(r => { if (vivo) setLotes(r) })
      .catch(() => { if (vivo) setLotes([]) })
    return () => { vivo = false }
  }, [productoId, sucursalId])

  return (
    <select className="lote-venta" value={valor ?? ''} aria-label={`Lote de ${descripcion}`}
            onChange={e => onCambiar(e.target.value || null)}>
      <option value="">Lote: el que vence primero</option>
      {valor && lotes && !lotes.some(l => l.lote === valor) && <option value={valor}>Lote {valor}</option>}
      {(lotes ?? []).map(l => (
        <option key={l.lote} value={l.lote}>
          Lote {l.lote}{l.vence ? ` · vence ${dia(l.vence)}` : ''}{l.dias !== null && l.dias < 0 ? ' (VENCIDO)' : ''} · hay {l.fisico.toLocaleString('es-PE')}
        </option>
      ))}
    </select>
  )
}