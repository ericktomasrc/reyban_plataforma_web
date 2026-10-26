import { useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { credencialesServicio } from '../../facturacion/servicios/facturacionServicio'
import type {
  AvisoFacturacion, ComprobacionClave, EstadoFacturacion, PruebaConexion,
} from '../../facturacion/tipos'
import type { EmpresaEnLista } from '../tipos'

interface Props {
  empresa: EmpresaEnLista
  onCerrar: () => void

  /** Para que la lista de atrás refresque sus marcas. */
  onCambiado?: () => void
}

/** Desde cuántos días se avisa. El mismo número que usa el back en el log. */
const DIAS_DE_AVISO = 30

/** Con esto o menos, el aviso pasa a rojo: ya no da tiempo de sobra a comprarlo. */
const DIAS_URGENTE = 7

/** «14/03/2027», en hora de Lima: un certificado vence un día, no a una hora. */
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima',
  })
}

function textoDias(dias: number): string {
  if (dias <= 0) return 'vence hoy'
  return dias === 1 ? 'queda 1 día' : `quedan ${dias} días`
}

function mensajeDe(e: unknown, siNo: string): string {
  return e instanceof ErrorApi ? e.message : siNo
}

/** Una línea de la lista «lo que falta para emitir». */
function Requisito({ listo, titulo, detalle, opcional }: {
  listo: boolean | null | undefined
  titulo: string
  detalle?: string

  /** Falta, pero no impide activar Facturación: se pinta en ámbar, no en rojo. */
  opcional?: string
}) {
  return (
    <div className="fila">
      <dt>{titulo}</dt>
      <dd>
        <span className={listo ? 'estado bueno' : opcional ? 'estado aviso' : 'estado malo'}>
          {listo ? 'Listo' : opcional ?? 'Falta'}
        </span>
        {detalle && <div className="secundario">{detalle}</div>}
      </dd>
    </div>
  )
}

/**
 * La ventana de Facturación de una empresa (parte C).
 *
 * DESDE LA PARTE C, UNA EMPRESA NUEVA LLEGA AQUÍ YA CONECTADA: el alta creó su
 * emisor en el servicio y guardó la clave. Esta ventana ENSEÑA lo que dice el
 * servicio —datos oficiales, si el alta se confirmó, qué le falta para emitir,
 * si sus receptores van a recibir el correo— y sirve para tres cosas más:
 *
 *   1. «Volver a preguntar al servicio»: refresca todo lo de arriba, y
 *      confirma un alta que se hubiera quedado a medias.
 *   2. «Comprobar → Conectar»: para ROTAR la clave, para pasar a PRODUCCIÓN
 *      (la clave de producción se emite a mano en el servicio) y para conectar
 *      empresas que existían antes de este cambio.
 *   3. «Revocar la clave anterior» (punto 21): después de rotar, el back le
 *      pide al servicio que la dé de baja, comprueba que de verdad ya no vale
 *      y vacía su copia guardada. El aviso rojo no se apaga sin comprobarlo.
 *
 * NINGÚN SECRETO VUELVE DEL BACK. De la clave y del secreto del webhook solo se
 * ven los cuatro últimos caracteres.
 */
