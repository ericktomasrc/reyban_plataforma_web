import { useState } from 'react'
import { useVersionNueva } from './pwa'

/**
 * e171 — «Hay una versión nueva». Abajo, discreto; no recarga solo: quien está
 * a mitad de una factura decide cuándo. Lo escrito en un formulario sin
 * guardar se perdería al recargar, por eso lo dice.
 */
export function AvisoVersion() {
  const nueva = useVersionNueva()
  const [cerrado, setCerrado] = useState(false)
  if (!nueva || cerrado) return null
  return (
    <div className="aviso-version" role="status">
      <span><strong>Hay una versión nueva de Reyban.</strong> Actualiza cuando termines lo que estás haciendo (lo que no guardaste se pierde).</span>
      <button type="button" className="boton" onClick={() => location.reload()}>Actualizar</button>
      <button type="button" className="aviso-version-cerrar" aria-label="Más tarde" onClick={() => setCerrado(true)}>×</button>
    </div>
  )
}