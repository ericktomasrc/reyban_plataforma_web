import { useEffect, useRef, useState } from 'react'
import { fijarSucursalVista } from '../nucleo/api/cliente'
import { useSesion, useYo } from '../nucleo/sesion/SesionContexto'

/**
 * 046 — «Sucursal: Todas ▾», al lado de «Trabajando en» (maqueta aprobada,
 * pantalla 3).
 *
 *   · Toda la empresa (admin): «Todas» y cada sucursal.
 *   · Su sucursal con dos o más: elige entre las suyas, sin «Todas».
 *   · Una sola sucursal: solo el nombre, sin menú.
 *   · Empresa con un solo local (la 0000): no aparece nada, como antes.
 *
 * Al elegir, la cabecera X-Sucursal cambia para todas las llamadas y se pide
 * /api/yo otra vez: la pantalla abierta se vuelve a cargar con lo de esa
 * sucursal (la base recorta Inicio, comprobantes, reportes y descargas).
 */
export function SelectorSucursal() {
  const { alcance } = useYo()
  const { refrescar } = useSesion()
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  if (!alcance || alcance.total <= 1 || alcance.sucursales.length === 0) return null

  const todas = alcance.tipo === 'empresa'
  const actual = alcance.sucursales.find(s => s.id === alcance.vista)

  // Una sola posible: el nombre, sin menú.
  if (!todas && alcance.sucursales.length === 1) {
    return <span className="sucursal-fija" title="Tu sucursal">{alcance.sucursales[0].nombre}</span>
  }

  const elegir = async (id: string | null) => {
    setAbierto(false)
    if (id === alcance.vista) return
    fijarSucursalVista(id)
    await refrescar()
  }

  return (
    <div className="selector-empresa selector-sucursal" ref={caja}>
      <button type="button" className={'selector-boton' + (abierto ? ' abierto' : '')}
              aria-haspopup="listbox" aria-expanded={abierto} onClick={() => setAbierto(a => !a)}>
        <span className="selector-etiqueta">Sucursal:</span>
        <strong>{actual?.nombre ?? 'Todas'}</strong>
        <span aria-hidden="true" className="selector-flecha">▾</span>
      </button>

      {abierto && (
        <div className="selector-menu">
          <ul role="listbox" className="selector-lista">
            {todas && (
              <li role="option" aria-selected={alcance.vista === null}>
                <button type="button" className={'selector-opcion' + (alcance.vista === null ? ' elegida' : '')}
                        onClick={() => void elegir(null)}>
                  <span><strong>Todas las sucursales</strong></span>
                  {alcance.vista === null && <span className="selector-marca" aria-hidden="true">✓</span>}
                </button>
              </li>
            )}
            {alcance.sucursales.map(s => (
              <li key={s.id} role="option" aria-selected={alcance.vista === s.id}>
                <button type="button" className={'selector-opcion' + (alcance.vista === s.id ? ' elegida' : '')}
                        onClick={() => void elegir(s.id)}>
                  <span>
                    <strong>{s.nombre}</strong>
                    <span className="selector-ruc">
                      {s.codigo}{s.id === alcance.defecto ? ' · por defecto' : ''}
                    </span>
                  </span>
                  {alcance.vista === s.id && <span className="selector-marca" aria-hidden="true">✓</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="selector-pie">
            <span className="secundario">Inicio, comprobantes y reportes se filtran por lo que elijas.</span>
          </div>
        </div>
      )}
    </div>
  )
}