import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { useEstadoInventario } from '../componentes/usoInventario'
import { inventarioServicio, type EstadoInventario, type ModoInventario } from '../servicios/inventarioServicio'
import '../inventario.css'

/**
 * 052 — CONFIGURACIÓN DEL INVENTARIO Y «EMPEZAR A CONTROLAR».
 *
 * Encender no bloquea nada: primero se carga el stock inicial de cada sucursal
 * y, cuando se elige «Empezar a controlar», desde ese momento no se emite lo
 * que no hay (si «Permitir vender sin stock» está apagado).
 *
 * e161: ENCENDER Y APAGAR SE GUARDA AL PULSAR. Antes era una casilla más del
 * formulario y había que pulsar «Guardar» abajo: se marcaba, no se guardaba,
 * y las demás pantallas seguían diciendo «Tu empresa todavía no lleva
 * inventario». Las opciones (modo, vender sin stock, avisos) siguen con su
 * «Guardar», y si se tocan sin guardar lo dice una barra.
 */
export function ConfiguracionInventario() {
  const [recargar, setRecargar] = useState(0)
  const { estado, error } = useEstadoInventario(recargar)
  if (error) return <Aviso>{error}</Aviso>
  if (!estado) return <Cargando />
  return <Configuracion key={recargar} estado={estado} onCambio={() => setRecargar(n => n + 1)} />
}

