import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { soles } from '../../../nucleo/planes/planes'
import {
  etiquetaPlan, menusDelPlan, planesServicio, precioHoy,
  type Afectados, type Armador, type Catalogo, type CodigoPlan, type FuncionArmador,
} from '../servicios/planesServicio'

type Columna = 'sin' | CodigoPlan
const OPCIONES: Columna[] = ['sin', 'basico', 'pro', 'max']
const NOMBRE: Record<Columna, string> = { sin: 'Oculto', basico: 'Básico', pro: 'Pro', max: 'Max' }
const LO_VEN: Record<Columna, string> = { sin: 'Nadie (oculto)', basico: 'Básico, Pro y Max', pro: 'Pro y Max', max: 'Solo Max' }
const col = (p: CodigoPlan | null): Columna => p ?? 'sin'
/** Los íconos del menú de la izquierda (Disposicion). */
const ICONO: Record<string, string> = {
  'Comprobantes': '▤', 'Clientes': '☺', 'Productos': '◫', 'Compras y gastos': '⇣', 'Sucursales': '⌖',
  'Guías de remisión': '⛟', 'Punto de venta': '▣', 'Inventario': '▦', 'Reportes': '▥', 'Personal': '◍',
  'Auditoría': '◷', 'Configuración': '⚙',
}
const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * 1 nov — ARMAR LOS PLANES (propuesta elegida por Erick).
 *
 *   · Pestañas horizontales: los menús, con los mismos nombres y en el mismo
 *     orden que el menú de la izquierda (072: un submenú por fila, sin
 *     excepción). Con muchos menús, flechas ‹ › y el buscador.
 *   · Una fila por submenú con su selector «Oculto · Básico · Pro · Max»
 *     (desde qué plan aparece) y quién lo ve. Lo fijo, con 🔒.
 *   · Barra de cambios sin guardar: a cuántas empresas afecta, Deshacer y Guardar.
 *   · «Así lo ve el cliente»: las tarjetas de «Elige tu plan», en vivo, con lo
 *     cambiado en amarillo. En el celular se abren con un botón.
 */
