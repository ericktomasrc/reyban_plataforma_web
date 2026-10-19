import { useCallback, useEffect, useState } from 'react'
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
import type { Resumen, UltimoComprobante } from '../servicios/inicioServicio'

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
    <>
      <div className="cabecera-bandeja">
        <div>
          <h1 className="titulo-pagina titulo-serif">{saludo()}, {usuario.nombre.split(' ')[0]}</h1>
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
          <div className="resumen-bandeja resumen-inicio">
            <div className="destacado">
              <span>Vendido en {mes}</span>
              <strong className="mono">S/ {soles(datos.vendido)}</strong>
              <span>
                con IGV · {datos.emitidos} comprobante{datos.emitidos === 1 ? '' : 's'}
                {datos.vendidoUsd !== 0 && <> · y US$ {soles(datos.vendidoUsd)}</>}
              </span>
            </div>
            <div className="bien">
              <span>Aceptados por SUNAT</span>
              <strong>{datos.aceptados}</strong>
              <span>de {datos.emitidos}</span>
            </div>
            <div className="ojo">
              <span>En camino</span>
              <strong>{datos.enCamino}</strong>
              <span>se actualizan solos</span>
            </div>
            <div className={datos.rechazados > 0 ? 'mal' : 'gris'}>
              <span>Rechazados</span>
              <strong>{datos.rechazados}</strong>
              <span>{datos.rechazados > 0 ? 'revísalos' : 'ninguno este mes'}</span>
            </div>
          </div>

          {datos.revisionPendiente && (
            <DeVuelta empresa={empresa!.nombre} configura={configura} onHecho={() => void cargar()} />
          )}

          <Avisos datos={datos} configura={configura} />

          <div className="inicio-cuerpo">
            <section className="bloque inicio-ultimos">
              <div className="cabecera-bloque">
                <h2>Últimos comprobantes</h2>
                <Link to="/facturacion/comprobantes">Ver todos →</Link>
              </div>
              {datos.ultimos.length === 0
                ? <Vacio>Todavía no has emitido ningún comprobante.{emite && <> <Link to="/facturacion/comprobantes/nuevo">Emite el primero</Link>.</>}</Vacio>
                : <Ultimos filas={datos.ultimos} />}
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
    </>
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
function Avisos({ datos, configura }: { datos: Resumen; configura: boolean }) {
  const dias = datos.certificadoHasta ? diasHasta(datos.certificadoHasta) : null

  return (
    <>
      {datos.ultimoRechazo && (
        <div className="aviso error fila-aviso">
          <span>
            <strong className="mono">{datos.ultimoRechazo.numero ?? 'Un comprobante'}</strong> fue rechazado por SUNAT
            {datos.ultimoRechazo.mensaje && <>: «{datos.ultimoRechazo.mensaje}»</>}. Corrígelo y emite uno nuevo.
          </span>
          <Link to={`/facturacion/comprobantes/${datos.ultimoRechazo.id}`}>Ver comprobante →</Link>
        </div>
      )}

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


function Ultimos({ filas }: { filas: UltimoComprobante[] }) {
  const navegar = useNavigate()

  return (
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
              <td>{d.cliente}</td>
              <td className="secundario sin-corte">{cuando(d.creadoEn)}</td>
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
  )
}


function TuEmpresa({ datos, configura }: { datos: Resumen; configura: boolean }) {
  const { empresa } = useYo()
  const { puede } = useSesion()
  const dias = datos.certificadoHasta ? diasHasta(datos.certificadoHasta) : null

  return (
    <section className="bloque tu-empresa">
      <h2>Tu empresa</h2>
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
    <>
      <h1 className="titulo-pagina">Hola, {usuario.nombre.split(' ')[0]}</h1>

      <section className="bloque">
        <h2>Tu cuenta</h2>
        <dl className="datos">
          <div className="fila"><dt>Nombre</dt><dd>{usuario.nombre}</dd></div>
          <div className="fila"><dt>Correo</dt><dd>{usuario.correo}</dd></div>
          <div className="fila"><dt>Alias</dt><dd>@{usuario.alias}</dd></div>
          <div className="fila"><dt>Segundo factor</dt><dd>{usuario.dosfaActivo ? 'Activo' : 'Sin configurar'}</dd></div>
          <div className="fila"><dt>Tipo de cuenta</dt><dd>Super administrador de la plataforma</dd></div>
        </dl>
      </section>

      <section className="bloque">
        <h2>Tus permisos</h2>
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

      <BloqueConsultas />

      <p className="nota">
        Las empresas y las cuentas están en el menú de la izquierda, en «Plataforma».
      </p>
    </>
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
  const pasos: [string, string][] = [
    ['Agregar la empresa', 'RUC, dirección fiscal y correo del titular'],
    ['Certificado digital', ''],
    ['Series', ''],
    ['Correo de respuesta y marca', ''],
    ['Usuario SOL y afiliación a SUNAT', 'para producción'],
  ]

  return (
    <>
      <div className="bienvenida-cabecera">
        <h1 className="titulo-pagina titulo-serif">Hola, {nombre.split(' ')[0]}. Tu cuenta está lista.</h1>
        <p className="bajada-pagina">
          Todavía no tienes empresas. Agrega la primera y te guiamos hasta emitir.
        </p>
      </div>

      <div className="bienvenida">
        <section className="bloque">
          <h2>Para emitir tu primer comprobante</h2>

          <ol className="lista-pasos">
            <li className="hecho">Crear tu cuenta</li>
            {pasos.map(([titulo, detalle], i) => (
              <li key={titulo} className={i === 0 ? 'actual' : undefined}>
                <span>
                  {i === 0 ? <strong>{titulo}</strong> : titulo}
                  {detalle && <span className="detalle-paso"> ({detalle})</span>}
                </span>
              </li>
            ))}
          </ol>

          <Link to="/configurar" className="boton">
            {profesional ? 'Agregar mi primera empresa' : 'Agregar mi empresa'}
          </Link>
          <p className="nota">Seis pasos. Puedes salir y volver: lo que guardes se queda.</p>
        </section>

        <aside className="bienvenida-lado">
          <section className="bloque">
            <h2>¿Necesitas ayuda?</h2>
            {/* La guía en PDF y los videos llegan en la fase 5. */}
            <ul className="lista-ayuda">
              <li>Guía paso a paso (PDF) <span className="etiqueta">muy pronto</span></li>
              <li>Videos cortos <span className="etiqueta">muy pronto</span></li>
            </ul>
          </section>

          <div className="aviso bien">
            Puedes probar en <strong>beta</strong> sin certificado real. Para
            SUNAT real necesitarás el certificado digital y el usuario SOL de
            cada empresa.
          </div>
        </aside>
      </div>
    </>
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