import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useSesion, useYo } from '../../../nucleo/sesion/SesionContexto'
import { carteraServicio, diasHasta } from '../../cartera/servicios/carteraServicio'
import { EstadoComprobante } from '../../facturacion/componentes/EstadoComprobante'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { ENLACE_PENDIENTE } from '../../recuperacion/servicios/recuperacionServicio'
import { inicioServicio } from '../servicios/inicioServicio'
import { consultasServicio } from '../../facturacion/servicios/facturacionServicio'
import { FranjaReclamos } from '../../cartera/componentes/ResponderReclamo'
import { pedidosServicio } from '../../cartera/servicios/pedidosServicio'
import type { ReclamoSobreMia } from '../../cartera/servicios/pedidosServicio'
import type { Resumen } from '../servicios/inicioServicio'
import { inventarioServicio, type AlertaInventario } from '../../inventario/servicios/inventarioServicio'
import { documentosServicio } from '../../facturacion/servicios/facturacionServicio'
import type { DocumentoEnLista } from '../../facturacion/tipos'
import { Paginacion } from '../../../componentes/Paginacion'
import { TarjetaTope } from '../../planes/componentes/TopeComprobantes'
import '../bienvenida.css'

/**
 * EL INICIO.
 *
 *   Super administrador          lo de siempre: quién es y con qué permisos.
 *   Cartera sin empresa abierta  a «Mis empresas» (o la bienvenida si no hay).
 *   Recién registrado            la bienvenida con los pasos para emitir.
 *   Con una empresa abierta      EL TABLERO (lienzo «Cuenta Negocio», 1):
 *                                cómo va el mes, lo que necesita atención y
 *                                los últimos comprobantes.
 *
 * El tablero es el mismo para la Cuenta Negocio y para una empresa abierta
 * desde la cartera: es el inicio DE LA EMPRESA, no de la cuenta.
 */
export function Inicio() {
  const { usuario, empresa, cuenta } = useYo()
  const navegar = useNavigate()

  // FASE 4: quien abrió un enlace de «Recupera tu empresa» sin haber entrado
  // vuelve a esa pantalla en cuanto entra.
  useEffect(() => {
    let pendiente: string | null = null
    try {
      pendiente = sessionStorage.getItem(ENLACE_PENDIENTE)
      if (pendiente) sessionStorage.removeItem(ENLACE_PENDIENTE)
    } catch { /* sin almacenamiento: no hay nada pendiente */ }
    if (pendiente) navegar(`/recuperar/empresa/${encodeURIComponent(pendiente)}`)
  }, [navegar])

  if (usuario.esSuperAdmin) return <InicioPlataforma />

  // LA CARTERA SIN EMPRESA ABIERTA (fase 3): si ya tiene empresas, su sitio
  // es la bandeja; si todavía ninguna, la bienvenida de siempre.
  const cartera = cuenta?.tipo === 'profesional' && !!cuenta.nivel
  if (cartera && !empresa) return <InicioCartera nombre={usuario.nombre} colaborador={cuenta?.nivel === 'colaborador'} />

  // RECIÉN REGISTRADO (016): tiene cuenta pero todavía no empresa.
  if (!empresa) return <Bienvenida nombre={usuario.nombre} profesional={cuenta?.tipo === 'profesional'} />

  return <Tablero />
}


// =============================================================================
// EL TABLERO DE LA EMPRESA
// =============================================================================

