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
import { LineasEmitidas, type FilaDetalle } from '../componentes/DetalleLineas'
import { DialogoProducto } from '../componentes/DialogoProducto'
import { RechazoComprobante } from '../componentes/RechazoComprobante'
import { EstadoComprobante } from '../componentes/EstadoComprobante'
import { nombreDetraccion } from '../componentes/PagoYDetraccion'
import { PanelWhatsapp } from '../componentes/PanelWhatsapp'
import { documentosServicio, productosServicio } from '../servicios/facturacionServicio'
import { GuiasDelComprobante } from '../../guias/componentes/GuiasDelComprobante'
import '../comprobante.css'
import type { CatalogosSunat, DocumentoCompleto, ProductoEnLista } from '../tipos'

const TIPOS: Record<string, string> = { '01': 'Factura', '03': 'Boleta de venta', '07': 'Nota de crédito', '08': 'Nota de débito' }

// 22 oct: los motivos de nota de débito (catálogo 10). Chocan con los de crédito: se elige por tipo.
const MOTIVOS_DEBITO: Record<string, string> = {
  '01': 'Intereses por mora', '02': 'Aumento en el valor', '03': 'Penalidades u otros conceptos',
}

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
  // e165: el producto nuevo que sale de una línea libre.
  const [nuevoProducto, setNuevoProducto] = useState<Partial<ProductoEnLista>>()
  const [catalogosSunat, setCatalogosSunat] = useState<CatalogosSunat>()

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

  // 22 oct: recién emitido (viene de «Emitir»): si este equipo lo pide, se imprime solo.
  const [recienEmitido] = useState(() => !!(ubicacion.state as { reciente?: string } | null)?.reciente)

  // 043: recién emitido y marcado «por WhatsApp»: se intenta abrir solo.
  const [abrirWhatsapp] = useState(() => !!(ubicacion.state as { abrirWhatsapp?: boolean } | null)?.abrirWhatsapp)

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
  const esNota = d.tipo === '07' || d.tipo === '08'
  const motivos = d.tipo === '08' ? MOTIVOS_DEBITO : MOTIVOS_NOTA
  const notasDebito = d.notasDebito ?? []
  // 22 oct: NOTA DE DÉBITO, sobre una factura o boleta aceptada (mismo permiso que la de crédito).
  const notas = d.notasCredito ?? []
  const saldo = d.saldo ?? d.totales.importeTotal
  // 23 oct: REGLAS DE SUNAT. Con notas (de crédito O de débito) ya no hay baja;
  // con la baja pedida y sin respuesta, no hay notas; con saldo 0, ninguna nota.
  const bajaPedida = d.bajaPedidaEn ?? null
  const conNotas = (d.notasVigentes ?? 0) > 0 || notas.some(n => n.cuenta)
  const puedeDebito = aceptado && (d.tipo === '01' || d.tipo === '03') && saldo > 0 && !bajaPedida &&
    puede(Permisos.Facturacion.NotasCredito)
  const puedeNota = aceptado && (d.tipo === '01' || d.tipo === '03') && saldo > 0 && !bajaPedida &&
    puede(Permisos.Facturacion.NotasCredito)

  // Una factura con notas ya no se da de baja: se sigue con notas.
  const anulable = aceptado && (d.tipo === '01' || d.tipo === '03' || esNota) && !conNotas && !bajaPedida &&
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
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo reenviar la nota.')
    } finally { setOcupado(false) }
  }

  // e165: «Agregar a mis productos» desde una línea libre ya emitida. Lo emitido
  // no cambia: solo se crea el producto para la próxima vez.
  async function agregarAlCatalogo(f: FilaDetalle) {
    try {
      const [cat, sig] = await Promise.all([catalogosSunat ?? productosServicio.catalogos(), productosServicio.siguienteCodigo()])
      setCatalogosSunat(cat)
      const gravado = f.tipoAfectacion === '10'
      const conIgv = f.precioConIgv ?? f.valorUnitario
      const redondo = gravado && Math.abs(Math.round(conIgv * 100) / 100 - conIgv) < 0.000001
      setNuevoProducto({
        codigo: sig.codigo, descripcion: f.descripcion, unidadMedida: f.unidad, tipoAfectacion: f.tipoAfectacion ?? '10',
        precioUnitario: redondo ? conIgv : f.valorUnitario, incluyeIgv: redondo, controlaStock: false,
      })
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo preparar el producto.')
    }
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
      <div className="encabezado-pagina vc-encabezado">
        <div>
          <p className="vc-tipo">{TIPOS[d.tipo] ?? d.tipo}</p>
          <h1 className="titulo-pagina">
            {d.numero}
            {d.ambiente === 'beta' && <> <span className="etiqueta aviso" title="Emitido en SUNAT beta: sin valor legal">prueba</span></>}
          </h1>
          <p className="vc-resumen">
            <EstadoComprobante estado={d.estado} />
            {d.cliente && <span>{d.cliente.razonSocial}</span>}
            <span>{fecha(d.fechaEmision)}</span>
            <strong className="mono">{d.moneda} {d.totales.importeTotal.toFixed(2)}</strong>
          </p>
        </div>
        <Boton estilo="secundario" onClick={() => navegar('/facturacion/comprobantes')}>
          Volver
        </Boton>
      </div>

      {error && <Aviso>{error}</Aviso>}

      <div className="vc-cuerpo">
        <div className="vc-principal">
          {/* --- Estado -------------------------------------------------------- */}
          <div className="bloque">
            <h2 className="subtitulo">Estado</h2>

            <EstadoComprobante estado={d.estado} conAyuda />
            {conNotas && (
              <p><span className="etiqueta aviso">{saldo <= 0 ? 'Anulado con nota de crédito' : 'Con nota de crédito'}</span></p>
            )}

            {/* e166: el rechazo, en palabras: qué dato, en qué línea y cómo corregirlo. */}
            {d.estado === 'rechazado' ? (
              <Aviso>
                <div className="fila-aviso">
                  <RechazoComprobante codigo={d.codigoSunat} mensaje={d.mensajeSunat} lineas={d.lineas}
                    nota={d.tipo === '01' || d.tipo === '03'
                      ? 'El rechazado gastó su número y no se edita: «Corregir y emitir otro» lo copia a uno nuevo, corriges ese dato y emites.'
                      : 'La nota rechazada no se edita: hazla de nuevo desde el comprobante que modifica, con ese dato corregido.'} />
                  {(d.tipo === '01' || d.tipo === '03') && puede(Permisos.Facturacion.Emitir) && (
                    <Boton onClick={() => navegar(`/facturacion/comprobantes/nuevo?copiar=${d.id}`)}>
                      Corregir y emitir otro
                    </Boton>
                  )}
                </div>
              </Aviso>
            ) : d.mensajeSunat && (
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

            {/* 23 oct: la baja / anulación ya pedida, esperando a SUNAT. */}
            {bajaPedida && (
              <Aviso tono="ojo">
                <strong>Se pidió {textoAnular === 'Anular' ? 'la anulación' : 'la baja'} el {fechaYHora(bajaPedida)}.</strong>{' '}
                Esperando la respuesta de SUNAT: mientras tanto no se pueden hacer notas. Si SUNAT la acepta, pasa a «anulado».
              </Aviso>
            )}

            {aceptado && dias > 7 && (d.tipo === '01' || d.tipo === '03') && !conNotas && !bajaPedida && (
              <Aviso tono="ojo">
                <strong>Ya pasaron los 7 días para «{textoAnular}».</strong> Para anularlo o corregirlo, haz una
                <strong> nota de crédito</strong>: es el camino que SUNAT acepta, sin plazo.
              </Aviso>
            )}
            {anulable && esNota && dias > 7 && (
              <p className="nota">Pasaron más de 7 días: esta nota de crédito ya no se puede dar de baja.</p>
            )}
          </div>

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
                    {motivos[d.tipoNota ?? ''] ?? d.tipoNota}
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

          {/* --- Líneas: e163, con búsqueda, de 10 en 10 y el ojo con todas ------ */}
          <LineasEmitidas moneda={d.moneda} filas={d.lineas.map(l => ({
            numero: l.numero, codigo: l.codigo, descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidadMedida,
            valorUnitario: l.valorUnitario, descuento: l.descuento, valorVenta: l.valorVenta, igv: l.igv, total: l.importeTotal,
            libre: !l.productoId, tipoAfectacion: l.tipoAfectacion, precioConIgv: l.precioUnitario,
          }))} onAgregar={puede(Permisos.Facturacion.ProductosGestionar) && !esNota ? f => void agregarAlCatalogo(f) : undefined} />

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

          {/* --- 050: sus guías de remisión y «Hacer guía» ------------------------ */}
          <GuiasDelComprobante documentoId={d.id} tipo={d.tipo} estado={d.estado} />

          {/* 052: lo que hizo el inventario con este comprobante. */}
          {d.inventario && (
            <div className="bloque">
              <h2 className="subtitulo">Inventario</h2>
              {d.inventario.modo === 'reserva' ? (
                <>
                  <p className="parrafo">
                    {d.inventario.aplicado ? 'Reservado' : 'Ya no reserva'} en <strong>{d.inventario.sucursal}</strong>: «se entrega después (con guía)».
                    La mercadería sale del almacén con cada guía de remisión.
                  </p>
                  <table className="tabla">
                    <thead><tr><th>Producto</th><th>Reservado</th><th>Salió con guía</th><th>Liberado</th><th>Falta despachar</th></tr></thead>
                    <tbody>
                      {d.inventario.reservas.map(r => (
                        <tr key={r.productoId}>
                          <td>{r.descripcion}</td>
                          <td className="mono">{r.reservada.toLocaleString('es-PE')}</td>
                          <td className="mono">{r.despachada.toLocaleString('es-PE')}</td>
                          <td className="mono">{r.liberada.toLocaleString('es-PE')}</td>
                          <td className="mono"><strong>{r.pendiente.toLocaleString('es-PE')}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : d.inventario.modo === 'nota' ? (
                <p className="parrafo">{d.inventario.aplicado ? 'La mercadería devuelta entró' : 'La devolución se aplica cuando SUNAT acepte la nota'} en <strong>{d.inventario.sucursal}</strong>.</p>
              ) : (
                <p className="parrafo">{d.inventario.aplicado ? 'Salió del stock de' : 'Ya no descuenta de'} <strong>{d.inventario.sucursal}</strong> (venta directa).</p>
              )}
            </div>
          )}

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

          {/* --- 22 oct: sus notas de débito --------------------------------------- */}
          {notasDebito.length > 0 && (
            <div className="bloque">
              <h2 className="subtitulo">Notas de débito</h2>
              <table className="tabla">
                <thead>
                  <tr><th>Nota</th><th>Motivo</th><th>Fecha</th><th className="derecha">Monto</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {notasDebito.map(n => (
                    <tr key={n.id}>
                      <td className="mono">
                        <Boton estilo="plano" onClick={() => navegar(`/facturacion/comprobantes/${n.id}`)}>{n.numero}</Boton>
                      </td>
                      <td>{MOTIVOS_DEBITO[n.tipoNota ?? ''] ?? n.tipoNota}</td>
                      <td className="secundario">{fecha(n.fechaEmision)}</td>
                      <td className="derecha mono">+ {n.importeTotal.toFixed(2)}</td>
                      <td><EstadoComprobante estado={n.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
        </div>

        <aside className="vc-lado">
          {/* e162: LAS ACCIONES, en su tarjeta y una debajo de otra. */}
          {(puedeNota || puedeDebito || (anulable && dias <= 7)) && (
            <div className="bloque vc-tarjeta">
              <h2 className="subtitulo">Acciones</h2>
              <div className="vc-botones">
                {puedeNota && (
                  <Boton onClick={() => navegar(`/facturacion/comprobantes/${d.id}/nota-credito`)}>
                    Hacer nota de crédito
                  </Boton>
                )}
                {puedeDebito && (
                  <Boton estilo="secundario" onClick={() => navegar(`/facturacion/comprobantes/${d.id}/nota-debito`)}>
                    Hacer nota de débito
                  </Boton>
                )}
                {anulable && dias <= 7 && (
                  <Boton estilo="secundario" onClick={() => abrir('anular')}>{textoAnular}</Boton>
                )}
              </div>
              <ul className="vc-explica">
                {puedeNota && <li><strong>Nota de crédito:</strong> sirve siempre, también para devoluciones y descuentos.</li>}
                {puedeDebito && <li><strong>Nota de débito:</strong> para cobrar de más (intereses, penalidades, un error a favor).</li>}
                {anulable && dias <= 7 && <li><strong>{textoAnular}:</strong> solo si hubo un error o la venta no se concretó. Quedan {7 - dias} día(s).</li>}
              </ul>
            </div>
          )}
          {/* --- Archivos: XML, CDR y PDF, los que existan ---------------------- */}
          <ArchivosComprobante d={d} recienEmitido={recienEmitido} />

          {/* --- 043: WhatsApp ----------------------------------------------------- */}
          <PanelWhatsapp d={d} autoAbrir={abrirWhatsapp} onCambio={cargar} />
        </aside>
      </div>

      {nuevoProducto && catalogosSunat && (
        <DialogoProducto inicial={nuevoProducto} catalogos={catalogosSunat}
                         onCerrar={() => setNuevoProducto(undefined)}
                         onGuardado={m => { setNuevoProducto(undefined); mensaje.bien(m) }} />
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

    </>
  )
}
