import { Link } from 'react-router-dom'
import { soles } from '../../../nucleo/planes/planes'
import { etiquetaPlan, extraHoy, menusDelPlan, precioHoy } from '../../planes/servicios/planesServicio'
import { CorreoContacto, numeroPeru, useVitrina } from './Vitrina'
import { CapturaPlan } from '../componentes/CapturaPlan'
import { textoTope } from '../../planes/componentes/TopeComprobantes'

// =============================================================================
// INICIO
// =============================================================================
const QUE_HACE = [
  { icono: '🧾', titulo: 'Facturas, boletas y notas', texto: 'Emite en segundos. El IGV, los totales y el XML los calcula el sistema; SUNAT responde y tú ves el estado al instante.' },
  { icono: '🚚', titulo: 'Guías de remisión', texto: 'Remitente y transportista, desde cero o desde una factura. Vehículos y conductores guardados.' },
  { icono: '📨', titulo: 'Llega a tu cliente', texto: 'PDF con tu logo y colores, por correo o WhatsApp. Tu cliente también puede consultarlo en línea.' },
  { icono: '📦', titulo: 'Inventario y compras', texto: 'Stock por sucursal, kardex, traslados, lotes y series. Registra tus compras y gastos.' },
  { icono: '🛒', titulo: 'Punto de venta', texto: 'Vende rápido en caja, con apertura y cierre, y emite la boleta o factura en el momento.' },
  { icono: '📊', titulo: 'Reportes', texto: 'Ventas, ganancias, registro de ventas para tu contador y todo lo que SUNAT te pide.' },
]

const PARA_QUIEN = [
  { titulo: 'Para tu negocio', subtitulo: 'Cuenta Negocio', texto: 'Una empresa, la tuya. Usuarios ilimitados, sucursales y permisos por persona.', enlace: '/registro?tipo=negocio' },
  { titulo: 'Para contadores y estudios', subtitulo: 'Cuenta Profesional', texto: 'Todas las empresas de tus clientes en una sola cuenta, con tu equipo y un precio por empresa que baja mientras más trabajas.', enlace: '/registro?tipo=profesional' },
]

