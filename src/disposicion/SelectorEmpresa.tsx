import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorApi } from '../nucleo/api/errores'
import { useMensaje } from '../nucleo/mensajes/ProveedorMensajes'
import { useSesion, useYo } from '../nucleo/sesion/SesionContexto'
import { carteraServicio, estadoDe, textoEstado } from '../modulos/cartera/servicios/carteraServicio'
import type { EmpresaCartera } from '../modulos/cartera/servicios/carteraServicio'

/**
 * «Trabajando en: BODEGA DON PEPE ▾» (fase 3).
 *
 * Una empresa a la vez. Cambiar es POST /api/cartera/empresas/{id}/abrir, que
 * comprueba la base (sin acceso → 403); después se vuelve a pedir /api/yo para
 * que el menú, los permisos y la cabecera sean los de la empresa nueva.
 *
 * La lista se pide al abrir el desplegable, no antes: así siempre está al día
 * (una empresa que acaban de poner en pausa ya no sale).
 */
export function SelectorEmpresa() {
  const { empresa, cuenta } = useYo()
  const { refrescar } = useSesion()
  const mensaje = useMensaje()
  const navegar = useNavigate()

  const [abierto, setAbierto] = useState(false)
  const [empresas, setEmpresas] = useState<EmpresaCartera[] | null>(null)
  const [buscar, setBuscar] = useState('')
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    setBuscar('')
    carteraServicio.empresas()
      .then(setEmpresas)
      .catch(e => mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo leer tu cartera.'))

    // Un clic fuera o Escape lo cierran.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  const elegir = async (e: EmpresaCartera) => {
    setAbierto(false)
    if (e.abierta) return
    try {
      await carteraServicio.abrir(e.id)
      await refrescar()
      navegar('/')
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo abrir esa empresa.')
    }
  }

  const texto = buscar.trim().toLowerCase()
  const visibles = (empresas ?? [])
    .filter(e => !e.pausadaEn)
    .filter(e => !texto || e.nombre.toLowerCase().includes(texto) || (e.ruc ?? '').includes(texto))

  return (
    <div className="selector-empresa" ref={caja}>
      <button type="button" className={'selector-boton' + (abierto ? ' abierto' : '')}
              aria-haspopup="listbox" aria-expanded={abierto} onClick={() => setAbierto(a => !a)}>
        <span className="selector-etiqueta">Trabajando en:</span>
        <strong>{empresa?.nombre ?? 'elige una empresa'}</strong>
        <span aria-hidden="true" className="selector-flecha">▾</span>
      </button>

      {abierto && (
        <div className="selector-menu">
          <input className="selector-buscar" placeholder="Buscar empresa…" autoFocus
                 value={buscar} onChange={e => setBuscar(e.target.value)} />

          <ul role="listbox" className="selector-lista">
            {empresas === null && <li className="selector-vacio">Cargando…</li>}
            {empresas !== null && visibles.length === 0 && <li className="selector-vacio">Ninguna empresa.</li>}
            {visibles.map(e => {
              const estado = estadoDe(e)
              return (
                <li key={e.id} role="option" aria-selected={e.abierta}>
                  <button type="button" className={'selector-opcion' + (e.abierta ? ' elegida' : '')}
                          onClick={() => void elegir(e)}>
                    <span>
                      <strong>{e.nombre}</strong>
                      <span className="selector-ruc">RUC {e.ruc}</span>
                    </span>
                    {e.abierta
                      ? <span className="selector-marca" aria-hidden="true">✓</span>
                      : estado !== 'lista' && <span className={`estado-empresa ${estado}`}>{textoEstado(e)}</span>}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="selector-pie">
            <Link to="/empresas" onClick={() => setAbierto(false)}>Ver todas en Mis empresas</Link>
            {cuenta?.nivel !== 'colaborador' && (
              <Link to="/configurar?nueva=1" onClick={() => setAbierto(false)}>+ Agregar empresa</Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}