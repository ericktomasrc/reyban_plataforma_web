import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha, fechaYHora } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { ArchivosComprobante } from '../componentes/ArchivosComprobante'
import { EstadoComprobante } from '../componentes/EstadoComprobante'
import { nombreDetraccion } from '../componentes/PagoYDetraccion'
import { documentosServicio } from '../servicios/facturacionServicio'
import type { DocumentoCompleto } from '../tipos'

const TIPOS: Record<string, string> = { '01': 'Factura', '03': 'Boleta de venta', '07': 'Nota de crédito' }

// 031: los motivos de nota de crédito (catálogo 09) en palabras.
const MOTIVOS_NOTA: Record<string, string> = {
  '01': 'Anulación de la operación', '02': 'Anulación por error en el RUC',
  '04': 'Descuento global', '05': 'Descuento por ítem', '06': 'Devolución total',
  '07': 'Devolución por ítem', '09': 'Disminución en el valor',
}

// LOS NOMBRES DE LOS DATOS EXTRA, para personas. La clave es la que se guarda
// en `datos_extra` y no se toca; aquí solo se traduce para enseñarla. Una
// clave que no esté en la lista sale tal cual: mejor eso que esconderla.
const NOMBRES_EXTRA: Record<string, string> = {
  ordenCompra: 'Orden de compra',
}

/**
 * Un comprobante ya emitido.
 *
 * LO QUE ESTA PANTALLA ENSEÑA Y OTRAS NO: el historial. Cada cambio de estado
 * con su hora y de dónde vino —de una persona, del webhook del servicio, de una
 * consulta manual—. Es lo que contesta «¿cuándo se aceptó esto?» y «¿quién lo
 * anuló?» sin abrir un log.
 *
 * Lo escribe un disparador de la base, no el código, y es de solo inserción.
 */