export function InicioPublico() {
  const v = useVitrina()
  const dias = v?.catalogo.reglas.diasPrueba ?? 30
  const desde = v ? Math.min(...v.catalogo.planes.map(p => precioHoy(p, v.catalogo.enOferta))) : null
  return (
    <>
      <section className="pub-heroe">
        <div className="pub-ancho">
          <span className="pub-sello">Facturación electrónica · SUNAT</span>
          <h1>Factura electrónica fácil, para tu negocio y para tus clientes.</h1>
          <p className="pub-bajada">
            Emite facturas, boletas, notas y guías de remisión desde el navegador o el celular. Nosotros las firmamos y las
            enviamos a SUNAT por ti.
          </p>
          <div className="pub-acciones">
            <Link to="/registro?tipo=negocio" className="pub-boton grande">Pruébalo gratis {dias} días</Link>
            <Link to="/precios" className="pub-boton plano grande">Ver precios{desde !== null ? ` · desde ${soles(desde)} al mes` : ''}</Link>
          </div>
          <p className="pub-nota">Sin tarjeta para empezar. Usuarios ilimitados en todos los planes.</p>
        </div>
      </section>

      <section className="pub-seccion">
        <div className="pub-ancho">
          <h2>Todo lo que necesitas para facturar</h2>
          <div className="pub-rejilla-3">
            {QUE_HACE.map(x => (
              <div key={x.titulo} className="pub-tarjeta">
                <span className="pub-icono" aria-hidden="true">{x.icono}</span>
                <h3>{x.titulo}</h3>
                <p>{x.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-seccion pub-gris">
        <div className="pub-ancho">
          <h2>¿Para quién es?</h2>
          <div className="pub-rejilla-2">
            {PARA_QUIEN.map(x => (
              <div key={x.titulo} className="pub-tarjeta grande">
                <span className="pub-sello chico">{x.subtitulo}</span>
                <h3>{x.titulo}</h3>
                <p>{x.texto}</p>
                <Link to={x.enlace} className="pub-enlace">Crear mi cuenta →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-seccion">
        <div className="pub-ancho">
          <h2>Seguro desde el primer día</h2>
          <ul className="pub-lista-check">
            <li>Tu certificado digital y tu clave SOL se guardan cifrados: nadie en Reyban puede leerlos.</li>
            <li>Cada empresa ve solo lo suyo. Entras con contraseña y un segundo factor en tu celular.</li>
            <li>Si SUNAT no responde, tus comprobantes esperan en cola y se envían solos cuando vuelve.</li>
            <li>Nada se borra: tus comprobantes, XML y constancias quedan guardados y los descargas cuando quieras.</li>
          </ul>
        </div>
      </section>

      <section className="pub-cierre">
        <div className="pub-ancho">
          <h2>Empieza hoy, gratis por {dias} días</h2>
          <p>Prueba todo. Al terminar, eliges tu plan y pagas con tarjeta o transferencia.</p>
          <Link to="/registro?tipo=negocio" className="pub-boton grande blanco">Crear mi cuenta gratis</Link>
        </div>
      </section>
    </>
  )
}

// =============================================================================
// PRECIOS
// =============================================================================
const DESCRIPCION: Record<string, string> = {
  basico: 'Emite facturas, boletas, notas de crédito y débito y guías de remisión ante SUNAT, desde el navegador o el celular. Con tus clientes, productos y reportes de ventas.',
  pro: 'Todo lo del Básico más el control de tu negocio: registra tus compras y gastos, lleva tu inventario con kardex y mira tus ganancias.',
  max: 'Todo lo del Pro más punto de venta con apertura y cierre de caja, lotes y vencimientos, series y varios almacenes.',
}

// =============================================================================
export function PreciosPublico() {
  const v = useVitrina()
  if (!v) return <div className="pub-ancho pub-seccion"><p>Cargando precios…</p></div>
  const { catalogo } = v
  const oferta = catalogo.enOferta
  const anual = catalogo.reglas.anualMesesGratis
  const medio = catalogo.planes.find(p => p.codigo === 'pro') ?? catalogo.planes[Math.min(1, catalogo.planes.length - 1)]
  const ofertaHasta = catalogo.reglas.ofertaHasta
    ? new Date(catalogo.reglas.ofertaHasta + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <>
      <section className="pub-seccion">
        <div className="pub-ancho">
          <h1 className="pub-titulo">Precios simples, sin sorpresas</h1>
          <p className="pub-bajada centro">
            {catalogo.reglas.diasPrueba} días gratis para probarlo todo. Usuarios ilimitados en todos los planes.
            {oferta && ofertaHasta && <> Precio de lanzamiento para quien contrate hasta el {ofertaHasta}{(catalogo.reglas.lanzamientoMeses ?? 12) > 0 ? <>: <strong>lo mantienes {catalogo.reglas.lanzamientoMeses ?? 12} meses pagando</strong></> : null}.</>}
          </p>

          <h2 className="pub-subtitulo">Nuestros servicios</h2>
          <div className="pub-productos">
            {catalogo.planes.map((p, i) => {
              const hoy = precioHoy(p, oferta)
              return (
                <article key={p.codigo} className={`pub-producto${p.codigo === 'pro' ? ' destacado' : ''}`}>
                  <CapturaPlan tipo={p.codigo} cinta={p.codigo === 'pro' ? 'El más elegido' : undefined} />
                  <div className="pub-producto-cuerpo">
                    <h3>Plan {p.nombre}</h3>
                    <p className="pub-para">{etiquetaPlan(catalogo.planes, i)}</p>
                    <div className="pub-precio">
                      {oferta && p.precioOferta !== null && p.precioOferta < p.precioRegular && <s>{soles(p.precioRegular)}</s>}
                      <strong>{soles(hoy)}</strong><span>al mes</span>
                    </div>
                    <p className="pub-descripcion">{DESCRIPCION[p.codigo] ?? 'Facturación electrónica ante SUNAT.'}</p>
                    <ul>
                      {menusDelPlan(p.funciones).slice(0, 5).map(m => <li key={m}>{i > 0 ? '+ ' : ''}{m}</li>)}
                      <li>{p.sucursalesMax === null ? 'Sucursales ilimitadas' : `${p.sucursalesMax} sucursal${p.sucursalesMax === 1 ? '' : 'es'}`} · usuarios ilimitados</li>
                      {p.topeRegular && <li>{textoTope(p, oferta)}</li>}
                    </ul>
                    <Link to={`/registro?tipo=negocio&plan=${p.codigo}`} className="pub-boton ancho">Contratar {p.nombre}</Link>
                    <span className="pub-mini">o pruébalo gratis {catalogo.reglas.diasPrueba} días</span>
                  </div>
                </article>
              )
            })}
            {anual > 0 && medio && (
              <article className="pub-producto">
                <CapturaPlan tipo="anual" cinta={`${anual} meses gratis`} />
                <div className="pub-producto-cuerpo">
                  <h3>Plan {medio.nombre} anual</h3>
                  <p className="pub-para">Paga el año y ahorra</p>
                  <div className="pub-precio"><strong>{soles(precioHoy(medio, oferta) * (12 - anual))}</strong><span>al año</span></div>
                  <p className="pub-descripcion">
                    El plan {medio.nombre} por 12 meses pagando {12 - anual}. Un solo pago con tu factura o boleta. También hay Básico y Max anual.
                  </p>
                  <ul>
                    <li>Todo lo del plan {medio.nombre}</li>
                    <li>Ahorras {soles(precioHoy(medio, oferta) * anual)}</li>
                    <li>Precio fijo todo el año</li>
                  </ul>
                  <Link to={`/registro?tipo=negocio&plan=${medio.codigo}&periodo=anual`} className="pub-boton ancho">Contratar anual</Link>
                  <span className="pub-mini">o pruébalo gratis {catalogo.reglas.diasPrueba} días</span>
                </div>
              </article>
            )}
            {catalogo.tramos.length > 0 && (
              <article className="pub-producto">
                <CapturaPlan tipo="profesional" />
                <div className="pub-producto-cuerpo">
                  <h3>Cuenta Profesional</h3>
                  <p className="pub-para">Contadores y estudios</p>
                  <div className="pub-precio">
                    {oferta && catalogo.tramos[0].precioOferta < catalogo.tramos[0].precioRegular && <s>{soles(catalogo.tramos[0].precioRegular)}</s>}
                    <strong>{soles(oferta ? catalogo.tramos[0].precioOferta : catalogo.tramos[0].precioRegular)}</strong><span>por empresa al mes</span>
                  </div>
                  <p className="pub-descripcion">
                    Todas las empresas de tus clientes en una sola cuenta, con tu equipo. Cada empresa trae todo lo del plan Básico.
                    Mínimo {catalogo.reglas.carteraMinimo} empresas ({soles(catalogo.reglas.carteraMinimo * (oferta ? catalogo.tramos[0].precioOferta : catalogo.tramos[0].precioRegular))} al mes).
                    {oferta && new Set(catalogo.tramos.map(t => t.precioOferta)).size === 1
                      ? ' En la oferta, el mismo precio para todas tus empresas; después, mientras más empresas, menos pagas por cada una:'
                      : ' Mientras más empresas, menos pagas por cada una:'}
                  </p>
                  <table className="pub-tramos-mini">
                    <tbody>{catalogo.tramos.map(t => (
                      <tr key={t.desde}>
                        <td>{t.hasta === null ? `${t.desde} o más` : `${t.desde} a ${t.hasta}`} empresas</td>
                        <td>{oferta && t.precioOferta < t.precioRegular && <s>{soles(t.precioRegular)}</s>} <strong>{soles(oferta ? t.precioOferta : t.precioRegular)}</strong> c/u</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <Link to="/registro?tipo=profesional" className="pub-boton ancho">Contratar Profesional</Link>
                  <span className="pub-mini">o pruébala gratis {catalogo.reglas.diasPrueba} días</span>
                </div>
              </article>
            )}
          </div>
          <div className="pub-como-compro">
            <strong>¿Cómo contrato?</strong> 1) Pulsa «Contratar» y crea tu cuenta. 2) En «Mi plan» elige tu plan.
            3) En «Mis pagos» deja tus datos para el comprobante y paga con tarjeta. 🔒 Pago seguro con Culqi: tu tarjeta no pasa por Reyban.
            Se renueva cada mes y cancelas cuando quieras (ver <Link to="/devoluciones">cambios, cancelaciones y devoluciones</Link>).
            {oferta && (catalogo.reglas.lanzamientoMeses ?? 12) > 0 && <> Si contratas durante la oferta, <strong>tu precio de lanzamiento se mantiene {catalogo.reglas.lanzamientoMeses ?? 12} meses pagando</strong>, aunque la oferta termine.</>}
          </div>

          <h2 className="pub-subtitulo">Cuenta Profesional (Cartera) · para contadores y estudios</h2>
          <div className="pub-cartera">
            <div>
              <p>Pagas por cada empresa que trabajas, y cada empresa viene con el plan <strong>Básico</strong>. Mientras más empresas, menos pagas por cada una:</p>
              <table className="pub-tabla">
                <thead><tr><th>Empresas</th><th>Precio por empresa, al mes</th></tr></thead>
                <tbody>
                  {catalogo.tramos.map(t => (
                    <tr key={t.desde}>
                      <td>{t.hasta === null ? `De la ${t.desde} en adelante` : `De la ${t.desde} a la ${t.hasta}`}</td>
                      <td>{oferta && t.precioOferta < t.precioRegular && <s>{soles(t.precioRegular)}</s>} <strong>{soles(oferta ? t.precioOferta : t.precioRegular)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="pub-nota">Mínimo {catalogo.reglas.carteraMinimo} empresas. La empresa de tu propio estudio, en Básico, es gratis.</p>
            </div>
            <div className="pub-tarjeta">
              <h3>¿Una empresa necesita más?</h3>
              <p>Súbela solo a ella:</p>
              <ul className="pub-lista-check">
                {catalogo.planes.filter(p => p.codigo !== 'basico').map(p => (
                  <li key={p.codigo}><strong>{p.nombre}:</strong> + {soles(extraHoy(p, oferta))} al mes por esa empresa</li>
                ))}
              </ul>
              <Link to="/registro?tipo=profesional" className="pub-boton ancho">Crear mi Cuenta Profesional</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="pub-seccion pub-gris">
        <div className="pub-ancho pub-preguntas">
          <h2>Preguntas frecuentes</h2>
          <details open><summary>¿Qué pasa cuando termina el mes gratis?</summary>
            <p>Sigues en el plan que elegiste (Básico si no elegiste otro). Si dejaste tu tarjeta, el cobro se hace solo; si no, te avisamos para que pagues. Nada de lo que hiciste se pierde.</p></details>
          <details><summary>¿Cómo pago?</summary>
            <p>Con tarjeta de crédito o débito, de forma segura a través de Culqi (tu tarjeta no pasa por Reyban){v.medios?.transferencia ? ', o por transferencia bancaria' : ''}. Puedes pagar mes a mes o el año completo.</p></details>
          <details><summary>¿Me dan comprobante?</summary>
            <p>Sí. Con cada pago te emitimos factura (si nos das tu RUC) o boleta (con tu DNI), y te llega al correo.</p></details>
          <details><summary>¿Puedo cambiar de plan o cancelar?</summary>
            <p>Cuando quieras, desde «Mi plan». Si cancelas, sigues usando lo que ya pagaste hasta el final del periodo. Mira la <Link to="/devoluciones">política de cancelaciones y devoluciones</Link>.</p></details>
          <details><summary>¿Los precios incluyen IGV?</summary>
            <p>Sí, todos los precios están en soles e incluyen IGV.</p></details>
        </div>
      </section>
    </>
  )
}

// =============================================================================
// CONTACTO
// =============================================================================
export function ContactoPublico() {
  const e = useVitrina()?.empresa
  return (
    <section className="pub-seccion">
      <div className="pub-ancho pub-contacto">
        <div>
          <h1 className="pub-titulo izquierda">Hablemos</h1>
          <p className="pub-bajada">¿Dudas sobre los planes, cómo empezar o un pago? Escríbenos y te respondemos el mismo día hábil.</p>
          <ul className="pub-datos">
            <li><span>Correo</span><CorreoContacto /></li>
            {e?.whatsapp && <li><span>WhatsApp</span><a href={`https://wa.me/${numeroPeru(e.whatsapp)}`} target="_blank" rel="noreferrer">{e.whatsapp}</a></li>}
            <li><span>Empresa</span>{e?.razonSocial ?? 'Reyban Consulting SAC'}{e?.ruc ? ` · RUC ${e.ruc}` : ''}</li>
            <li><span>Dirección</span>{e?.direccion ?? 'Lima, Perú'}</li>
            <li><span>Horario</span>Lunes a viernes, de 9:00 a 18:00</li>
          </ul>
        </div>
        <div className="pub-tarjeta">
          <h3>¿Ya tienes cuenta?</h3>
          <p>Entra y revisa «Mi plan» y «Mis pagos». Si algo no cuadra con un cobro, escríbenos desde el correo de tu cuenta con el número de pago (P-000123).</p>
          <Link to="/entrar" className="pub-boton ancho">Entrar</Link>
          <h3 className="pub-mas-arriba">¿Un reclamo o una queja?</h3>
          <p>Regístralo en nuestro Libro de Reclamaciones. Te llega una copia al correo y te respondemos en un máximo de 15 días hábiles.</p>
          <Link to="/libro-reclamaciones" className="pub-boton ancho plano">Libro de Reclamaciones</Link>
        </div>
      </div>
    </section>
  )
}