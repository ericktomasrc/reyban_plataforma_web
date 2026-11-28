import { Fragment, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Paginacion } from '../../../componentes/Paginacion'
import { FiltroFechas } from '../../../componentes/FiltrosComunes'
import { contiene, usePaginaLocal } from '../../../nucleo/hooks/usePaginaLocal'
import { Aviso } from '../../../componentes/Aviso'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { DialogoSuspenderCuenta, DialogoTopeCuenta, nombreDeCuenta } from '../componentes/DialogosCuenta'
import { useAccionesEmpresa } from '../componentes/AccionesEmpresa'
import { estadoCuenta, estadoEmpresa, type EstadoCuenta, type Grupo } from '../componentes/estadoCuenta'
import { cuentasServicio } from '../servicios/cuentasServicio'
import type { CuentaEnLista, EmpresaSituacion } from '../servicios/cuentasServicio'
import { empresasServicio } from '../servicios/empresasServicio'
import { planesServicio, type UsoComprobantes } from '../../planes/servicios/planesServicio'
import { hace } from '../../cartera/servicios/carteraServicio'
import { PlanDeEmpresa, UsoDelMes } from './ListaEmpresas'
import type { EmpresaEnLista } from '../tipos'
import './cuentas.css'

type Banda = 'todas' | Grupo
type Tipo = 'todas' | 'negocio' | 'profesional'

const BANDA: [Banda, string, string][] = [
  ['todas', 'Todas', ''],
  ['normal', 'Todo normal', 'sin pendientes'],
  ['medias', 'Configuración a medias', 'les falta algo'],
  ['candado', 'Con candado', 'profesional, sin el mínimo'],
  ['pago', 'Pago vencido', 'reintento, gracia o no emiten'],
  ['certificado', 'Certificado', 'vencido o ≤ 30 días'],
  ['sinEmitir', 'Sin emitir', '30 días o más'],
  ['sinEmpresas', 'Sin empresas', 'se registraron y nada más'],
]

/**
 * «Cuentas» (e291, migración 101): CÓMO ESTÁ CADA CUENTA HOY. Solo el super
 * administrador.
 *
 *   · Arriba, las tarjetas que filtran (todo normal, con candado, pago…).
 *   · En cada fila, el estado en una frase y las señales (pago, certificado,
 *     sin emitir), que avisan pero no cambian el estado.
 *   · Al tocar una fila se despliegan sus empresas con lo mismo que en
 *     «Empresas» (usuarios, comprobantes, plan y módulos, estado) y sus
 *     acciones. En una Cuenta Profesional, «Mi empresa» y su cartera aparte.
 *
 * Suspender una cuenta corta sus sesiones al instante; no borra nada.
 */
