import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorApi } from '../nucleo/api/errores'
import { fijarSucursalVista } from '../nucleo/api/cliente'
import { useMensaje } from '../nucleo/mensajes/ProveedorMensajes'
import { useSesion, useYo } from '../nucleo/sesion/SesionContexto'
import { carteraServicio, estadoDe, textoEstado } from '../modulos/cartera/servicios/carteraServicio'
import type { EmpresaCartera } from '../modulos/cartera/servicios/carteraServicio'
import { IndicadorCertificado } from '../modulos/avisos/Campanita'
import type { Avisos } from '../modulos/avisos/avisosServicio'

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
/**
 * e191 — DOS MODOS. En «Mi estudio» (Mis empresas, Mi equipo, reportes de la
 * cartera) dice «Viendo: toda tu cartera · N empresas», en gris; dentro de una
 * empresa, «Trabajando en: …», en verde. La primera opción de la lista es
 * siempre «Mi estudio», con el número rojo de certificados por vencer o
 * vencidos de la cartera (que así se ve también desde dentro de una empresa).
 */
export function SelectorEmpresa({ estudio, avisos }: { estudio: boolean; avisos?: Avisos }) {
  const { empresa, cuenta } = useYo()
  const { refrescar } = useSesion()
  const mensaje = useMensaje()
  const navegar = useNavigate()

  const [abierto, setAbierto] = useState(false)
  const [empresas, setEmpresas] = useState<EmpresaCartera[] | null>(null)
  const [buscar, setBuscar] = useState('')
  const caja = useRef<HTMLDivElement>(null)

  // e191: cuántas empresas tiene la cartera (para «toda tu cartera · N empresas»).
  const [total, setTotal] = useState<number | null>(null)
  useEffect(() => {
    let vivo = true
    // e285: «Mi empresa» (la del estudio) no cuenta como empresa de la cartera.
    carteraServicio.empresas().then(l => { if (vivo) setTotal(l.filter(e => !e.esDelEstudio).length) }).catch(() => { /* sin número */ })
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    if (!abierto) return
    setBuscar('')
    carteraServicio.empresas()
      .then(l => { setEmpresas(l); setTotal(l.filter(e => !e.esDelEstudio).length) })
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
    // e285: «Mi empresa» con candado (menos del mínimo en la cartera): se dice por qué.
    const est = cuenta?.estudio
    if (e.esDelEstudio && est?.estado === 'sin_activar') {
      mensaje.ojo(`Tu empresa se activa cuando tengas al menos ${est.minimo} empresas en tu cartera. Hoy tienes ${est.tiene}. Agrégalas con «+ Agregar empresa».`)
      return
    }
    // Ya abierta: desde el estudio, entrar es solo ir a su inicio.
    if (e.abierta) { if (estudio) navegar('/'); return }
    try {
      await carteraServicio.abrir(e.id)
      // 046: en la otra empresa se entra con su sucursal de por defecto.
      fijarSucursalVista(null)
      await refrescar()
      navegar('/')
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo abrir esa empresa.')
    }
  }

  const texto = buscar.trim().toLowerCase()
  const coincide = (e: EmpresaCartera) => !texto || e.nombre.toLowerCase().includes(texto) || (e.ruc ?? '').includes(texto)
  const visibles = (empresas ?? [])
    .filter(e => !e.pausadaEn && !e.esDelEstudio)
    .filter(coincide)
  // e285: la empresa del estudio, en su propio grupo «Mi empresa».
  const propia = (empresas ?? []).find(e => e.esDelEstudio && !e.pausadaEn && coincide(e))
  const candado = cuenta?.estudio?.estado === 'sin_activar'

  return (
    <div className="selector-empresa" ref={caja}>
      <button type="button" className={'selector-boton' + (estudio ? ' modo-estudio' : ' modo-empresa') + (abierto ? ' abierto' : '')}
              aria-haspopup="listbox" aria-expanded={abierto} onClick={() => setAbierto(a => !a)}>
        {estudio ? (
          <>
            <IconoCartera />
            <span className="selector-etiqueta">Viendo:</span>
            <strong>toda tu cartera</strong>
            {total !== null && <span className="selector-cuantas">{total} empresa{total === 1 ? '' : 's'}</span>}
          </>
        ) : (
          <>
            <IconoEmpresa />
            <span className="selector-etiqueta">Trabajando en:</span>
            <strong>{empresa?.nombre ?? 'elige una empresa'}</strong>
            <IndicadorCertificado datos={avisos} numero />
          </>
        )}
        <span aria-hidden="true" className="selector-flecha">▾</span>
      </button>

      {abierto && (
        <div className="selector-menu">
          {/* e191: primero, el estudio (toda la cartera). */}
          <button type="button" className={'selector-opcion selector-estudio' + (estudio ? ' elegida' : '')}
                  onClick={() => { setAbierto(false); navegar('/empresas') }}>
            <IconoCartera />
            <span className="selector-estudio-texto">
              <strong>Mi estudio</strong>
              <span className="selector-ruc">toda tu cartera{total !== null ? ` · ${total} empresa${total === 1 ? '' : 's'}` : ''}</span>
            </span>
            <IndicadorCertificado datos={avisos} numero />
            {estudio && <span className="selector-marca" aria-hidden="true">✓</span>}
          </button>
          <div className="selector-separador" />
          <input className="selector-buscar" placeholder="Buscar empresa o RUC…" autoFocus
                 value={buscar} onChange={e => setBuscar(e.target.value)} />
          <span className="selector-subtitulo">Entrar a una empresa</span>

          <ul role="listbox" className="selector-lista">
            {empresas === null && <li className="selector-vacio">Cargando…</li>}
            {empresas !== null && visibles.length === 0 && <li className="selector-vacio">Ninguna empresa.</li>}
            {visibles.map(e => {
              const estado = estadoDe(e)
              return (
                <li key={e.id} role="option" aria-selected={e.abierta}>
                  <button type="button" className={'selector-opcion' + (e.abierta && !estudio ? ' elegida' : '')}
                          onClick={() => void elegir(e)}>
                    <span>
                      <strong>{e.nombre}</strong>
                      <span className="selector-ruc">RUC {e.ruc}{e.abierta && estudio ? ' · última abierta' : ''}</span>
                    </span>
                    {e.abierta && !estudio
                      ? <span className="selector-marca" aria-hidden="true">✓</span>
                      : estado !== 'lista' && <span className={`estado-empresa ${estado}`}>{textoEstado(e)}</span>}
                  </button>
                </li>
              )
            })}
          </ul>

          {propia && (
            <>
              <span className="selector-subtitulo">Mi empresa</span>
              <ul role="listbox" className="selector-lista">
                <li role="option" aria-selected={propia.abierta}>
                  <button type="button" className={'selector-opcion' + (propia.abierta && !estudio ? ' elegida' : '') + (candado ? ' con-candado' : '')}
                          onClick={() => void elegir(propia)}>
                    <span>
                      <strong>{candado ? '🔒 ' : ''}{propia.nombre}</strong>
                      <span className="selector-ruc">RUC {propia.ruc}{candado ? ' · se activa con 2 empresas en tu cartera' : ''}</span>
                    </span>
                    {propia.abierta && !estudio
                      ? <span className="selector-marca" aria-hidden="true">✓</span>
                      : estadoDe(propia) !== 'lista' && <span className={`estado-empresa ${estadoDe(propia)}`}>{textoEstado(propia)}</span>}
                  </button>
                </li>
              </ul>
            </>
          )}

          <div className="selector-pie">
            <Link to="/empresas" onClick={() => setAbierto(false)}>Ver todas en Mi cartera</Link>
            {cuenta?.nivel !== 'colaborador' && (
              <Link to="/configurar?nueva=1" onClick={() => setAbierto(false)}>+ Agregar empresa</Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** e191: los íconos de los dos modos (cartera: cuadrícula; empresa: edificio). */
function IconoCartera() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" className="selector-icono">
      <rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="13" width="7" height="7" rx="1.5" /><rect x="14" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}
function IconoEmpresa() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" className="selector-icono">
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" /><path d="M16 9h2a2 2 0 0 1 2 2v10" /><path d="M8 7h4M8 11h4M8 15h4M3 21h18" />
    </svg>
  )
}