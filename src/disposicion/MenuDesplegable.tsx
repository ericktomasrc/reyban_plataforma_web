import { useEffect, useState } from 'react'
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
  grupos: { titulo: string; items: { ruta: string; nombre: string; exacto?: boolean; candado?: string }[] }[]
}) {
  const ruta = useLocation()
  const navegar = useNavigate()
  const dentro = prefijos.some(p => ruta.pathname.startsWith(p))
  const [abierto, setAbierto] = useState(dentro)

  useEffect(() => { if (dentro) setAbierto(true) }, [dentro])

  const activo = ({ isActive }: { isActive: boolean }) => isActive ? 'activo' : undefined
  const todos = grupos.flatMap(g => g.items)
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
        <span className="icono-lateral" aria-hidden="true">{icono}</span>
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
                <NavLink key={i.ruta} to={i.ruta} end={i.exacto} className={activo}>
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