export function ListaCuentas() {
  const cuentas = useCargar<CuentaEnLista[]>(() => cuentasServicio.listar())
  const empresas = useCargar<EmpresaEnLista[]>(() => empresasServicio.listar())
  const catalogo = useCargar(() => empresasServicio.modulos())
  const planes = useCargar(() => empresasServicio.planes())
  const uso = useCargar<Record<string, UsoComprobantes>>(() => planesServicio.usoComprobantes())
  const mensaje = useMensaje()
  const [params, setParams] = useSearchParams()
  const soloCuenta = params.get('cuenta')

  const [banda, setBanda] = useState<Banda>('todas')
  const [tipo, setTipo] = useState<Tipo>('todas')
  const [q, setQ] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set(soloCuenta ? [soloCuenta] : []))
  const [suspendiendo, setSuspendiendo] = useState<CuentaEnLista>()
  const [cambiandoTope, setCambiandoTope] = useState<CuentaEnLista>()

  const recargarTodo = () => { void cuentas.recargar(); void empresas.recargar(); void uso.recargar() }
  const acciones = useAccionesEmpresa({ modulos: catalogo.datos ?? [], planes: planes.datos, recargar: recargarTodo })

  async function reactivar(c: CuentaEnLista) {
    try {
      await cuentasServicio.reactivar(c.id)
      mensaje.bien(`${nombreDeCuenta(c)} quedó reactivada.`)
      await cuentas.recargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo reactivar.')
    }
  }

  // Antes del «return»: estados, filtros y páginas.
  const todas = cuentas.datos ?? []
  const estados = new Map<string, EstadoCuenta>(todas.map(c => [c.id, estadoCuenta(c)]))
  const empresasDe = (id: string) => (empresas.datos ?? []).filter(e => e.cuenta?.id === id)
  const deTipo = todas.filter(c => tipo === 'todas' || c.tipo === tipo)
  const enBanda = (c: CuentaEnLista, b: Banda) => b === 'todas' || estados.get(c.id)!.grupos.has(b)
  const filtradas = deTipo.filter(c =>
    (soloCuenta ? c.id === soloCuenta : true) &&
    enBanda(c, banda) &&
    contiene(q, c.titularNombre, c.titularDocumento, c.usuario?.correo, c.usuario?.alias,
             ...empresasDe(c.id).flatMap(e => [e.nombre, e.ruc, e.razonSocial])) &&
    (!desde || c.creadoEn.slice(0, 10) >= desde) && (!hasta || c.creadoEn.slice(0, 10) <= hasta))
  const { visibles, paginacion } = usePaginaLocal(filtradas, `${banda}|${tipo}|${q}|${desde}|${hasta}|${soloCuenta}`)

  if (cuentas.cargando && !cuentas.datos) return <Cargando />

  const nNeg = todas.filter(c => c.tipo === 'negocio').length
  const alternar = (id: string) => setAbiertas(a => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div className="cue-pagina">
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Cuentas</h1>
          <p className="bajada-pagina">
            Cómo está cada cuenta hoy. Toca una tarjeta para filtrar y una fila para ver sus empresas.
            Suspender una cuenta corta sus sesiones al instante; no borra nada.
          </p>
        </div>
      </div>

      <div className="cue-banda" role="group" aria-label="Filtrar por estado">
        {BANDA.map(([b, titulo, sub]) => (
          <button key={b} type="button" aria-pressed={banda === b} className={banda === b ? 'elegida' : undefined}
                  onClick={() => setBanda(b)}>
            <span>{titulo}</span>
            <strong>{deTipo.filter(c => enBanda(c, b)).length}</strong>
            <span>{b === 'todas' ? `negocio ${nNeg} · profesional ${todas.length - nNeg}` : sub}</span>
          </button>
        ))}
      </div>

      {soloCuenta && (
        <Aviso tono="info">
          Mostrando una sola cuenta.{' '}
          <button type="button" className="enlace" onClick={() => { params.delete('cuenta'); setParams(params, { replace: true }) }}>Ver todas</button>
        </Aviso>
      )}

      <div className="cue-filtros">
        <input className="cue-buscar" value={q} onChange={e => setQ(e.target.value)}
               placeholder="Titular, RUC/DNI, correo o empresa" aria-label="Buscar" />
        <FiltroFechas desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
        <div className="cue-seg" role="group" aria-label="Tipo de cuenta">
          {([['todas', 'Todas'], ['negocio', 'Negocio'], ['profesional', 'Profesional']] as [Tipo, string][]).map(([t, txt]) => (
            <button key={t} type="button" aria-pressed={tipo === t} className={tipo === t ? 'on' : undefined} onClick={() => setTipo(t)}>{txt}</button>
          ))}
        </div>
      </div>

      {cuentas.error && <Aviso>{cuentas.error}</Aviso>}

      <div className="cue-tabla">
        {visibles.length > 0 ? (
          <table className="tabla">
            <thead>
              <tr><th>Cuenta</th><th>Tipo</th><th>Estado</th><th>Señales</th><th className="centro">Empresas</th><th>Registro</th><th aria-label="Acciones" /></tr>
            </thead>
            <tbody>
              {visibles.map(c => {
                const est = estados.get(c.id)!
                const suyas = empresasDe(c.id)
                const desplegable = suyas.length > 0
                const abierta = desplegable && abiertas.has(c.id)
                const suspendida = c.estado === 'suspendida'
                return (
                  <Fragment key={c.id}>
                    <tr className={(desplegable ? 'cue-desplegable' : '') + (abierta ? ' cue-abierta' : '') + (suspendida ? ' apagada' : '')}
                        onClick={() => desplegable && alternar(c.id)}>
                      <td>
                        <div className="cue-cuenta">
                          <button type="button" className={'cue-flecha' + (desplegable ? '' : ' oculta')} aria-expanded={abierta}
                                  aria-label={abierta ? 'Ocultar sus empresas' : 'Ver sus empresas'}
                                  onClick={ev => { ev.stopPropagation(); alternar(c.id) }}>{abierta ? '▾' : '▸'}</button>
                          <div>
                            <div className="principal">{nombreDeCuenta(c)}</div>
                            <div className="secundario">
                              {c.usuario ? `@${c.usuario.alias} · ${c.usuario.correo}` : 'sin usuario'}
                              {c.titularDocumento && <> · <span title={c.titularDocumento}>{c.titularTipo === 'natural' ? 'DNI' : 'RUC'} {ocultar(c.titularDocumento)}</span></>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><span className={c.tipo === 'profesional' ? 'etiqueta aviso' : 'etiqueta acento'}>{c.tipo === 'profesional' ? 'Profesional' : 'Negocio'}</span></td>
                      <td>
                        <div className={'cue-estado t-' + est.tono}>{est.texto}</div>
                        {est.detalle && <div className="secundario">{est.detalle}</div>}
                      </td>
                      <td>
                        <div className="cue-chips">
                          {est.senales.map(s => <span key={s.texto} className={'cue-chip t-' + s.tono}>{s.texto}</span>)}
                          {est.senales.length === 0 && <span className="secundario">—</span>}
                        </div>
                      </td>
                      <td className="centro">{c.empresas}</td>
                      <td className="secundario cue-nowrap" title={c.origen === 'alta' ? 'Nació con su empresa' : 'Se registró'}>{fecha(c.creadoEn)}</td>
                      <td className="acciones" onClick={ev => ev.stopPropagation()}>
                        <MenuCuenta suspendida={suspendida}
                                    onTope={() => setCambiandoTope(c)}
                                    onSuspender={() => setSuspendiendo(c)}
                                    onReactivar={() => void reactivar(c)} />
                      </td>
                    </tr>
                    {abierta && (
                      <tr className="cue-detalle">
                        <td colSpan={7}>
                          <EmpresasDeCuenta cuenta={c} empresas={suyas} uso={uso.datos} planes={planes.datos}
                                            nombreModulo={cod => catalogo.datos?.find(m => m.codigo === cod)?.nombre ?? cod}
                                            botones={acciones.botones} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="relleno">
            <Vacio>{todas.length === 0 ? 'Todavía no hay cuentas.' : 'Ninguna cuenta con este filtro.'}</Vacio>
          </div>
        )}
      </div>
      <Paginacion {...paginacion} />

      <p className="cue-nota">
        «Señales» son avisos que no cambian el estado: el pago, un certificado por vencer y el tiempo sin emitir.
      </p>

      {acciones.dialogos}

      {suspendiendo && (
        <DialogoSuspenderCuenta cuenta={suspendiendo} onCerrar={() => setSuspendiendo(undefined)}
                                onHecho={() => { setSuspendiendo(undefined); void cuentas.recargar() }} />
      )}
      {cambiandoTope && (
        <DialogoTopeCuenta cuenta={cambiandoTope} onCerrar={() => setCambiandoTope(undefined)}
                           onHecho={() => { setCambiandoTope(undefined); void cuentas.recargar() }} />
      )}
    </div>
  )
}

/** Las empresas de una cuenta, con las columnas de «Empresas» y sus acciones. */
function EmpresasDeCuenta({ cuenta, empresas, uso, planes, nombreModulo, botones }: {
  cuenta: CuentaEnLista
  empresas: EmpresaEnLista[]
  uso?: Record<string, UsoComprobantes>
  planes?: Parameters<typeof PlanDeEmpresa>[0]['info']
  nombreModulo: (codigo: string) => string
  botones: (e: EmpresaEnLista) => React.ReactNode
}) {
  const sit = new Map<string, EmpresaSituacion>((cuenta.situacion?.empresas ?? []).map(e => [e.id, e]))
  const prof = cuenta.tipo === 'profesional'
  const propias = prof ? empresas.filter(e => e.cuenta?.rol === 'estudio') : []
  const clientes = prof ? empresas.filter(e => e.cuenta?.rol !== 'estudio') : empresas

  const fila = (e: EmpresaEnLista) => {
    const s = sit.get(e.id)
    const est = e.suspendidaEn ? { texto: 'Suspendida', tono: 'gris' as const } : estadoEmpresa(s)
    return (
      <tr key={e.id} className={e.suspendidaEn ? 'apagada' : undefined}>
        <td>
          <div className="principal">{e.nombre}</div>
          {e.razonSocial && e.razonSocial !== e.nombre && <div className="secundario">{e.razonSocial}</div>}
        </td>
        <td className="cue-nowrap">
          {e.ruc ? <span className="mono">{e.ruc}</span> : <span className="vacio">sin conectar</span>}
          {e.ambiente && <div className="secundario">{e.ambiente === 'produccion' ? 'producción' : 'beta'}</div>}
        </td>
        <td className="centro">{e.usuarios}</td>
        <td className="cue-nowrap"><UsoDelMes u={uso?.[e.id]} /></td>
        <td>
          <div className="cue-mods">
            <PlanDeEmpresa info={planes} id={e.id} />
            {e.modulos.map(m => <span key={m} className="cue-mod">{nombreModulo(m)}</span>)}
            {e.modulos.length === 0 && <span className="vacio">Ningún módulo</span>}
          </div>
        </td>
        <td><span className={'cue-estado t-' + est.tono}>{est.texto}</span></td>
        <td className="secundario cue-nowrap">{hace(s?.ultimoDocumento ?? null)}</td>
        <td className="cue-acc">{botones(e)}</td>
      </tr>
    )
  }

  return (
    <div className="cue-sub">
      <div className="cue-scroll">
        <table className="tabla cue-subtabla">
          <thead>
            <tr><th>Empresa</th><th>RUC</th><th className="centro">Usuarios</th><th>Comprobantes este mes</th><th>Plan y módulos</th><th>Estado</th><th>Último comprobante</th><th aria-label="Acciones" /></tr>
          </thead>
          <tbody>
            {prof && propias.length > 0 && <><tr className="cue-grupo"><td colSpan={8}>Mi empresa</td></tr>{propias.map(fila)}</>}
            {prof && <tr className="cue-grupo"><td colSpan={8}>Su cartera · {clientes.length}</td></tr>}
            {clientes.map(fila)}
            {prof && clientes.length === 0 && <tr><td colSpan={8} className="secundario">Todavía no tiene clientes en su cartera.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** «···»: cambiar el tope y suspender o reactivar la cuenta. */
function MenuCuenta({ suspendida, onTope, onSuspender, onReactivar }: {
  suspendida: boolean; onTope: () => void; onSuspender: () => void; onReactivar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (ev: MouseEvent) => { if (caja.current && !caja.current.contains(ev.target as Node)) setAbierto(false) }
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])
  const y = (f: () => void) => () => { setAbierto(false); f() }
  return (
    <div className="cue-menu" ref={caja}>
      <button type="button" className="boton plano cue-mas" aria-haspopup="menu" aria-expanded={abierto}
              aria-label="Más acciones de la cuenta" onClick={() => setAbierto(a => !a)}>···</button>
      {abierto && (
        <div className="cue-menu-lista" role="menu">
          <button type="button" role="menuitem" onClick={y(onTope)}>Cambiar tope de empresas por día</button>
          {suspendida
            ? <button type="button" role="menuitem" onClick={y(onReactivar)}>Reactivar la cuenta</button>
            : <button type="button" role="menuitem" className="peligro" onClick={y(onSuspender)}>Suspender la cuenta</button>}
        </div>
      )}
    </div>
  )
}

/** 4•••••12: la pantalla se mira con gente alrededor. */
function ocultar(doc: string) {
  return doc.length <= 4 ? doc : doc[0] + '•'.repeat(doc.length - 3) + doc.slice(-2)
}