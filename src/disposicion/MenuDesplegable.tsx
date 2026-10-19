import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

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
  grupos: { titulo: string; items: { ruta: string; nombre: string }[] }[]
}) {
  const ruta = useLocation()
  const navegar = useNavigate()
  const dentro = prefijos.some(p => ruta.pathname.startsWith(p))
  const [abierto, setAbierto] = useState(dentro)

  useEffect(() => { if (dentro) setAbierto(true) }, [dentro])

  const activo = ({ isActive }: { isActive: boolean }) => isActive ? 'activo' : undefined

  return (
    <>
      <button type="button" className={`boton-lateral${dentro ? ' activo' : ''}`} aria-expanded={abierto}
              onClick={() => {
                if (!dentro) { navegar(inicio); setAbierto(true) }
                else setAbierto(a => !a)
              }}>
        <span className="icono-lateral" aria-hidden="true">{icono}</span>
        <span className="texto-lateral">{titulo}</span>
        <span className="flecha-lateral" aria-hidden="true">{abierto ? '▾' : '▸'}</span>
      </button>
      {abierto && (
        <div className="submenu-lateral">
          {grupos.filter(g => g.items.length > 0).map(g => (
            <div key={g.titulo} className="grupo-submenu">
              <span className="titulo-submenu">{g.titulo}</span>
              {g.items.map(i => <NavLink key={i.ruta} to={i.ruta} className={activo}>{i.nombre}</NavLink>)}
            </div>
          ))}
        </div>
      )}
    </>
  )
}