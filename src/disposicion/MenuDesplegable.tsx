import { useEffect, useState } from 'react'
import { IconoMenu, iconoDeSimbolo } from './IconoMenu'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { NOMBRE_PLAN } from '../nucleo/planes/planes'

/**
 * 036 — UNA ENTRADA DEL MENÚ QUE SE ABRE Y SE CIERRA (Reportes).
 *
 * Fuera de su sección, un clic lleva a su primera pantalla y la abre. Dentro,
 * un clic la cierra o la vuelve a abrir (la flecha lo dice). Al entrar en una
 * de sus pantallas por otro camino, se abre sola.
 */
export function MenuDesplegable({ icono, titulo, inicio, prefijos, grupos }: {
  icono: string
  titulo: string
  inicio: string
  prefijos: string[]
  // 15 nov: `tambien` = terminaciones de ruta que también marcan la entrada; `excepto` = las que no.
  grupos: { titulo: string; items: { ruta: string; nombre: string; exacto?: boolean; candado?: string; tambien?: string[]; excepto?: string[] }[] }[]
}) {
  const ruta = useLocation()
  const navegar = useNavigate()
  const dentro = prefijos.some(p => ruta.pathname.startsWith(p))
  const [abierto, setAbierto] = useState(dentro)

  useEffect(() => { if (dentro) setAbierto(true) }, [dentro])

  // 15 nov: la nota (…/comprobantes/{id}/nota-credito) marca «Nueva nota de crédito», no «Comprobantes emitidos».
  const termina = (lista?: string[]) => !!lista?.some(t => ruta.pathname.endsWith(t))
  const todos = grupos.flatMap(g => g.items)
  // 16 nov: si dos opciones calzan (/guias y /guias/transporte), se marca solo la más específica.
  const calza = (r: string) => ruta.pathname === r || ruta.pathname.startsWith(r + '/')
  const masLarga = todos.filter(i => calza(i.ruta)).reduce((m, i) => Math.max(m, i.ruta.length), 0)
  const activoItem = (i: { ruta: string; tambien?: string[]; excepto?: string[] }) => ({ isActive }: { isActive: boolean }) =>
    termina(i.tambien) || (isActive && !termina(i.excepto) && i.ruta.length >= masLarga) ? 'activo' : undefined
  const ORDEN = ['basico', 'pro', 'max']
  const candadoTitulo = todos.length > 0 && todos.every(i => i.candado)
    ? todos.map(i => i.candado!).sort((x, y) => ORDEN.indexOf(x) - ORDEN.indexOf(y))[0] : undefined

  return (
    <>
      <button type="button" className={`boton-lateral${dentro ? ' activo' : ''}`} aria-expanded={abierto}
              onClick={() => {
                if (!dentro) { navegar(inicio); setAbierto(true) }
                else setAbierto(a => !a)
              }}>
        <span className="icono-lateral" aria-hidden="true"><IconoMenu nombre={iconoDeSimbolo(icono)} /></span>
        <span className="texto-lateral">{titulo}</span>
        {/* 1 nov: si su plan no trae nada de este menú, el candado va también en el título. */}
        {candadoTitulo && <span className="candado-menu" title={`Viene en el plan ${NOMBRE_PLAN[candadoTitulo] ?? candadoTitulo}`}>🔒 {NOMBRE_PLAN[candadoTitulo] ?? candadoTitulo}</span>}
        <span className="flecha-lateral" aria-hidden="true">{abierto ? '▾' : '▸'}</span>
      </button>
      {abierto && (
        <div className="submenu-lateral">
          {grupos.filter(g => g.items.length > 0).map(g => (
            <div key={g.titulo} className="grupo-submenu">
              <span className="titulo-submenu">{g.titulo}</span>
              {g.items.map(i => (
                <NavLink key={i.ruta} to={i.ruta} end={i.exacto} className={activoItem(i)}>
                  {i.nombre}
                  {/* 1 nov: lo que su plan no trae se ve con candado y el plan que lo trae. */}
                  {i.candado && <span className="candado-menu" title={`Viene en el plan ${NOMBRE_PLAN[i.candado] ?? i.candado}`}>🔒 {NOMBRE_PLAN[i.candado] ?? i.candado}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  )
}