function Configuracion({ estado, onCambio }: { estado: EstadoInventario; onCambio: () => void }) {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const { puede } = useSesion()
  const editable = puede(Permisos.Inventario.Configurar)
  const [modo, setModo] = useState<ModoInventario>(estado.modo)
  const [sinStock, setSinStock] = useState(estado.permitirSinStock)
  const [avisar, setAvisar] = useState(estado.avisarMinimo)
  const [ocupado, setOcupado] = useState(false)

  const cambio = modo !== estado.modo || sinStock !== estado.permitirSinStock || avisar !== estado.avisarMinimo

  async function guardar() {
    setOcupado(true)
    try {
      const r = await inventarioServicio.configurar({ encendido: estado.encendido, modo, permitirSinStock: sinStock, avisarMinimo: avisar })
      mensaje.bien(r.mensaje); onCambio()
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.') }
    finally { setOcupado(false) }
  }

  /** Encender o apagar: se guarda en el acto. Apagar pregunta antes. */
  async function encender(si: boolean) {
    if (!si) {
      const seguro = await pedir({
        titulo: 'Apagar el inventario',
        confirmar: 'Apagar',
        tono: 'peligro',
        mensaje: (
          <>
            <p>La facturación sigue como siempre, pero deja de contarse el stock y de bloquearse lo que no hay.</p>
            <p><strong>No se borra nada:</strong> el kardex, los ingresos y el stock cargado se guardan. Si lo vuelves a encender, sigue donde estaba.</p>
          </>
        ),
      })
      if (!seguro) return
    }
    setOcupado(true)
    try {
      const r = await inventarioServicio.configurar({ encendido: si, modo: estado.modo, permitirSinStock: estado.permitirSinStock, avisarMinimo: estado.avisarMinimo })
      mensaje.bien(si ? 'Inventario encendido. Ahora revisa qué productos se cuentan y carga el stock inicial.' : r.mensaje)
      onCambio()
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cambiar.') }
    finally { setOcupado(false) }
  }

  async function controlar(ids: string[], si = true) {
    setOcupado(true)
    try {
      const r = await inventarioServicio.controlar(ids, si)
      mensaje.bien(r.mensaje); onCambio()
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo.') }
    finally { setOcupado(false) }
  }

  async function marcar() {
    setOcupado(true)
    try {
      const r = await inventarioServicio.marcarBienes()
      mensaje.bien(r.mensaje); onCambio()
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo.') }
    finally { setOcupado(false) }
  }

  const p = estado.productos
  const listas = estado.sucursales.filter(s => s.stockInicialEn && !s.controlaDesde)
  const pendientes = estado.sucursales.filter(s => !s.controlaDesde)
  const todasCargadas = estado.sucursales.every(s => !!s.stockInicialEn)
  const pasoActual = !estado.encendido ? 1 : p.controlados === 0 ? 2 : !todasCargadas ? 3 : pendientes.length > 0 ? 4 : 5

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Inventario · configuración</h1>
          <p className="secundario">Al encender el inventario nada se bloquea todavía. Primero cargas lo que tienes; cuando confirmes «Empezar a controlar», desde ese momento se cuenta y se bloquea lo que no hay.</p>
        </div>
      </div>

      {/* --- El interruptor: se guarda al pulsar ---------------------------- */}
      <div className={estado.encendido ? 'bloque inv-interruptor encendido' : 'bloque inv-interruptor'}>
        <div className="inv-interruptor-texto">
          <span className="inv-luz" aria-hidden="true" />
          <div>
            <strong>{estado.encendido ? 'El inventario está encendido' : 'El inventario está apagado'}</strong>
            <span className="secundario">
              {estado.encendido
                ? `${estado.activadoEn ? `Desde el ${fechaYHora(estado.activadoEn)} · ` : ''}Stock, Ingresos, Ajustes y Traslados ya están abiertos.`
                : 'La facturación funciona como siempre: nada se cuenta ni se bloquea.'}
            </span>
          </div>
        </div>
        {editable
          ? (estado.encendido
              ? <Boton estilo="secundario" onClick={() => void encender(false)} ocupado={ocupado}>Apagar</Boton>
              : <Boton onClick={() => void encender(true)} ocupado={ocupado}>Encender inventario</Boton>)
          : <span className="secundario">Solo quien tiene «Configurar el inventario» puede cambiarlo.</span>}
      </div>

      {!estado.encendido && (
        <div className="bloque">
          <h2 className="subtitulo">Qué pasa cuando lo enciendes</h2>
          <ol className="inv-explica">
            <li><strong>Se abren las pantallas de inventario:</strong> Stock, Ingresos por compra, Ajustes y conteos, Traslados.</li>
            <li><strong>Revisas qué productos se cuentan.</strong> Los bienes llevan «Controla stock»; los servicios (unidad ZZ) nunca.</li>
            <li><strong>Cargas el stock inicial</strong> de cada sucursal, con Excel o a mano.</li>
            <li><strong>Mientras no pulses «Empezar a controlar»</strong>, las facturas se emiten como siempre: lo vendido se anota en el kardex y solo avisa si no alcanza. Así puedes probar unos días.</li>
            <li><strong>Desde «Empezar a controlar»</strong> ya no se emite lo que no hay, salvo que actives «Permitir vender sin stock».</li>
          </ol>
          <p className="nota se-aplica">Apagarlo después no borra nada: el kardex se guarda y deja de bloquear.</p>
        </div>
      )}

      {estado.encendido && (
        <>
          <div className="inv-pasos">
            {[
              ['Enciende el inventario', estado.modo === 'despacho' ? 'Por defecto: con despacho' : 'Por defecto: venta directa'],
              ['Revisa qué productos se cuentan', `${p.controlados} bienes con «Controla stock»`],
              ['Carga el stock inicial', 'Por sucursal, con Excel o a mano'],
              ['Empezar a controlar', 'Desde aquí se bloquea'],
            ].map(([t, d], i) => (
              <div key={t} className={pasoActual > i + 1 ? 'hecho' : pasoActual === i + 1 ? 'ahora' : undefined}>
                <small>{i + 1}{pasoActual > i + 1 ? ' · LISTO ✓' : pasoActual === i + 1 ? ' · AHORA' : ''}</small>
                <strong>{t}</strong><br />{d}
              </div>
            ))}
          </div>

          <div className="inv-dos mitad">
            <div className="bloque">
              <h2 className="subtitulo">Cómo trabaja</h2>

              <h3 className="inv-pregunta">¿Cuándo sale la mercadería?</h3>
              <p className="parrafo secundario">Lo que viene marcado en cada factura nueva.</p>
              <div className="casillas">
                <label className="casilla">
                  <input type="radio" name="modo" checked={modo === 'directa'} disabled={!editable} onChange={() => setModo('directa')} />
                  <span><strong>Por defecto, venta directa: sale al emitir la factura o boleta</strong>
                    <em>El cliente se lleva la mercadería en el momento (tienda, mostrador).</em></span>
                </label>
                <label className="casilla">
                  <input type="radio" name="modo" checked={modo === 'despacho'} disabled={!editable} onChange={() => setModo('despacho')} />
                  <span><strong>Por defecto, con despacho: la factura reserva y la guía la saca</strong>
                    <em>Se factura primero y la mercadería sale después con su guía de remisión. Hasta que sale, está «reservada» y no se puede vender a otro.</em></span>
                </label>
              </div>
              <div className="inv-espacio">
                <Aviso tono="info">
                  <strong>Puedes usar los dos.</strong> Esto solo elige con qué viene marcada cada factura nueva; en cada
                  factura se cambia con la casilla «Se entrega después (con guía)».
                </Aviso>
              </div>

              <h3 className="inv-pregunta">Cuando no alcanza</h3>
              <div className="casillas">
                <label className="casilla">
                  <input type="checkbox" checked={sinStock} disabled={!editable} onChange={e => setSinStock(e.target.checked)} />
                  <span><strong>Permitir vender sin stock</strong>
                    <em>Apagado: no se emite si no hay disponible. Encendido: se emite, el stock queda en negativo y aparece en «Stock › En negativo» para revisarlo.</em></span>
                </label>
                <label className="casilla">
                  <input type="checkbox" checked={avisar} disabled={!editable} onChange={e => setAvisar(e.target.checked)} />
                  <span><strong>Avisarme cuando un producto baje de su mínimo</strong>
                    <em>Aviso en Inicio y en Stock. El mínimo se pone en cada producto, por sucursal.</em></span>
                </label>
              </div>

              {editable && (
                <div className={cambio ? 'inv-guardar pendiente' : 'inv-guardar'}>
                  <span>{cambio ? '● Tienes cambios sin guardar' : '✓ Todo guardado'}</span>
                  {cambio && (
                    <Boton estilo="plano" onClick={() => { setModo(estado.modo); setSinStock(estado.permitirSinStock); setAvisar(estado.avisarMinimo) }}>
                      Deshacer
                    </Boton>
                  )}
                  <Boton onClick={() => void guardar()} ocupado={ocupado} disabled={!cambio}>Guardar cambios</Boton>
                </div>
              )}

              <h3 className="inv-pregunta inv-sep">Productos que controlan stock</h3>
              <p className="parrafo">Tienes {p.bienes} bienes: {p.controlados} controlan stock, {p.sinControl} no. Los {p.servicios} servicios no cuentan.</p>
              {editable && p.sinControl > 0 && (
                <Boton estilo="secundario" onClick={() => void marcar()} ocupado={ocupado}>Marcar «Controla stock» en todos los bienes ({p.sinControl})</Boton>
              )}

              <h3 className="inv-pregunta inv-sep">Permisos</h3>
              <p className="parrafo">En Personal › Roles y permisos: Ver inventario · Registrar ingresos · Ajustar inventario · Recibir traslados · Hacer conteo físico · Configurar el inventario.</p>
              <p className="nota">Cada uno respeta las sucursales que la persona puede ver.</p>
            </div>

            <div className="bloque">
              <h2 className="subtitulo">Cómo va el stock inicial</h2>
              <table className="tabla">
                <thead><tr><th>Sucursal</th><th className="num">Con stock inicial</th><th>Estado</th></tr></thead>
                <tbody>
                  {estado.sucursales.map(s => (
                    <tr key={s.id}>
                      <td>{s.codigo} {s.nombre}</td>
                      <td className="num mono">{s.conStockInicial} de {p.controlados}</td>
                      <td className={s.controlaDesde ? 'inv-bien' : s.stockInicialEn ? 'inv-bien' : 'inv-bajo'}>
                        {s.controlaDesde ? <strong>● Controlando</strong>
                          : s.stockInicialEn ? '● Cargado'
                          : <>● Falta cargar · <Link to="/inventario/ajustes?ver=inicial">Cargar ahora</Link></>}
                        {editable && s.controlaDesde && (
                          <div><button type="button" className="enlace" onClick={() => void controlar([s.id], false)}>Volver a solo avisar</button></div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="nota">Un producto en cero puede ser real (no tienes). Lo que importa es que hayas revisado cada sucursal.</p>

              {pendientes.length > 0 && (
                <>
                  <div className="inv-espacio">
                    <Aviso tono="ojo">
                      <strong>Mientras no empieces a controlar:</strong> las facturas se emiten como siempre. Lo que se venda se anota
                      en el kardex y solo avisa si no alcanza, sin bloquear. Así puedes probar unos días antes de encenderlo de verdad.
                    </Aviso>
                  </div>
                  {editable && (
                    <div className="inv-pie">
                      {listas.length > 0 && listas.length < pendientes.length && listas.map(s => (
                        <Boton key={s.id} estilo="secundario" onClick={() => void controlar([s.id])} ocupado={ocupado}>Solo {s.codigo} {s.nombre}</Boton>
                      ))}
                      <Boton onClick={() => void controlar(pendientes.map(s => s.id))} ocupado={ocupado} disabled={!pendientes.every(s => s.stockInicialEn)}>
                        Empezar a controlar{pendientes.length > 1 ? ' todas' : ''}
                      </Boton>
                    </div>
                  )}
                  {editable && !pendientes.every(s => s.stockInicialEn) && (
                    <p className="nota">«Empezar a controlar todas» se habilita cuando cada sucursal tenga su stock inicial. Puedes empezar por las que ya están listas.</p>
                  )}
                </>
              )}
              <p className="nota se-aplica">Se aplica: queda en la bitácora quién empezó a controlar y cuándo. Apagar el inventario después no borra nada: el kardex se guarda y deja de bloquear.</p>
            </div>
          </div>
        </>
      )}

      {dialogo}
    </>
  )
}