function Tablero() {
  const { usuario, empresa, cuenta, menu } = useYo()
  const { puede } = useSesion()

  const facturacion = menu.some(m => m.codigo === 'facturacion')
  const ve = facturacion && puede('facturacion.ver')
  const emite = facturacion && puede('facturacion.emitir')
  // El administrador de la empresa: de registro o dada de alta por el super
  // administrador (con Facturación contratada, migración 028).
  const configura = !usuario.esSuperAdmin && puede('facturacion.credenciales_gestionar')

  // El dueño de una Cuenta Negocio: la pista para pasar a Profesional.
  const convierte = cuenta?.tipo === 'negocio' && cuenta.nivel === 'dueno'

  const [datos, setDatos] = useState<Resumen | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  // e172: la tarjeta elegida filtra la grilla. «Todos» al entrar.
  const [filtro, setFiltro] = useState<Filtro>('todos')

  // FASE 4d: un reclamo con documentos sobre ESTA empresa («traspaso en
  // revisión»). Solo para la gente de la cuenta; si falla, no se enseña nada.
  const [reclamos, setReclamos] = useState<ReclamoSobreMia[]>([])
  const empresaId = empresa?.id
  const deLaCuenta = !!cuenta?.nivel
  const cargarReclamos = useCallback(async () => {
    try { setReclamos((await pedidosServicio.reclamos()).filter(r => r.empresaId === empresaId)) }
    catch { setReclamos([]) }
  }, [empresaId])
  useEffect(() => { if (deLaCuenta) void cargarReclamos() }, [deLaCuenta, cargarReclamos])

  const cargar = useCallback(async () => {
    try { setDatos(await inicioServicio.resumen()); setFallo(null) }
    catch (e) { setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer el resumen.') }
  }, [])

  useEffect(() => { if (ve) void cargar() }, [ve, cargar])

  // MIENTRAS HAYA ALGO EN CAMINO, se vuelve a mirar cada 15 segundos: así el
  // «En camino» pasa solo a «Aceptado» sin que nadie recargue la página.
  const enCamino = datos?.enCamino ?? 0
  useEffect(() => {
    if (!ve || enCamino === 0) return
    const t = window.setInterval(() => void cargar(), 15_000)
    return () => window.clearInterval(t)
  }, [ve, enCamino, cargar])

  const mes = datos ? nombreMes(datos.desde) : nombreMes(null)

  return (
    <div className={cuenta ? 'tablero-negocio' : undefined}>
      <div className="cabecera-bandeja">
        <div>
          <h1 className="titulo-pagina titulo-serif">{saludo()}, <span className="nombre-saludo">{usuario.nombre.split(' ')[0]}</span></h1>
          <p className="bajada-pagina">
            <strong>{empresa!.nombre}</strong>
            {datos?.ambiente === 'produccion' && <> emite en <strong>producción</strong></>}
            {datos?.ambiente === 'beta' && <> está en <strong>pruebas (beta)</strong></>}
            {ve ? <>. Así va {mes}.</> : '.'}
          </p>
        </div>
        {emite && <Link to="/facturacion/comprobantes/nuevo" className="boton">+ Nuevo comprobante</Link>}
      </div>

      <FranjaReclamos reclamos={reclamos} onRespondido={cargarReclamos} />

      {/* CON EMPRESA PERO SIN FACTURACIÓN TODAVÍA (fase 2): el asistente se
          quedó a medias. */}
      {!facturacion && configura && (
        <div className="aviso ojo fila-aviso">
          <span>Tu empresa todavía no está lista para emitir. Te faltan algunos pasos.</span>
          <Link to="/configurar" className="boton">Continuar la configuración</Link>
        </div>
      )}

      {ve && fallo && <Aviso>{fallo}</Aviso>}
      {ve && !datos && !fallo && <Cargando texto="Leyendo cómo va el mes…" />}

      {ve && datos && (
        <>
          <div className="resumen-bandeja resumen-inicio con-filtros">
            <div className="destacado">
              <IconoIndicador tipo="venta" />
              <span>Vendido en {mes}</span>
              <strong className="mono">S/ {soles(datos.vendido)}</strong>
              <span>
                con IGV · {datos.emitidos} comprobante{datos.emitidos === 1 ? '' : 's'}
                {datos.vendidoUsd !== 0 && <> · y US$ {soles(datos.vendidoUsd)}</>}
              </span>
            </div>
            {/* e172: LAS TARJETAS SON FILTROS de la grilla de abajo. «Todos», elegida al entrar. */}
            {TARJETAS.map(t => {
              const n = t.cuenta(datos)
              return (
                <button key={t.clave} type="button" aria-pressed={filtro === t.clave}
                        className={`tarjeta-filtro ${t.tono(n)}${filtro === t.clave ? ' elegida' : ''}`}
                        onClick={() => setFiltro(t.clave)}>
                  <IconoIndicador tipo={t.clave} />
                  <span>{t.titulo}</span>
                  <strong>{n}</strong>
                  <span>{t.pie(n, datos)}</span>
                </button>
              )
            })}
          </div>

          {datos.revisionPendiente && (
            <DeVuelta empresa={empresa!.nombre} configura={configura} onHecho={() => void cargar()} />
          )}

          <Avisos datos={datos} configura={configura} />
          {/* e234 (085): cuántos comprobantes lleva este mes y su tope. */}
          <TarjetaTope />
          {puede('inventario.ver') && <AvisoInventario />}

          <div className="inicio-cuerpo">
            <section className="bloque inicio-ultimos">
              {datos.ultimos.length === 0
                ? (
                  <>
                    <div className="cabecera-bloque"><h2>{cuenta && <IconoSeccion tipo="comprobantes" />}Comprobantes</h2></div>
                    <Vacio>Todavía no has emitido ningún comprobante.{emite && <> <Link to="/facturacion/comprobantes/nuevo">Emite el primero</Link>.</>}</Vacio>
                  </>
                )
                : <GrillaDelMes filtro={filtro} desde={datos.desde} mes={mes} refresco={datos} />}
            </section>

            <aside className="inicio-lado">
              <TuEmpresa datos={datos} configura={configura} />

              {convierte && (
                <div className="pista-convertir">
                  <strong>¿Facturas para más empresas?</strong>
                  <span>Convierte tu cuenta en Cuenta Profesional. Tu empresa y su historial se quedan igual.</span>
                  <Link to="/perfil#convertir">Ver cómo →</Link>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      {/* Quien no ve comprobantes (un rol solo de usuarios, por ejemplo), o la
          empresa sin facturación: los datos de la empresa y nada más. */}
      {!ve && (
        <section className="bloque">
          <h2>Tu empresa</h2>
          <dl className="datos">
            <div className="fila"><dt>Razón social</dt><dd>{empresa!.razonSocial ?? '—'}</dd></div>
            <div className="fila"><dt>RUC</dt><dd className="mono">{empresa!.ruc ?? '—'}</dd></div>
            {empresa!.correoTitular && (
              <div className="fila"><dt>Correo del titular</dt><dd>{empresa!.correoTitular}</dd></div>
            )}
          </dl>
          {convierte && <p className="nota"><Link to="/perfil#convertir">¿Facturas para más empresas?</Link></p>}
        </section>
      )}
    </div>
  )
}


/**
 * «ES TUYA OTRA VEZ» (lienzo «Fase 4», pantalla 3): la empresa recién
 * recuperada. Dos cosas que revisar antes de emitir; no bloquea nada.
 */
function DeVuelta({ empresa, configura, onHecho }: { empresa: string; configura: boolean; onHecho: () => void }) {
  const mensaje = useMensaje()
  const [ocupado, setOcupado] = useState(false)

  const hecho = async () => {
    setOcupado(true)
    try {
      mensaje.bien((await inicioServicio.revisionHecha()).mensaje)
      onHecho()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.')
      setOcupado(false)
    }
  }

  return (
    <section className="bloque de-vuelta">
      <h2>{empresa} es tuya otra vez</h2>
      <p className="texto-paso">Todo su historial está aquí. Antes de emitir, revisa dos cosas:</p>
      <ol className="lista-revision">
        <li>
          <span>
            <strong>¿Emitiste con otro sistema mientras estaba en pausa?</strong>
            <span className="secundario">Si sí, ajusta el último número de cada serie. Si no, no hay nada que hacer.</span>
          </span>
          {configura && <Link to="/configurar" className="boton secundario">Revisar series</Link>}
        </li>
        <li>
          <span>
            <strong>Cambia la clave de tu usuario SOL secundario</strong>
            <span className="secundario">Quien gestionaba tu empresa la conocía. Cámbiala en SUNAT y pon la nueva en Configuración.</span>
          </span>
          {configura && <Link to="/configurar" className="boton secundario">Poner la clave nueva</Link>}
        </li>
      </ol>
      {configura && (
        <button type="button" className="boton" disabled={ocupado} onClick={() => void hecho()}>
          {ocupado ? 'Guardando…' : 'Ya lo revisé'}
        </button>
      )}
    </section>
  )
}


/** Rechazos, errores de envío y certificado por vencer: lo que pide atención. */
/** 052: productos bajo su mínimo o en negativo (si la empresa lleva inventario). */
function AvisoInventario() {
  const [alertas, setAlertas] = useState<AlertaInventario[]>([])
  useEffect(() => {
    let vivo = true
    inventarioServicio.alertas().then(a => { if (vivo) setAlertas(a) }).catch(() => { /* sin inventario */ })
    return () => { vivo = false }
  }, [])
  const bajos = alertas.reduce((n, a) => n + a.bajoMinimo, 0)
  const negativos = alertas.reduce((n, a) => n + a.negativos, 0)
  if (bajos === 0 && negativos === 0) return null
  return (
    <div className="aviso ojo fila-aviso">
      <span>
        {bajos > 0 && <><strong>{bajos} producto(s) bajo el mínimo</strong> ({alertas.filter(a => a.bajoMinimo > 0).map(a => `${a.codigo} ${a.nombre}`).join(', ')}). </>}
        {negativos > 0 && <><strong>{negativos} en negativo</strong>. </>}
      </span>
      <Link to="/inventario" className="boton">Ver el stock</Link>
    </div>
  )
}

function Avisos({ datos, configura }: { datos: Resumen; configura: boolean }) {
  const dias = datos.certificadoHasta ? diasHasta(datos.certificadoHasta) : null

  return (
    <>
      {/* e172: el aviso del último rechazo ya no sale aquí: la tarjeta
          «Rechazados» los lista todos en la grilla. */}

      {datos.conError > 0 && (
        <div className="aviso ojo fila-aviso">
          <span>
            {datos.conError === 1 ? 'Un comprobante no se pudo enviar' : `${datos.conError} comprobantes no se pudieron enviar`}.
            No gastaron número: puedes reintentarlo.
          </span>
          <Link to="/facturacion/comprobantes">Ir a comprobantes →</Link>
        </div>
      )}

      {dias !== null && dias <= 30 && (
        <div className={'aviso fila-aviso ' + (dias <= 7 ? 'error' : 'ojo')}>
          <span>
            {dias < 0
              ? <>Tu certificado digital <strong>venció el {fecha(datos.certificadoHasta)}</strong>: no puedes emitir.</>
              : <>Tu certificado digital vence el <strong>{fecha(datos.certificadoHasta)}</strong> (en {dias} día{dias === 1 ? '' : 's'}).</>}
            {' '}Pide la renovación a tu certificadora y súbelo en Configuración.
          </span>
          {configura && <Link to="/configurar">Configuración →</Link>}
        </div>
      )}
    </>
  )
}


// =============================================================================
// e172 — LAS TARJETAS COMO FILTROS Y LA GRILLA DEL MES
// =============================================================================

type Filtro = 'todos' | 'aceptados' | 'encamino' | 'rechazados' | 'anulados'

const TARJETAS: {
  clave: Filtro; titulo: string; estado: string
  cuenta: (d: Resumen) => number
  tono: (n: number) => string
  pie: (n: number, d: Resumen) => string
}[] = [
  { clave: 'todos', titulo: 'Todos', estado: 'emitidos', cuenta: d => d.emitidos, tono: () => 'gris',
    pie: () => 'emitidos este mes' },
  { clave: 'aceptados', titulo: 'Aceptados', estado: 'aceptados', cuenta: d => d.aceptados, tono: () => 'bien',
    pie: (_n, d) => `por SUNAT, de ${d.emitidos}` },
  { clave: 'encamino', titulo: 'En camino', estado: 'encolado', cuenta: d => d.enCamino, tono: () => 'ojo',
    pie: () => 'se actualizan solos' },
  { clave: 'rechazados', titulo: 'Rechazados', estado: 'rechazado', cuenta: d => d.rechazados, tono: n => n > 0 ? 'mal' : 'gris',
    pie: n => n > 0 ? 'revísalos' : 'ninguno este mes' },
  { clave: 'anulados', titulo: 'Anulados', estado: 'anulado', cuenta: d => d.anulados ?? 0, tono: () => 'gris',
    pie: n => n > 0 ? 'con baja o anulación' : 'ninguno este mes' },
]


function IconoIndicador({ tipo }: { tipo: 'venta' | Filtro }) {
  const rutas: Record<string, ReactNode> = {
    venta: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h8m-5-3v6"/></>,
    todos: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></>,
    aceptados: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
    encamino: <><path d="m21 3-8 18-3.7-7.3L2 10zM9.3 13.7 21 3"/></>,
    rechazados: <><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></>,
    anulados: <><path d="M4 7h16M10 4h4M6 7l1 14h10l1-14M10 11v6m4-6v6"/></>,
  }
  return <svg className="negocio-indicador-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{rutas[tipo]}</svg>
}

const POR_PAGINA = 10

function GrillaDelMes({ filtro, desde, mes, refresco }: { filtro: Filtro; desde: string; mes: string; refresco: Resumen }) {
  const navegar = useNavigate()
  const [q, setQ] = useState('')
  const [buscado, setBuscado] = useState('')
  // La página es la de ESTE filtro: al cambiar de tarjeta se vuelve a la 1.
  const [pag, setPag] = useState<{ filtro: Filtro; n: number }>({ filtro, n: 1 })
  const pagina = pag.filtro === filtro ? pag.n : 1
  const setPagina = (n: number) => setPag({ filtro, n })
  const [filas, setFilas] = useState<DocumentoEnLista[]>()
  const [total, setTotal] = useState(0)
  const [fallo, setFallo] = useState<string>()
  const t = TARJETAS.find(x => x.clave === filtro)!

  // Lo escrito se busca al dejar de escribir (no una llamada por tecla).
  useEffect(() => {
    const h = window.setTimeout(() => { setBuscado(q.trim()); setPag(p => ({ ...p, n: 1 })) }, 300)
    return () => window.clearTimeout(h)
  }, [q])

  useEffect(() => {
    let vivo = true
    // «En camino» es de cualquier fecha (como su tarjeta); lo demás, del mes.
    documentosServicio.listar(t.estado, buscado, pagina, undefined,
      { desde: filtro === 'encamino' ? undefined : desde, porPagina: POR_PAGINA })
      .then(r => { if (vivo) { setFilas(r.filas); setTotal(r.total); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer la lista.') })
    return () => { vivo = false }
  }, [t.estado, buscado, pagina, filtro, desde, refresco])

  return (
    <>
      <div className="cabecera-bloque grilla-inicio-cabecera">
        <h2><IconoSeccion tipo="comprobantes" />{filtro === 'todos' ? `Comprobantes de ${mes}` : `${t.titulo}${filtro === 'encamino' ? '' : ` en ${mes}`}`}</h2>
        <input className="buscar-inicio" value={q} onChange={e => setQ(e.target.value)}
               placeholder="Buscar RUC, razón social o número…" title="Ej.: 20512345678, HAMUTAY, F001-6" aria-label="Buscar comprobantes" />
        <Link to="/facturacion/comprobantes">Ver todos →</Link>
      </div>
      {fallo && <Aviso>{fallo}</Aviso>}
      {!filas && !fallo && <Cargando texto="Buscando…" />}
      {filas && filas.length === 0 && (
        <Vacio>{buscado ? <>Ningún comprobante con «{buscado}».</> : <>No hay comprobantes {t.titulo.toLowerCase()} {filtro === 'encamino' ? 'ahora' : `en ${mes}`}.</>}</Vacio>
      )}
      {filas && filas.length > 0 && (
        <div className="tabla-envoltura">
          <table className="tabla tabla-clic">
            <thead>
              <tr><th>Número</th><th>Cliente</th><th>Cuándo</th><th className="derecha">Importe</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {filas.map(d => (
                <tr key={d.id} onClick={() => navegar(`/facturacion/comprobantes/${d.id}`)}>
                  <td>
                    <Link to={`/facturacion/comprobantes/${d.id}`} className="principal mono sin-corte" onClick={e => e.stopPropagation()}>
                      {d.serie && d.correlativo !== null
                        ? `${d.serie}-${String(d.correlativo).padStart(8, '0')}`
                        : `${TIPOS[d.tipo] ?? d.tipo} sin número`}
                    </Link>
                    <div className="secundario">{TIPOS[d.tipo] ?? d.tipo}</div>
                  </td>
                  <td>
                    <div>{d.cliente.razonSocial}</div>
                    <div className="secundario mono">{d.cliente.numeroDocumento}</div>
                  </td>
                  <td className="secundario sin-corte">{d.creadoEn ? cuando(d.creadoEn) : fecha(d.fechaEmision)}</td>
                  <td className="derecha mono sin-corte">
                    {d.tipo === '07' ? '−' : ''}{soles(d.importeTotal)}
                    {d.moneda !== 'PEN' && <span className="secundario"> {d.moneda}</span>}
                  </td>
                  <td><EstadoComprobante estado={d.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > POR_PAGINA && (
        <div className="lineas-pie"><Paginacion total={total} pagina={pagina} porPagina={POR_PAGINA} onCambiar={setPagina} /></div>
      )}
    </>
  )
}

/** Iconografía decorativa: no altera navegación ni acciones. */
function IconoSeccion({ tipo }: { tipo: 'comprobantes' | 'empresa' }) {
  return (
    <span className="negocio-icono-seccion" aria-hidden="true">
      {tipo === 'empresa' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-5h6v5M8 7h2m4 0h2M8 11h2m4 0h2"/></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></svg>
      )}
    </span>
  )
}

function TuEmpresa({ datos, configura }: { datos: Resumen; configura: boolean }) {
  const { empresa } = useYo()
  const { puede } = useSesion()
  const dias = datos.certificadoHasta ? diasHasta(datos.certificadoHasta) : null

  return (
    <section className="bloque tu-empresa">
      <h2><IconoSeccion tipo="empresa" />Tu empresa</h2>
      <dl className="datos-cortos">
        <div><dt>RUC</dt><dd className="mono">{empresa!.ruc ?? '—'}</dd></div>
        <div>
          <dt>Ambiente</dt>
          <dd>{datos.ambiente === 'produccion' ? 'Producción' : datos.ambiente === 'beta' ? 'Pruebas (beta)' : '—'}</dd>
        </div>
        <div>
          <dt>Certificado vence</dt>
          <dd className={dias !== null && dias <= 30 ? 'texto-ojo' : undefined}>
            {datos.certificadoHasta ? fecha(datos.certificadoHasta) : '—'}
          </dd>
        </div>
        <div><dt>Series</dt><dd className="mono">{datos.series.length ? datos.series.join(' · ') : '—'}</dd></div>
        <div>
          <dt>Usuarios</dt>
          <dd>{puede('usuarios.ver') ? <Link to="/usuarios">{datos.usuarios}</Link> : datos.usuarios}</dd>
        </div>
        {empresa!.correoTitular && (
          <div><dt>Correo del titular</dt><dd className="cortar">{empresa!.correoTitular}</dd></div>
        )}
      </dl>
      {configura && <Link to="/configurar" className="enlace-pie">Configuración de la empresa →</Link>}
    </section>
  )
}


// =============================================================================
// LO DE ANTES: super administrador, cartera y bienvenida
// =============================================================================

/** El super administrador: quién es y con qué entró. */
function InicioPlataforma() {
  const { usuario, permisos } = useYo()

  return (
    <div className="inicio-admin">
      <header className="inicio-admin-hero">

        <div>
          
          <h1 className="titulo-pagina">Hola, {usuario.nombre.split(' ')[0]}</h1>
          <p>Bienvenido a tu plataforma de gestión empresarial.</p>
        </div>
      </header>

      <div className="inicio-admin-grid">
      <section className="bloque inicio-admin-cuenta">
        <div className="inicio-admin-titulo"><span className="inicio-admin-icono" aria-hidden="true">♙</span><div><h2>Tu cuenta</h2><p className="inicio-admin-subtitulo">Información de tu cuenta en la plataforma.</p></div></div>
        <dl className="datos">
          <div className="fila"><dt>Nombre</dt><dd>{usuario.nombre}</dd></div>
          <div className="fila"><dt>Correo</dt><dd>{usuario.correo}</dd></div>
          <div className="fila"><dt>Alias</dt><dd>@{usuario.alias}</dd></div>
          <div className="fila"><dt>Segundo factor</dt><dd>{usuario.dosfaActivo ? 'Activo' : 'Sin configurar'}</dd></div>
          <div className="fila"><dt>Tipo de cuenta</dt><dd>Super administrador de la plataforma</dd></div>
        </dl>
      </section>

      <section className="bloque inicio-admin-acciones">
        <div className="inicio-admin-titulo"><span className="inicio-admin-icono" aria-hidden="true">↗</span><div><h2>Accesos rápidos</h2><p className="inicio-admin-subtitulo">Acceso directo a los módulos existentes.</p></div></div>
        <div className="inicio-admin-acciones-enlaces">
          <Link to="/admin/empresas">Ver empresas <span aria-hidden="true">→</span></Link>
          <Link to="/admin/cuentas">Ver cuentas <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section className="bloque inicio-admin-permisos">
        <div className="inicio-admin-titulo"><span className="inicio-admin-icono" aria-hidden="true">✓</span><h2>Tus permisos</h2></div>
        {permisos.length > 0 ? (
          <div className="etiquetas">
            {permisos.map(p => <span key={p} className="etiqueta">{p}</span>)}
          </div>
        ) : (
          <Vacio>
            Como super administrador los tienes todos, así que la lista sale
            vacía: no hacen falta roles para lo que ya puedes hacer.
          </Vacio>
        )}
      </section>

      <div className="inicio-admin-consultas"><BloqueConsultas /></div>
      </div>
      <p className="nota inicio-admin-nota">
        Las empresas y las cuentas están en el menú de la izquierda, en «Plataforma».
      </p>
    </div>
  )
}


/**
 * 17 oct: las consultas de RUC, DNI y tipo de cambio del mes (Decolecta). Al
 * 80 % y al acabarse también llega un correo; aquí se ve en cualquier momento.
 */
function BloqueConsultas() {
  const [d, setD] = useState<Awaited<ReturnType<typeof consultasServicio.estadoMes>>>()

  useEffect(() => {
    consultasServicio.estadoMes().then(setD).catch(() => setD(undefined))
  }, [])

  if (!d) return null

  const pct = d.limite > 0 ? Math.round(d.usadas * 100 / d.limite) : 0
  const agotadas = !!d.agotadaEn || d.usadas >= d.limite
  const contacto = [d.whatsapp && `WhatsApp ${d.whatsapp}`, d.correo, 'decolecta.com'].filter(Boolean).join(' · ')

  return (
    <section className="bloque">
      <h2>Consultas de RUC, DNI y tipo de cambio</h2>
      {!d.configurado ? (
        <Aviso tono="ojo">
          Sin token de Decolecta (DECOLECTA_TOKEN en el .env de la plataforma): los datos de los
          clientes se escriben a mano.
        </Aviso>
      ) : (
        <>
          <p>Este mes: <strong>{d.usadas} de {d.limite}</strong> ({pct} %).{!d.dniActivo && ' La consulta de DNI está apagada.'}</p>
          {agotadas ? (
            <Aviso>Se acabaron las consultas del mes: los datos se escriben a mano. Para comprar más: {contacto}.</Aviso>
          ) : pct >= 80 ? (
            <Aviso tono="ojo">Van por el {pct} %. Para comprar más: {contacto}.</Aviso>
          ) : null}
        </>
      )}
    </section>
  )
}


/** Profesional sin empresa abierta: a la bandeja, o la bienvenida si no hay ninguna. */
function InicioCartera({ nombre, colaborador }: { nombre: string; colaborador: boolean }) {
  const [cuantas, setCuantas] = useState<number | null>(null)

  useEffect(() => {
    carteraServicio.empresas().then(e => setCuantas(e.length)).catch(() => setCuantas(1))
  }, [])

  if (cuantas === null) return <Cargando texto="Abriendo tu cartera…" />
  if (cuantas > 0 || colaborador) return <Navigate to="/empresas" replace />
  return <Bienvenida nombre={nombre} profesional />
}


/**
 * La primera entrada de una cuenta sin empresa.
 *
 * El botón abre el asistente de la fase 2 (/configurar), que lleva de aquí a
 * «lista para emitir».
 */
function Bienvenida({ nombre, profesional }: { nombre: string; profesional: boolean }) {
  // Diseño 16 nov: los mismos pasos (y nombres) que el asistente de Configuración.
  const pasos: [string, string][] = [
    ['Tu empresa', 'escribes el RUC y traemos tus datos de SUNAT'],
    ['Firma digital', 'tu certificado, o uno de prueba para empezar'],
    ['Numeración', 'F001 para facturas, B001 para boletas'],
    ['Envío a clientes', 'el correo con el PDF y el XML, y tu marca'],
    ['SUNAT', 'solo para emitir de verdad; en prueba puedes saltarlo'],
  ]

  return (
    <div className="bnv-pagina">
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Hola, {nombre.split(' ')[0]}. Tu cuenta está lista.</h1>
          <p className="bajada-pagina">
            {profesional
              ? 'Todavía no tienes empresas. Agrega la primera y te guiamos hasta emitir.'
              : 'Agrega tu empresa y te guiamos hasta emitir.'}
          </p>
        </div>
      </div>

      <div className="bnv-cuerpo">
        <section className="bloque bnv-pasos">
          <h2>Para emitir tu primer comprobante</h2>

          <ol>
            <li className="hecho"><i aria-hidden="true">✓</i><span><strong>Crear tu cuenta</strong></span></li>
            {pasos.map(([titulo, detalle], i) => (
              <li key={titulo} className={i === 0 ? 'actual' : undefined}>
                <i aria-hidden="true">{i + 1}</i>
                <span><strong>{titulo}</strong><small>{detalle}</small></span>
              </li>
            ))}
          </ol>

          <div className="bnv-pie">
            <Link to="/configurar" className="boton">
              {profesional ? 'Agregar mi primera empresa' : 'Agregar mi empresa'}
            </Link>
            <span>Unos minutos. Puedes salir y volver: lo que guardes se queda.</span>
          </div>
        </section>

        <aside className="bnv-ayuda">
          <h3>Qué vas a necesitar</h3>
          <ul>
            <li>El <strong>RUC</strong> de la empresa.</li>
            <li>El <strong>correo del dueño</strong> de la empresa.</li>
            <li>Tu certificado digital (.pfx). <span>Si aún no lo tienes, pruebas con uno de prueba.</span></li>
            <li>Tu usuario SOL secundario. <span>Solo para emitir de verdad.</span></li>
          </ul>
          <p className="bnv-nota">
            En modo prueba (beta) tus comprobantes no tienen valor ante SUNAT: sirven para conocer el sistema.
          </p>
          <p className="bnv-nota">¿Te trabaste? Usa <strong>¿Ayuda? Escríbenos</strong>, abajo a la derecha.</p>
        </aside>
      </div>
    </div>
  )
}


// =============================================================================
// FORMATOS
// =============================================================================

const TIPOS: Record<string, string> = {
  '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito',
}

const dinero = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function soles(n: number): string { return dinero.format(n) }

function saludo(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

/** «octubre», del primer día del mes que manda el back (sin líos de zona). */
function nombreMes(desde: string | null): string {
  const [a, m] = desde ? desde.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1]
  return new Date(a, m - 1, 1).toLocaleDateString('es-PE', { month: 'long' }).toLowerCase()
}

const hora = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** «hoy 10:42», «ayer», o la fecha. */
function cuando(valor: string): string {
  const d = new Date(valor)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  if (d >= hoy) return `hoy ${hora.format(d)}`
  if (d >= ayer) return `ayer ${hora.format(d)}`
  return fecha(valor)
}