export function VerComprobante() {
  const { id } = useParams()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const mensaje = useMensaje()

  const [d, setD] = useState<DocumentoCompleto>()
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string>()

  // 18 oct: anular (con los nombres de SUNAT) y ajustar la serie (error 1033).
  const { puede } = useSesion()
  const [ventana, setVentana] = useState<'anular' | 'ajustar' | null>(null)
  const [motivo, setMotivo] = useState('')
  const [ultimo, setUltimo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [falloVentana, setFalloVentana] = useState<string | null>(null)

  // EL MENSAJE QUE DEJÓ LA PANTALLA DE EMISIÓN al navegar hasta aquí. Se
  // enseña en ventana porque es la respuesta a «Emitir», el botón más serio de
  // la aplicación, y no puede pasar desapercibido.
  //
  // `replace` borra el estado de la navegación en cuanto se ha leído: sin eso,
  // recargar la página o volver atrás y adelante volvería a anunciar una
  // emisión que ya se leyó hace media hora.
  //
  // Y LA BANDERITA no es paranoia: en desarrollo React monta cada pantalla dos
  // veces a propósito, así que sin ella la emisión se anunciaría dos veces.
  const anunciado = useRef(false)

  useEffect(() => {
    const reciente = (ubicacion.state as { reciente?: string } | null)?.reciente
    if (!reciente || anunciado.current) return

    anunciado.current = true
    mensaje.bien(reciente)
    navegar(ubicacion.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargar() {
    if (!id) return
    try {
      setD(await documentosServicio.ver(id))
      setError(undefined)
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el comprobante.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { void cargar() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Mientras está en camino, se refresca sola. Se para en cuanto SUNAT
  // contesta: seguir preguntando para siempre gasta por nada.
  useEffect(() => {
    if (d?.estado !== 'encolado') return
    const t = setInterval(() => { void cargar() }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.estado, id])

  if (cargando) return <Cargando />
  if (!d) return <Aviso>{error ?? 'No se encuentra el comprobante.'}</Aviso>

  // 18 oct: ANULAR. Un comprobante correcto no se toca; esto es para un error,
  // una venta que no se concretó o una prueba en SUNAT real. Plazo: 7 días.
  const hoyLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  const dias = Math.round((Date.parse(hoyLima) - Date.parse(d.fechaEmision)) / 86_400_000)
  const aceptado = d.estado === 'aceptado' || d.estado === 'observado'
  const serie = d.serie ?? ''

  // 031: NOTAS DE CRÉDITO. Las suyas (si es factura o boleta) y lo que queda.
  const esNota = d.tipo === '07'
  const notas = d.notasCredito ?? []
  const saldo = d.saldo ?? d.totales.importeTotal
  const conNotas = notas.some(n => n.cuenta)
  const puedeNota = aceptado && (d.tipo === '01' || d.tipo === '03') && saldo > 0 &&
    puede(Permisos.Facturacion.NotasCredito)

  // Una factura con notas ya no se da de baja: se sigue con notas.
  const anulable = aceptado && (d.tipo === '01' || d.tipo === '03' || esNota) && !conNotas &&
    puede(Permisos.Facturacion.Anular)
  const textoAnular = d.tipo === '01' || (esNota && serie.startsWith('F')) ? 'Comunicar baja' : 'Anular'
  const numero1033 = ['1033', '01033'].includes(d.codigoSunat ?? '')

  const reintentarNota = async () => {
    setOcupado(true)
    try {
      const r = await documentosServicio.emitir(d.id)
      mensaje.bien(r.mensaje)
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo reenviar la nota de crédito.')
    } finally { setOcupado(false) }
  }

  const abrir = (v: 'anular' | 'ajustar') => {
    setFalloVentana(null)
    setMotivo(v === 'ajustar' ? 'SUNAT respondió 1033: ese número ya existía.' : '')
    setUltimo(v === 'ajustar' && d.correlativo ? String(d.correlativo) : '')
    setVentana(v)
  }

  const anular = async () => {
    setOcupado(true); setFalloVentana(null)
    try {
      const r = await documentosServicio.anular(d.id, motivo.trim())
      mensaje.bien(r.mensaje)
      setVentana(null)
      await cargar()
    } catch (e) {
      setFalloVentana(e instanceof ErrorApi ? e.message : 'No se pudo pedir la anulación.')
    } finally { setOcupado(false) }
  }

  const ajustar = async () => {
    setOcupado(true); setFalloVentana(null)
    try {
      const r = await documentosServicio.ajustarSerie(d.tipo, serie, Number(ultimo), motivo.trim())
      mensaje.bien(r.mensaje)
      setVentana(null)
    } catch (e) {
      setFalloVentana(e instanceof ErrorApi ? e.message : 'No se pudo ajustar la serie.')
    } finally { setOcupado(false) }
  }

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">
          {d.numero}
          {d.ambiente === 'beta' && <> <span className="etiqueta aviso" title="Emitido en SUNAT beta: sin valor legal">prueba</span></>}
        </h1>
        <Boton estilo="secundario" onClick={() => navegar('/facturacion/comprobantes')}>
          Volver
        </Boton>
      </div>

      {error && <Aviso>{error}</Aviso>}

      {/* --- Estado -------------------------------------------------------- */}
      <div className="bloque">
        <h2 className="subtitulo">Estado</h2>

        <EstadoComprobante estado={d.estado} conAyuda />
        {conNotas && (
          <p><span className="etiqueta aviso">{saldo <= 0 ? 'Anulado con nota de crédito' : 'Con nota de crédito'}</span></p>
        )}

        {d.mensajeSunat && (
          <p className="nota">
            {d.codigoSunat && <strong>[{d.codigoSunat}] </strong>}
            {d.mensajeSunat}
          </p>
        )}

        {d.observaciones && d.observaciones.length > 0 && (
          <ul className="lista-observaciones">
            {d.observaciones.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        )}

        {d.estado === 'error' && d.sePuedeEditar && (
          <div className="acciones-linea">
            {esNota ? (
              <Boton onClick={() => void reintentarNota()} ocupado={ocupado} textoOcupado="Enviando…">
                Reintentar
              </Boton>
            ) : (
              <Boton onClick={() => navegar(`/facturacion/comprobantes/${d.id}/editar`)}>
                Reintentar
              </Boton>
            )}
          </div>
        )}

        {/* 18 OCT: el 1033 en palabras simples. */}
        {numero1033 && (
          <Aviso>
            <strong>Ese número ya existe en SUNAT.</strong> SUNAT ya tiene un {d.numero} emitido antes
            (código 1033), así que este no vale. No se duplicó nada. Revisa cuál fue el
            <strong> último número que realmente emitiste</strong> en la serie {serie} (por ejemplo, en tu
            consulta de SUNAT SOL) y ajústalo: el siguiente comprobante saldrá con el número que sigue.
            {puede(Permisos.Facturacion.CredencialesGestionar) && serie && (
              <div className="acciones-linea">
                <Boton onClick={() => abrir('ajustar')}>Ajustar la serie {serie}</Boton>
              </div>
            )}
          </Aviso>
        )}

        {/* 18 OCT: ANULAR, con el nombre que usa SUNAT. */}
        {/* 031: NOTA DE CRÉDITO, sin plazo. Y dentro de los 7 días, también la baja. */}
        {(puedeNota || (anulable && dias <= 7)) && (
          <div className="acciones-linea">
            {puedeNota && (
              <Boton onClick={() => navegar(`/facturacion/comprobantes/${d.id}/nota-credito`)}>
                Hacer nota de crédito
              </Boton>
            )}
            {anulable && dias <= 7 && (
              <Boton estilo="secundario" onClick={() => abrir('anular')}>{textoAnular}</Boton>
            )}
            <span className="secundario">
              {anulable && dias <= 7
                ? `«${textoAnular}»: solo si hubo un error o la venta no se concretó; quedan ${7 - dias} día(s).`
                : ''}
              {puedeNota ? ' La nota de crédito sirve siempre, también para devoluciones y descuentos.' : ''}
            </span>
          </div>
        )}
        {aceptado && dias > 7 && (d.tipo === '01' || d.tipo === '03') && !conNotas && (
          <Aviso tono="ojo">
            <strong>Ya pasaron los 7 días para «{textoAnular}».</strong> Para anularlo o corregirlo, haz una
            <strong> nota de crédito</strong>: es el camino que SUNAT acepta, sin plazo.
          </Aviso>
        )}
        {anulable && esNota && dias > 7 && (
          <p className="nota">Pasaron más de 7 días: esta nota de crédito ya no se puede dar de baja.</p>
        )}
      </div>

      {/* --- 031: sus notas de crédito y lo que queda ------------------------ */}
      {notas.length > 0 && (
        <div className="bloque">
          <h2 className="subtitulo">Notas de crédito</h2>
          <table className="tabla">
            <thead>
              <tr><th>Nota</th><th>Motivo</th><th>Fecha</th><th className="derecha">Monto</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {notas.map(n => (
                <tr key={n.id}>
                  <td className="mono">
                    <Boton estilo="plano" onClick={() => navegar(`/facturacion/comprobantes/${n.id}`)}>{n.numero}</Boton>
                  </td>
                  <td>{MOTIVOS_NOTA[n.tipoNota ?? ''] ?? n.tipoNota}</td>
                  <td className="secundario">{fecha(n.fechaEmision)}</td>
                  <td className="derecha mono">{n.importeTotal.toFixed(2)}</td>
                  <td>
                    <EstadoComprobante estado={n.estado} />
                    {!n.cuenta && <div className="secundario">no resta: no vale ante SUNAT</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="nota">
            Queda: <strong className="mono">{d.moneda} {Math.max(0, saldo).toFixed(2)}</strong> de {d.moneda} {d.totales.importeTotal.toFixed(2)}.
          </p>
        </div>
      )}

      <Dialogo titulo={`${textoAnular} ${d.numero}`} abierto={ventana === 'anular'} onCerrar={() => setVentana(null)}
               acciones={<>
                 <Boton estilo="secundario" onClick={() => setVentana(null)} disabled={ocupado}>Cancelar</Boton>
                 <Boton onClick={() => void anular()} ocupado={ocupado} textoOcupado="Enviando…"
                        disabled={motivo.trim().length < 5}>{textoAnular}</Boton>
               </>}>
        <p>
          {d.tipo === '01'
            ? <>Se manda a SUNAT una <strong>comunicación de baja</strong>. Cuando la acepte, la factura queda anulada.</>
            : <>La boleta se informa como <strong>anulada</strong> en el resumen diario. Cuando SUNAT lo acepte, queda anulada.</>}
          {' '}Un comprobante bien emitido no se anula: esto es para un error, una venta que no se concretó o una prueba.
        </p>
        <label className="campo">
          <span className="etiqueta">Motivo (lo lee SUNAT)</span>
          <input value={motivo} maxLength={100} onChange={e => setMotivo(e.target.value)}
                 placeholder="Ej.: error en el monto, venta cancelada, prueba del sistema" />
        </label>
        {falloVentana && <Aviso>{falloVentana}</Aviso>}
      </Dialogo>

      <Dialogo titulo={`Ajustar la serie ${serie}`} abierto={ventana === 'ajustar'} onCerrar={() => setVentana(null)}
               acciones={<>
                 <Boton estilo="secundario" onClick={() => setVentana(null)} disabled={ocupado}>Cancelar</Boton>
                 <Boton onClick={() => void ajustar()} ocupado={ocupado} textoOcupado="Ajustando…"
                        disabled={!(Number(ultimo) >= 1) || motivo.trim().length < 5}>Ajustar</Boton>
               </>}>
        <p>Escribe el <strong>último número que realmente emitiste</strong> con la serie {serie}. Solo se puede subir: bajar volvería a dar números que ya existen en SUNAT.</p>
        <label className="campo">
          <span className="etiqueta">Último número emitido</span>
          <input className="mono" inputMode="numeric" value={ultimo}
                 onChange={e => setUltimo(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="campo">
          <span className="etiqueta">Motivo</span>
          <input value={motivo} maxLength={200} onChange={e => setMotivo(e.target.value)} />
        </label>
        {falloVentana && <Aviso>{falloVentana}</Aviso>}
      </Dialogo>

      {/* --- Archivos: XML, CDR y PDF, los que existan ---------------------- */}
      <ArchivosComprobante d={d} />

      {/* --- Datos --------------------------------------------------------- */}
      <div className="bloque">
        <h2 className="subtitulo">{TIPOS[d.tipo] ?? d.tipo}</h2>

        <dl className="datos">
          <div className="fila">
            <dt>Cliente</dt>
            <dd>
              {d.cliente?.razonSocial}
              <div className="secundario mono">{d.cliente?.numeroDocumento}</div>
              {d.cliente?.direccion && (
                <div className="secundario">{d.cliente.direccion}</div>
              )}
            </dd>
          </div>

          <div className="fila">
            <dt>Fecha de emisión</dt>
            <dd className="secundario">{fecha(d.fechaEmision)}</dd>
          </div>

          {/* 031: una nota de crédito dice a qué comprobante afecta y por qué. */}
          {esNota && d.afecta && (
            <div className="fila">
              <dt>Modifica</dt>
              <dd>
                <Boton estilo="plano" onClick={() => navegar(`/facturacion/comprobantes/${d.afecta!.id}`)}>
                  {d.afecta.numero}
                </Boton>
              </dd>
            </div>
          )}
          {esNota && (
            <div className="fila">
              <dt>Motivo</dt>
              <dd className="secundario">
                {MOTIVOS_NOTA[d.tipoNota ?? ''] ?? d.tipoNota}
                {d.motivoNota && <div>{d.motivoNota}</div>}
              </dd>
            </div>
          )}

          {/* 040: forma de pago y detracción. */}
          {d.tipo === '01' && (
            <div className="fila">
              <dt>Forma de pago</dt>
              <dd className="secundario">
                {d.formaPago === 'credito' ? 'Al crédito' : 'Al contado'}
                {(d.cuotas ?? []).map(c => (
                  <div key={c.numero} className="mono">
                    Cuota {c.numero}: {d.moneda} {c.monto.toFixed(2)} · vence {fecha(c.vence)}
                  </div>
                ))}
              </dd>
            </div>
          )}
          {d.detraccion && (
            <div className="fila">
              <dt>Detracción</dt>
              <dd className="secundario">
                {nombreDetraccion(d.detraccion.codigo)} ({d.detraccion.codigo}) · {d.detraccion.porcentaje} %
                {d.detraccion.monto != null && <div className="mono">S/ {d.detraccion.monto.toFixed(2)}</div>}
                <div className="mono">Cuenta {d.detraccion.cuenta}</div>
              </dd>
            </div>
          )}

          {Object.entries(d.datosExtra ?? {}).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
            <div className="fila" key={k}>
              <dt>{NOMBRES_EXTRA[k] ?? k}</dt>
              <dd className="secundario">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* --- Líneas -------------------------------------------------------- */}
      <div className="bloque sin-relleno">
        <table className="tabla">
          <thead>
            <tr>
              <th>Descripción</th>
              <th className="derecha">Cantidad</th>
              <th className="derecha">Valor unitario</th>
              <th className="derecha">Importe</th>
            </tr>
          </thead>
          <tbody>
            {d.lineas.map(l => (
              <tr key={l.id ?? l.numero}>
                <td>
                  <div className="principal">{l.descripcion}</div>
                  {l.codigo && <div className="secundario mono">{l.codigo}</div>}
                </td>
                <td className="derecha mono">{l.cantidad} {l.unidadMedida}</td>
                <td className="derecha mono">{l.valorUnitario.toFixed(4)}</td>
                <td className="derecha mono">{l.valorVenta.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Totales ------------------------------------------------------- */}
      <div className="bloque">
        <dl className="datos totales">
          {d.totales.totalDescuentos > 0 && (
            <div className="fila">
              <dt>Descuentos</dt>
              <dd className="mono">−{d.totales.totalDescuentos.toFixed(2)}</dd>
            </div>
          )}
          <div className="fila">
            <dt>Gravado</dt>
            <dd className="mono">{d.totales.totalGravado.toFixed(2)}</dd>
          </div>
          <div className="fila">
            <dt>IGV</dt>
            <dd className="mono">{d.totales.totalIgv.toFixed(2)}</dd>
          </div>
          <div className="fila grande">
            <dt>Total</dt>
            <dd className="mono">{d.moneda} {d.totales.importeTotal.toFixed(2)}</dd>
          </div>
        </dl>

        {d.estado !== 'borrador' && (
          <p className="nota">
            Este importe es el que devolvió el servicio de facturación: el que se
            firmó y viajó a SUNAT.
          </p>
        )}
      </div>

      {/* --- Historial ----------------------------------------------------- */}
      <div className="bloque">
        <h2 className="subtitulo">Historial</h2>

        <ol className="linea-tiempo">
          {d.historial.map((h, i) => (
            <li key={i}>
              <div className="cuando">{fechaYHora(h.ocurridoEn)}</div>
              <div>
                <strong>{h.estadoNuevo}</strong>
                {h.estadoAnterior && <span className="secundario"> · desde {h.estadoAnterior}</span>}
                <div className="secundario">
                  {h.origen === 'webhook' ? 'Lo avisó el servicio de facturación'
                    : h.origen === 'usuario' ? 'Desde la plataforma'
                    : h.origen === 'consulta' ? 'Se consultó a SUNAT'
                    : 'Automático'}
                </div>
                {h.mensaje && <div className="secundario detalle">{h.mensaje}</div>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}