export function DialogoFacturacion({ empresa, onCerrar, onCambiado }: Props) {
  const mensaje = useMensaje()

  const [estado, setEstado] = useState<EstadoFacturacion>()
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string>()

  const [prueba, setPrueba] = useState<PruebaConexion>()
  const [probando, setProbando] = useState(false)

  // Comprobar → Conectar
  const [url, setUrl] = useState('')
  const [clave, setClave] = useState('')
  const [comprobacion, setComprobacion] = useState<ComprobacionClave>()
  const [comprobando, setComprobando] = useState(false)
  const [conectando, setConectando] = useState(false)
  const [errorConexion, setErrorConexion] = useState<string>()
  const [avisoAnterior, setAvisoAnterior] = useState<string>()

  // «Ya la revoqué»
  const [revocando, setRevocando] = useState(false)
  const [errorRevocada, setErrorRevocada] = useState<string>()

  // ROTAR EN UN CLIC (17 oct): lo que pasó con la clave anterior al conectar,
  // dicho junto al botón y no arriba del todo.
  const [rotacion, setRotacion] = useState<{ ok: boolean; texto: string }>()

  // Configuración manual (emergencia)
  const [secreto, setSecreto] = useState('')
  const [guardandoSecreto, setGuardandoSecreto] = useState(false)

  async function releer() {
    const e = await credencialesServicio.ver(empresa.id)
    setEstado(e)
    return e
  }

  async function cargar() {
    try {
      const e = await releer()
      setUrl(e.credencial?.baseUrl ?? e.servicio.baseUrl ?? 'https://localhost:7295')
    } catch (e) {
      setErrorCarga(mensajeDe(e, 'No se pudo cargar la configuración.'))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { void cargar() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa.id])

  // --- Volver a preguntar al servicio --------------------------------------
  async function probar() {
    setProbando(true)
    setPrueba(undefined)
    try {
      const r = await credencialesServicio.probar(empresa.id)
      setPrueba(r)
      try { await releer() } catch { /* se queda lo que había */ }
      onCambiado?.()
    } catch (e) {
      mensaje.error(mensajeDe(e, 'No se pudo preguntar al servicio.'))
    } finally {
      setProbando(false)
    }
  }

  // --- Comprobar: de quién es la clave, sin guardar ------------------------
  async function comprobar(e: React.FormEvent) {
    e.preventDefault()
    setComprobacion(undefined)
    setErrorConexion(undefined)
    setAvisoAnterior(undefined)
    setRotacion(undefined)

    const k = clave.trim()
    if (k.startsWith('whsec_')) {
      setErrorConexion('Eso es un secreto de webhook, no la clave del servicio. La clave empieza por fac_.')
      return
    }
    if (!k.startsWith('fac_')) {
      setErrorConexion('La clave del servicio empieza por fac_ y va entera, sin espacios.')
      return
    }

    setComprobando(true)
    try {
      setComprobacion(await credencialesServicio.comprobar(empresa.id, url.trim(), k))
    } catch (err) {
      setErrorConexion(mensajeDe(err, 'No se pudo comprobar la clave.'))
    } finally {
      setComprobando(false)
    }
  }

  // --- Conectar: registra el webhook y guarda todo -------------------------
  async function conectar() {
    setConectando(true)
    setErrorConexion(undefined)
    try {
      const r = await credencialesServicio.conectar(empresa.id, url.trim(), clave.trim())
      mensaje.bien(r.mensaje)
      setAvisoAnterior(r.avisoClaveAnterior ?? undefined)
      setClave('')
      setComprobacion(undefined)

      // EN ESTE ORDEN Y EN PETICIONES APARTE, cuando lo de arriba ya está
      // guardado: confirmar el alta (si estaba a medias) y pedir al servicio
      // que reenvíe los avisos que se rechazaron mientras tanto.
      try { await credencialesServicio.confirmarAlta(empresa.id) } catch { /* se confirma sola después */ }
      try {
        const re = await credencialesServicio.reintentarAvisos(empresa.id)
        if (re.reencoladas > 0) mensaje.bien(re.mensaje)
      } catch { /* no impide nada: los avisos nuevos llegan igual */ }

      // LA ANTERIOR SE REVOCA SOLA: la clave nueva ya respondió (por eso
      // conectó), así que no hace falta un segundo paso. Si el servicio no
      // deja, queda el botón «Revocar la clave anterior» junto a este.
      if (r.avisoClaveAnterior) {
        try {
          await credencialesServicio.yaLaRevoque(empresa.id)
          setAvisoAnterior(undefined)
          setRotacion({ ok: true, texto: 'Listo: conectada la clave nueva y revocada la anterior. El servicio ya no la acepta.' })
        } catch (err) {
          setRotacion({ ok: false, texto: 'Conectada la clave nueva, pero la anterior NO se pudo revocar: ' +
                                         mensajeDe(err, 'no se pudo comprobar.') })
        }
      }

      await releer()
      onCambiado?.()
    } catch (err) {
      setErrorConexion(mensajeDe(err, 'No se pudo conectar.'))
    } finally {
      setConectando(false)
    }
  }

  // --- «Ya la revoqué» -----------------------------------------------------
  async function yaLaRevoque() {
    setRevocando(true)
    setErrorRevocada(undefined)
    try {
      const r = await credencialesServicio.yaLaRevoque(empresa.id)
      mensaje.bien(r.mensaje)
      setAvisoAnterior(undefined)
      setRotacion(x => x ? { ok: true, texto: 'Listo: la clave anterior quedó revocada. El servicio ya no la acepta.' } : x)
    } catch (err) {
      // 409: el servicio todavía la acepta. 502: no se pudo preguntar. En los
      // dos casos el aviso sigue en rojo, con el motivo.
      setErrorRevocada(mensajeDe(err, 'No se pudo comprobar.'))
    } finally {
      try { await releer() } catch { /* se queda lo que había */ }
      onCambiado?.()
      setRevocando(false)
    }
  }

  // --- Configuración manual: solo el secreto del webhook --------------------
  async function guardarSecreto(e: React.FormEvent) {
    e.preventDefault()
    const s = secreto.trim()

    if (s.startsWith('fac_')) {
      mensaje.error('Esa es la clave del servicio, no el secreto del webhook. El secreto empieza por whsec_.')
      return
    }
    if (!s.startsWith('whsec_')) {
      mensaje.error('El secreto del webhook empieza por whsec_. Cópialo entero del panel del servicio.')
      return
    }

    setGuardandoSecreto(true)
    try {
      const r = await credencialesServicio.guardarSecretoWebhook(empresa.id, s)
      mensaje.bien(r.mensaje)
      setSecreto('')
      await releer()
    } catch (err) {
      mensaje.error(mensajeDe(err, 'No se pudo guardar el secreto.'))
    } finally {
      setGuardandoSecreto(false)
    }
  }

  const c = estado?.credencial
  const w = estado?.webhook
  const aviso = w?.ultimoAviso
  const cert = estado?.certificado ?? undefined
  const em = estado?.emisor ?? undefined
  const listo = em?.listo ?? undefined
  const pendientes = estado?.claveAnterior.pendientes ?? []
  const comprobada = estado?.claveAnterior.ultimaComprobada ?? undefined

  // Si el último fallo es más reciente que la última llamada, algo está roto
  // ahora mismo. Es la pregunta que trae a alguien a esta pantalla.
  const fallando = !!c?.ultimoFalloEn &&
    (c.ultimaLlamadaEn === null || new Date(c.ultimoFalloEn) >= new Date(c.ultimaLlamadaEn))

  const avisos: AvisoFacturacion[] = estado?.avisos ?? []

  return (
    <Dialogo
      titulo={`Facturación de ${empresa.nombre}`}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cerrar</Boton>
          {estado?.configurada && (
            <Boton
              onClick={() => void probar()}
              ocupado={probando}
              textoOcupado="Preguntando…"
            >
              Volver a preguntar al servicio
            </Boton>
          )}
        </>
      }
    >
      {cargando ? <Cargando /> : (
        <>
          {errorCarga && <Aviso>{errorCarga}</Aviso>}

          {/* --- EL ROJO: una clave anterior que puede seguir valiendo ------- */}
          {(pendientes.length > 0 || avisoAnterior) && !rotacion && (
            <Aviso>
              <strong>La clave anterior SIGUE VALIENDO</strong>
              {pendientes.length > 0 && (
                <> (····{pendientes.map(p => p.pista ?? '????').join(', ····')})</>
              )}
              . Si rotaste porque se filtró, pulsa «Revocar la clave anterior»: la plataforma
              la da de baja en el servicio, comprueba que ya no vale y vacía la copia guardada.
              No se puede deshacer.
              {errorRevocada && <div><strong>{errorRevocada}</strong></div>}
              <div className="acciones-linea">
                <Boton estilo="secundario" onClick={() => void yaLaRevoque()}
                       ocupado={revocando} textoOcupado="Revocando en el servicio…">
                  Revocar la clave anterior
                </Boton>
              </div>
            </Aviso>
          )}

          {pendientes.length === 0 && comprobada && (
            <p className="nota">
              Clave anterior ····{comprobada.pista ?? '????'}: {comprobada.comprobacion}
              {' · '}{fechaYHora(comprobada.comprobadaEn)}
              {comprobada.por && <> · {comprobada.por}</>}
            </p>
          )}

          {/* --- Los ámbar: lo que el servicio dice que falta --------------- */}
          {avisos.map(a => (
            <Aviso key={a.codigo} tono={a.nivel === 'rojo' ? undefined : 'ojo'}>
              <strong>{a.texto}</strong>
              {a.detalle && <div>{a.detalle}</div>}
            </Aviso>
          ))}

          {/* --- El resultado de «Volver a preguntar» ----------------------- */}
          {prueba && (
            prueba.ok && prueba.rucCoincide ? (
              <Aviso tono="bien">{prueba.mensaje}</Aviso>
            ) : prueba.ok ? (
              /* Conecta, pero es la clave de otro cliente. Es el fallo más caro
                 de esta pantalla y por eso sale en rojo. */
              <Aviso>
                <strong>La clave es de otra empresa.</strong> {prueba.mensaje}
              </Aviso>
            ) : (
              <Aviso>
                {prueba.error}
                {prueba.pista && <div>{prueba.pista}</div>}
                {prueba.detalle && <div className="secundario mono detalle">{prueba.detalle}</div>}
              </Aviso>
            )
          )}

          {!estado?.configurada && (
            <Aviso tono="ojo">
              Esta empresa no tiene clave del servicio. Las empresas nuevas la reciben
              solas en el alta; si esta se creó antes de ese cambio, conéctala abajo con
              su clave fac_ del panel del servicio.
            </Aviso>
          )}

          {/* --- Datos de la empresa: vienen del servicio -------------------- */}
          {estado?.empresa.conectada && (
            <>
              <h3 className="subtitulo">Datos de la empresa</h3>
              <dl className="datos">
                <div className="fila">
                  <dt>RUC</dt>
                  <dd>
                    <span className="mono">{estado.empresa.ruc}</span>
                    <div className="secundario">
                      Vienen del servicio
                      {estado.empresa.datosOficialesEn && <> · {fechaYHora(estado.empresa.datosOficialesEn)}</>}
                    </div>
                  </dd>
                </div>
                <div className="fila">
                  <dt>Razón social</dt>
                  <dd>{estado.empresa.razonSocial}</dd>
                </div>
                <div className="fila">
                  <dt>Ambiente</dt>
                  <dd>
                    <span className={estado.empresa.ambiente === 'produccion' ? 'estado bueno' : 'estado aviso'}>
                      {estado.empresa.ambiente === 'produccion' ? 'Producción' : 'Beta (pruebas)'}
                    </span>
                    {estado.empresa.ambiente !== 'produccion' && (
                      <div className="secundario">
                        Para pasar a producción: emite la clave de producción en el panel del
                        servicio y conéctala abajo con «Comprobar → Conectar».
                      </div>
                    )}
                  </dd>
                </div>
                {em?.alta?.estado && (
                  <div className="fila">
                    <dt>Alta en el servicio</dt>
                    <dd>
                      {em.alta.estado === 'confirmada' ? (
                        <span className="estado bueno">Confirmada</span>
                      ) : em.alta.estado === 'sin_confirmar' ? (
                        <>
                          <span className="estado aviso">Sin confirmar</span>
                          <div className="secundario">
                            Desde {em.alta.creadoEn ? fechaYHora(em.alta.creadoEn) : '¿?'}. Se
                            confirma sola al volver a preguntar al servicio.
                          </div>
                        </>
                      ) : (
                        <span className="estado malo">{em.alta.estado}</span>
                      )}
                    </dd>
                  </div>
                )}
                {em?.direccion?.direccion && (
                  <div className="fila">
                    <dt>Dirección fiscal</dt>
                    <dd>
                      {em.direccion.direccion}
                      <div className="secundario">
                        {[em.direccion.distrito, em.direccion.provincia, em.direccion.departamento]
                          .filter(Boolean).join(' · ')}
                        {em.direccion.ubigeo && <> · ubigeo {em.direccion.ubigeo}</>}
                      </div>
                      <div className="secundario">Se corrige en el panel del servicio (pestaña Marca).</div>
                    </dd>
                  </div>
                )}
              </dl>
            </>
          )}

          {/* --- Lo que falta para emitir ----------------------------------- */}
          {listo && (
            <>
              <h3 className="subtitulo">
                {listo.paraEmitir ? 'Lista para emitir' : 'Lo que falta para emitir'}
              </h3>
              <dl className="datos">
                <Requisito listo={listo.direccion} titulo="Dirección revisada" />
                <Requisito listo={listo.certificado} titulo="Certificado digital" />
                {/* EL SOL REAL SOLO SE EXIGE EN PRODUCCIÓN (11 de octubre): en beta
                    el servicio usa las credenciales de prueba de SUNAT. */}
                <Requisito listo={listo.sol} titulo="Usuario SOL secundario"
                           opcional={estado?.empresa.ambiente === 'produccion' ? undefined : 'Para producción'}
                           detalle={listo.sol ? undefined
                             : estado?.empresa.ambiente === 'produccion'
                               ? 'MODDATOS no cuenta: es el de pruebas de SUNAT.'
                               : 'En beta no hace falta: se usan las credenciales de prueba de SUNAT. Se exige al pasar a producción.'} />
                <Requisito listo={(listo.series?.length ?? 0) > 0} titulo="Series"
                           detalle={listo.series?.length ? listo.series.join(', ') : undefined} />
                <Requisito listo={em?.portal?.correosAlReceptor} titulo="Correo al receptor"
                           detalle={em?.portal?.correosAlReceptor
                             ? undefined
                             : 'Identificador y correo de respuesta, en la pestaña Marca. No impide emitir.'} />
              </dl>
              {!listo.paraEmitir && (
                <p className="nota">
                  Todo esto se carga en el panel del servicio. Cuando esté, pulsa «Volver a
                  preguntar al servicio» y activa Facturación desde «Módulos».
                  {estado?.emisorEn && <> Última respuesta: {fechaYHora(estado.emisorEn)}.</>}
                </p>
              )}
            </>
          )}

          {/* --- La conexión ------------------------------------------------ */}
          {c && (
            <>
              <h3 className="subtitulo">Conexión</h3>
              <dl className="datos">
                <div className="fila">
                  <dt>Clave</dt>
                  <dd>
                    <span className="mono">····{c.pista ?? '????'}</span>
                    <div className="secundario">
                      Guardada cifrada. No se puede volver a ver entera.
                      {estado?.alta?.creadaPorAlta && ' La creó el alta de esta empresa.'}
                    </div>
                  </dd>
                </div>

                <div className="fila">
                  <dt>Estado</dt>
                  <dd>
                    {fallando ? (
                      <>
                        <span className="estado malo">Fallando</span>
                        <div className="secundario">{c.ultimoFallo} · {fechaYHora(c.ultimoFalloEn)}</div>
                      </>
                    ) : c.ultimaLlamadaEn ? (
                      <>
                        <span className="estado bueno">Funcionando</span>
                        <div className="secundario">Última llamada: {fechaYHora(c.ultimaLlamadaEn)}</div>
                      </>
                    ) : (
                      <span className="estado aviso">Sin usar todavía</span>
                    )}
                  </dd>
                </div>

                <div className="fila">
                  <dt>Certificado digital</dt>
                  <dd>
                    {!cert?.consultadoEn ? (
                      <span className="estado aviso">Sin consultar todavía</span>
                    ) : !cert.validoHasta || cert.diasParaVencer === null ? (
                      <>
                        <span className="estado malo">Sin certificado activo</span>
                        <div className="secundario">Cárgalo en el panel del servicio: sin él no puede emitir.</div>
                      </>
                    ) : cert.diasParaVencer < 0 ? (
                      <>
                        <span className="estado malo">Vencido</span>
                        <div className="secundario">Venció el {fechaCorta(cert.validoHasta)}.</div>
                      </>
                    ) : (
                      <>
                        <span className={
                          cert.diasParaVencer <= DIAS_URGENTE ? 'estado malo'
                            : cert.diasParaVencer <= DIAS_DE_AVISO ? 'estado aviso'
                            : 'estado bueno'
                        }>
                          {cert.diasParaVencer <= DIAS_DE_AVISO ? 'Por vencer' : 'Vigente'}
                        </span>
                        <div className="secundario">
                          Hasta el {fechaCorta(cert.validoHasta)} · {textoDias(cert.diasParaVencer)}
                        </div>
                      </>
                    )}
                  </dd>
                </div>

                {w && (
                  <div className="fila">
                    <dt>Respuestas de SUNAT</dt>
                    <dd>
                      {w.apuntaAqui === false ? (
                        <>
                          <span className="estado malo">Van a otra dirección</span>
                          <div className="secundario mono">{w.urlServicio ?? '(ningún webhook de la API)'}</div>
                          <div className="secundario">Pulsa «Conectar» otra vez con la clave para arreglarlo.</div>
                        </>
                      ) : !w.configurado ? (
                        <span className="estado malo">Sin secreto: se rechazan</span>
                      ) : !aviso ? (
                        <span className="estado aviso">Ningún aviso todavía</span>
                      ) : !aviso.firmaValida ? (
                        <>
                          <span className="estado malo">Rechazado</span>
                          <div className="secundario">
                            {fechaYHora(aviso.recibidoEn)} · La firma no cuadra con el secreto guardado.
                            Pulsa «Conectar» otra vez con la clave.
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="estado bueno">Llegan</span>
                          <div className="secundario">Último aviso: {fechaYHora(aviso.recibidoEn)}</div>
                        </>
                      )}
                    </dd>
                  </div>
                )}

                {c.rotadaEn && (
                  <div className="fila">
                    <dt>Última rotación</dt>
                    <dd className="secundario">{fechaYHora(c.rotadaEn)}</dd>
                  </div>
                )}
              </dl>
            </>
          )}

          {/* --- Comprobar → Conectar --------------------------------------- */}
          <form id="comprobar" onSubmit={comprobar}>
            <h3 className="subtitulo">
              {estado?.configurada ? 'Rotar la clave o pasar a producción' : 'Conectar con su clave'}
            </h3>

            <Campo
              etiqueta="Dirección del servicio"
              value={url}
              onChange={e => { setUrl(e.target.value); setComprobacion(undefined) }}
              pista="Con https:// delante. En desarrollo suele ser https://localhost:7295"
            />

            <Campo
              etiqueta="Clave nueva del servicio"
              type="password"
              value={clave}
              onChange={e => { setClave(e.target.value); setComprobacion(undefined) }}
              autoComplete="off"
              pista="Emítela en el panel del servicio (Claves de acceso de esta empresa). Empieza por fac_. No se guarda hasta que pulses «Conectar»."
            />

            {errorConexion && <Aviso>{errorConexion}</Aviso>}

            {comprobacion && (
              comprobacion.puedeConectar ? (
                <Aviso tono="ojo">
                  Esta clave es de <strong>{comprobacion.emisor.ruc} · {comprobacion.emisor.razonSocial}</strong>
                  {' · '}ambiente <strong>{comprobacion.emisor.ambiente}</strong>
                  {comprobacion.emisor.certificadoValidoHasta
                    ? <> · certificado hasta el <strong>{fechaCorta(comprobacion.emisor.certificadoValidoHasta)}</strong></>
                    : <> · <strong>sin certificado activo</strong></>}
                  . ¿Es esta empresa?
                  <div className="acciones-linea">
                    <Boton onClick={() => void conectar()} ocupado={conectando} textoOcupado="Conectando…">
                      {comprobacion.rotacion ? 'Sí, conectar con esta clave' : 'Sí, conectar'}
                    </Boton>
                  </div>
                </Aviso>
              ) : (
                <Aviso>
                  <strong>No se puede conectar con esta clave.</strong> {comprobacion.problema}
                </Aviso>
              )
            )}

            {rotacion && (rotacion.ok ? (
              <Aviso tono="bien">{rotacion.texto}</Aviso>
            ) : (
              <Aviso>
                <strong>{rotacion.texto}</strong>
                {errorRevocada && <div>{errorRevocada}</div>}
                <div className="acciones-linea">
                  <Boton estilo="secundario" onClick={() => void yaLaRevoque()}
                         ocupado={revocando} textoOcupado="Revocando en el servicio…">
                    Revocar la clave anterior
                  </Boton>
                </div>
              </Aviso>
            ))}

            <div className="acciones-linea">
              <Boton type="submit" form="comprobar" estilo="secundario"
                     ocupado={comprobando} textoOcupado="Comprobando…">
                Comprobar
              </Boton>
            </div>

            {estado?.configurada && (
              <p className="nota">
                «Comprobar» no guarda nada. «Conectar» registra el webhook en el servicio,
                guarda la clave nueva y <strong>revoca la anterior</strong> (comprueba que ya no
                vale). Conectar otra vez con la misma clave no es una rotación.
              </p>
            )}
          </form>

          {/* --- Configuración manual: solo para emergencias ---------------- */}
          {estado?.configurada && w && (
            <details>
              <summary className="secundario">Configuración manual (solo emergencias)</summary>

              <p className="nota">
                Dirección del webhook: <span className="mono texto-largo">{w.url}</span>. Secreto guardado:{' '}
                {w.configurado ? <span className="mono">····{w.pista ?? '????'}</span> : 'ninguno'}.
                Lo normal es no tocar esto: «Conectar» registra el webhook y guarda el secreto solo.
              </p>

              <form id="webhook" onSubmit={guardarSecreto}>
                <Campo
                  etiqueta="Secreto del webhook"
                  type="password"
                  value={secreto}
                  onChange={e => setSecreto(e.target.value)}
                  autoComplete="off"
                  pista="El que enseña el servicio UNA sola vez al registrar el webhook a mano. Empieza por whsec_"
                />
                <div className="acciones-linea">
                  <Boton type="submit" form="webhook" estilo="secundario"
                         ocupado={guardandoSecreto} textoOcupado="Guardando…">
                    Guardar el secreto
                  </Boton>
                </div>
              </form>
            </details>
          )}
        </>
      )}
    </Dialogo>
  )
}