export function ArmadorPlanes({ puede, catalogo }: { puede: boolean; catalogo: Catalogo }) {
  const mensaje = useMensaje()
  const [datos, setDatos] = useState<Armador>()
  const [error, setError] = useState<string>()
  const [plan, setPlan] = useState<Record<string, CodigoPlan | null>>({})
  const [historial, setHistorial] = useState<Record<string, CodigoPlan | null>[]>([])
  const [verMenu, setVerMenu] = useState('')
  const [buscar, setBuscar] = useState('')
  const [abiertos, setAbiertos] = useState<string[]>([])
  const [afecta, setAfecta] = useState<Afectados | null>(null)
  const [guardando, setGuardando] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)
  const movil = typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches

  const cargar = useCallback(async () => {
    try {
      const d = await planesServicio.armador()
      setDatos(d)
      setPlan(Object.fromEntries(d.funciones.map(f => [f.codigo, f.plan])))
      setHistorial([])
      setError(undefined)
    } catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el armador.') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const cambios = useMemo(() => (datos?.funciones ?? [])
    .filter(f => (plan[f.codigo] ?? null) !== f.plan)
    .map(f => ({ codigo: f.codigo, plan: plan[f.codigo] ?? null })), [datos, plan])

  // A cuántas empresas les cambia lo que ven (en vivo, medio segundo después de tocar).
  useEffect(() => {
    if (cambios.length === 0) { setAfecta(null); return }
    const t = window.setTimeout(() => {
      planesServicio.afectados(cambios).then(setAfecta).catch(() => setAfecta(null))
    }, 500)
    return () => window.clearTimeout(t)
  }, [cambios])

  if (error) return <Aviso>{error}</Aviso>
  if (!datos) return <Cargando />

  const funciones = datos.funciones
  const menus = [...new Map(funciones.map(f => [f.menu, f.menuOrden])).entries()].sort((a, b) => a[1] - b[1]).map(m => m[0])
  const q = sinTildes(buscar.trim())
  const coincide = (f: FuncionArmador) => !q || sinTildes(f.nombre).includes(q) || sinTildes(f.menu).includes(q)
  // «Todos» es la vista principal: todos los menús plegados; se abre cada uno.
  const menuActual = q ? 'todos' : menus.includes(verMenu) ? verMenu : 'todos'
  const menusVisibles = menuActual === 'todos' ? menus : [menuActual]
  const alternar = (m: string) => setAbiertos(a => a.includes(m) ? a.filter(x => x !== m) : [...a, m])
  const filas = funciones
    .filter(f => (menuActual === 'todos' || f.menu === menuActual) && coincide(f))
    .sort((a, b) => a.menuOrden - b.menuOrden || a.orden - b.orden)
  const cambiosDe = (m: string) => cambios.filter(c => funciones.find(f => f.codigo === c.codigo)?.menu === m).length
  const puntos = (m: string) => (['basico', 'pro', 'max'] as CodigoPlan[]).filter(p => funciones.some(f => f.menu === m && plan[f.codigo] === p))

  function cambiar(f: FuncionArmador, c: Columna) {
    const nuevo = c === 'sin' ? null : c
    if (f.fija || (plan[f.codigo] ?? null) === nuevo) return
    setHistorial(h => [...h, plan])
    setPlan(p => ({ ...p, [f.codigo]: nuevo }))
  }

  const Selector = ({ f }: { f: FuncionArmador }) => {
    const c = col(plan[f.codigo])
    return f.fija
      ? <span className="fijo-plan" title="Sin esto no se puede trabajar">🔒 Siempre, en todos los planes</span>
      : (
        <span className="selector-plan" role="radiogroup" aria-label={`Desde qué plan aparece ${f.nombre}`} onClick={e => e.stopPropagation()}>
          {OPCIONES.map(o => (
            <button key={o} type="button" role="radio" aria-checked={c === o} disabled={!puede}
                    className={(c === o ? 'on ' : '') + o} onClick={() => cambiar(f, o)}>{NOMBRE[o]}</button>
          ))}
        </span>
      )
  }

  async function guardar() {
    setGuardando(true)
    try {
      const r = await planesServicio.guardarArmador(cambios)
      mensaje.bien(r.mensaje)
      await cargar()
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.') }
    finally { setGuardando(false) }
  }

  // Las tarjetas que verá el cliente, con lo que está marcado ahora.
  const tarjetas = catalogo.planes.map(p => ({
    ...p,
    funciones: funciones.filter(f => !f.fija ? plan[f.codigo] === p.codigo : p.codigo === 'basico'),
  }))
  const cambiadas = new Set(cambios.map(c => c.codigo))

  const desplazar = (d: number) => tabsRef.current?.scrollBy({ left: d * 260, behavior: 'smooth' })

  return (
    <>
      <div className="bloque armador-tabla">
        <div className="explica" style={{ marginTop: 0 }}>
          <strong>Cómo se usa:</strong> abre un menú (▸) o elige su pestaña arriba y, en cada submenú, el plan <strong>desde</strong> el que aparece.
          Si eliges <strong>Pro</strong>, lo tienen Pro y Max. <strong>Oculto</strong> = todavía no está en ningún plan (lo nuevo); no es el
          mes gratis. Lo que tiene 🔒 va siempre en todos los planes. Vale para la Cuenta Negocio y para cada empresa de la Cartera.
          {!datos.encendidos && <> Los planes están apagados: lo que guardes se aplica cuando los enciendas.</>}
        </div>

        {/* Las pestañas: los menús como en el menú de la izquierda. */}
        {/* 1 nov: arriba a la izquierda el buscador y «Todos» (la vista principal);
            después, cada menú con su ícono, como en el menú de la izquierda. */}
        <div className="barra-menus">
          <label className="buscar-menus">
            <span aria-hidden="true">⌕</span>
            <input type="search" placeholder="Buscar submenú" value={buscar} onChange={e => setBuscar(e.target.value)} />
          </label>
          <button type="button" className={'todos-los-menus' + (menuActual === 'todos' ? ' elegido' : '')}
                  onClick={() => { setBuscar(''); setVerMenu('todos') }}>Todos</button>
          <button type="button" className="flecha-menus" aria-label="Menús anteriores" onClick={() => desplazar(-1)}>‹</button>
          <div className="pestanas-menus" ref={tabsRef} role="tablist" aria-label="Menús">
            {menus.map(m => (
              <button key={m} type="button" role="tab" aria-selected={menuActual === m}
                      className={menuActual === m ? 'elegido' : undefined} onClick={() => { setBuscar(''); setVerMenu(m) }}>
                <span className="icono-menu" aria-hidden="true">{ICONO[m] ?? '•'}</span>{m}
                {cambiosDe(m) > 0 && <em className="cambios-menu">{cambiosDe(m)}</em>}
              </button>
            ))}
          </div>
          <button type="button" className="flecha-menus" aria-label="Más menús" onClick={() => desplazar(1)}>›</button>
        </div>

        <table className="tabla tabla-armador">
          <thead>
            <tr>
              <th>{q ? `Lo que tiene «${buscar}»` : menuActual === 'todos' ? 'Menús y submenús' : `Menú «${menuActual}»`}</th>
              <th>Desde qué plan aparece</th>
              <th className="solo-pc">Lo ven</th>
            </tr>
          </thead>
          {menusVisibles.map(m => {
            const suyas = filas.filter(f => f.menu === m)
            if (suyas.length === 0) return null
            const unica = funciones.filter(f => f.menu === m).length === 1 && suyas[0].nombre === m
            const abierto = q !== '' || menuActual !== 'todos' || abiertos.includes(m)
            let grupoAnterior: string | null = null
            return (
              <tbody key={m} className="menu-armador">
                <tr className={'cabeza-menu' + (unica ? ' unica' : '')} onClick={unica ? undefined : () => alternar(m)}>
                  <td>
                    <span className="flecha-desplegar" aria-hidden="true">{unica ? '' : abierto ? '▾' : '▸'}</span>
                    <span className="icono-menu" aria-hidden="true">{ICONO[m] ?? '•'}</span>
                    <strong>{m}</strong>
                    {!unica && <span className="secundario"> · {funciones.filter(f => f.menu === m).length} submenús</span>}
                    {cambiosDe(m) > 0 && <em className="cambios-menu">{cambiosDe(m)}</em>}
                  </td>
                  <td>{unica ? <Selector f={suyas[0]} /> : <span className="puntos-plan resumen">{puntos(m).map(p => <span key={p}><i className={'punto ' + p} />{NOMBRE[p]}</span>)}</span>}</td>
                  <td className="secundario solo-pc">{unica ? (suyas[0].fija ? 'Todos' : LO_VEN[col(plan[suyas[0].codigo])]) : ''}</td>
                </tr>
                {abierto && !unica && suyas.map(f => {
                  const c = col(plan[f.codigo])
                  const titulo = f.grupo && f.grupo !== grupoAnterior ? f.grupo : null
                  grupoAnterior = f.grupo
                  return (
                    <FilaGrupo key={f.codigo} titulo={titulo}>
                      <tr className={'fila-sub ' + (c === 'sin' ? 'oculta ' : '') + (cambiadas.has(f.codigo) ? 'cambiada' : '')}>
                        <td>
                          <span className="nombre-sub">{f.nombre}</span>
                          {f.nueva && <span className="etiqueta aviso">nuevo</span>}
                          {cambiadas.has(f.codigo) && <span className="etiqueta aviso">cambiado</span>}
                        </td>
                        <td><Selector f={f} /></td>
                        <td className="secundario solo-pc">{f.fija ? 'Todos' : LO_VEN[c]}</td>
                      </tr>
                    </FilaGrupo>
                  )
                })}
              </tbody>
            )
          })}
          {filas.length === 0 && <tbody><tr><td colSpan={3} className="secundario">Ningún submenú con «{buscar}».</td></tr></tbody>}
        </table>


        {puede && cambios.length > 0 && (
          <div className="barra-guardar">
            <span>
              <strong>{cambios.length} cambio{cambios.length === 1 ? '' : 's'} sin guardar.</strong>{' '}
              {afecta === null || typeof afecta.empresas !== 'number' ? 'Calculando a quién afecta…'
                : afecta.empresas === 0 ? 'A ninguna empresa le cambia lo que ve hoy.'
                : <>A <strong>{afecta.empresas}</strong> empresa{afecta.empresas === 1 ? '' : 's'} le{afecta.empresas === 1 ? '' : 's'} cambia lo que ve
                  {afecta.ganan > 0 && ` (${afecta.ganan} ganan menús`}{afecta.ganan > 0 && afecta.pierden > 0 && ', '}{afecta.pierden > 0 && `${afecta.ganan > 0 ? '' : ' ('}${afecta.pierden} pierden menús, sus datos no se pierden`}{(afecta.ganan > 0 || afecta.pierden > 0) && ')'}.</>}
            </span>
            <Boton estilo="secundario" disabled={historial.length === 0} onClick={() => { setPlan(historial[historial.length - 1]); setHistorial(h => h.slice(0, -1)) }}>Deshacer</Boton>
            <Boton ocupado={guardando} onClick={() => void guardar()}>Guardar</Boton>
          </div>
        )}
      </div>

      {/* Así lo ve el cliente: en la PC abierto; en el celular, con un botón. */}
      <details className="bloque previa-cliente" open={!movil}>
        <summary>👁 Así lo ve el cliente en «Elige tu plan» {cambios.length > 0 && <span className="etiqueta aviso">con tus cambios sin guardar</span>}</summary>
        <div className="tarjetas-plan previa">
          {tarjetas.map((p, i) => {
            const hoy = precioHoy(p, catalogo.enOferta)
            return (
              <div key={p.codigo} className={'tarjeta-plan' + (p.codigo === 'pro' ? ' destacada' : '')}>
                <h2>{p.nombre}</h2>
                <span className={'incluye-plan ' + p.codigo}>{etiquetaPlan(tarjetas, i)}</span>
                <div className="precio-plan">
                  {hoy < p.precioRegular && <s>{soles(p.precioRegular)}</s>}
                  <strong>{soles(hoy)}</strong><span>/mes</span>
                </div>
                <ul className="lista-plan">
                  {menusDelPlan(p.funciones).map(m => {
                    const menu = m.split(':')[0].replace(/ \(\d+\)$/, '')
                    const tocado = p.funciones.some(f => f.menu === menu && cambiadas.has((f as FuncionArmador).codigo))
                    return <li key={m} className={(i > 0 ? 'nuevo-plan ' : '') + (tocado ? 'tocado' : '')}>{i > 0 && '+ '}{m}</li>
                  })}
                  {p.funciones.length === 0 && <li className="secundario">Nada nuevo</li>}
                  <li className={i > 0 ? 'nuevo-plan' : undefined}>{i > 0 && '+ '}{p.sucursalesMax === null ? 'Sucursales ilimitadas' : p.sucursalesMax === 1 ? '1 sucursal' : `Hasta ${p.sucursalesMax} sucursales`}</li>
                </ul>
              </div>
            )
          })}
        </div>
        <p className="nota">Lo resaltado en amarillo es lo que cambia con lo que tocaste. Los precios y las sucursales se cambian en «Precios y reglas».
</p>
      </details>
    </>
  )
}

function FilaGrupo({ titulo, children }: { titulo: string | null; children: ReactNode }) {
  return (
    <>
      {titulo && <tr className="grupo-armador"><td colSpan={3}>{titulo}</td></tr>}
      {children}
    </>
  )
}