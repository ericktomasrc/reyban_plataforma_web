import { useYo } from '../nucleo/sesion/SesionContexto'

/**
 * 24 OCT — Los filtros que se repiten en las listas: rango de fechas y
 * sucursal. La sucursal solo aparece si quien mira puede ver más de una.
 */
export function FiltroFechas({ desde, hasta, onDesde, onHasta }: {
  desde: string
  hasta: string
  onDesde: (v: string) => void
  onHasta: (v: string) => void
}) {
  return (
    <>
      <label>
        <span>Desde</span>
        <input type="date" value={desde} max={hasta || undefined} onChange={e => onDesde(e.target.value)} />
      </label>
      <label>
        <span>Hasta</span>
        <input type="date" value={hasta} min={desde || undefined} onChange={e => onHasta(e.target.value)} />
      </label>
    </>
  )
}

export function FiltroSucursal({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  const { alcance } = useYo()
  if (!alcance || alcance.sucursales.length <= 1) return null
  return (
    <label>
      <span>Sucursal</span>
      <select value={valor} onChange={e => onCambio(e.target.value)}>
        <option value="">Todas</option>
        {alcance.sucursales.map(s => <option key={s.id} value={s.id}>{s.codigo} {s.nombre}</option>)}
      </select>
    </label>
  )
}