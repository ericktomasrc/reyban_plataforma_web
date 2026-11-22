import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../componentes/Aviso'
import { Boton } from '../../componentes/Boton'
import { Cargando, Vacio } from '../../componentes/Cargando'
import { ErrorApi } from '../../nucleo/api/errores'
import { fecha } from '../../nucleo/formato/fechas'
import { useMensaje } from '../../nucleo/mensajes/ProveedorMensajes'
import '../facturacion/comprobantes-lista.css'
import '../deudas/deudas.css'
import './ventas.css'
import { CLASE_ESTADO, MESES, NOMBRE_ESTADO, dinero, textoMedio, ventasServicio, type EstadoVenta, type MisPagos, type PagoMio } from './ventasServicio'

/**
 * e274 (091) — PAGOS Y COMPROBANTES (Cuenta Negocio y Profesional). Lo que la
 * cuenta le pagó a Reyban, con su boleta o factura, y sus gastos por mes para
 * el contador. La tarjeta y los datos del comprobante siguen en Mi plan ›
 * Mis pagos.
 */
export function PagosComprobantes() {
  const mensaje = useMensaje()
  const [anio, setAnio] = useState<number>()
  const [estado, setEstado] = useState<EstadoVenta | ''>('')
  const [datos, setDatos] = useState<MisPagos>()
  const [fallo, setFallo] = useState<string>()
  const [bajando, setBajando] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ventasServicio.misPagos(anio)
      .then(d => { if (vivo) { setDatos(d); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudieron leer tus pagos.') })
    return () => { vivo = false }
  }, [anio])

  async function bajar(clave: string, accion: () => Promise<void>) {
    setBajando(clave)
    try { await accion() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar el archivo.') }
    finally { setBajando(null) }
  }

  if (fallo) return <div className="ddu-pagina vnt-pagina"><Aviso>{fallo}</Aviso></div>
  if (!datos) return <Cargando />
  const filas = datos.filas.filter(f => !estado || f.estado === estado)
  const totalAnio = datos.porMes.reduce((s, m) => s + m.total, 0)
  const igv = (t: number) => t - Math.round((t / 1.18) * 100) / 100

  return (
    <div className="ddu-pagina vnt-pagina">
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">Pagos y comprobantes</h1>
          <p className="bajada-pagina">Lo que le pagaste a Reyban por tu plan, con su boleta o factura. Para tu contador: descarga el Excel.</p>
        </div>
        <div className="vnt-acciones">
          <Boton estilo="secundario" ocupado={bajando === 'excel'} textoOcupado="Bajando…"
                 onClick={() => void bajar('excel', () => ventasServicio.misPagosExcel(datos.anio))}>Descargar Excel</Boton>
          <Link className="boton" to="/mi-plan">Ir a Mi plan</Link>
        </div>
      </div>

      <div className="cmp-mes estatico vnt-franja">
        <div className="cmp-mes-dato elegido"><span>Pagado en {datos.anio}</span><strong>S/ {dinero(datos.pagadoAnio)}</strong><small>{datos.pagosAnio} {datos.pagosAnio === 1 ? 'pago' : 'pagos'}</small></div>
        <div className="cmp-mes-dato"><span>Este mes</span><strong>S/ {dinero(datos.pagadoMes)}</strong></div>
        <div className="cmp-mes-dato"><span>Tu plan</span><strong>{datos.plan ?? '—'}</strong>{datos.planMensual != null && <small>S/ {dinero(datos.planMensual)} al mes</small>}</div>
        <div className={`cmp-mes-dato${datos.estadoPago !== 'al_dia' ? ' mal' : ''}`}><span>Próximo cobro</span><strong>{datos.proximo ? fecha(datos.proximo) : '—'}</strong>
          <small>{datos.estadoPago !== 'al_dia' ? 'Tienes un pago pendiente' : datos.tarjeta ?? 'sin tarjeta guardada'}</small></div>
      </div>

      <div className="vnt-dos">
        <div className="lst-caja">
          <div className="cmp-chips" role="group" aria-label="Qué ver">
            <select aria-label="Año" value={datos.anio} onChange={e => setAnio(Number(e.target.value))}>
              {datos.anios.map(a => <option key={a} value={a}>Año {a}</option>)}
            </select>
            {([['', 'Todos'], ['pagado', 'Pagados'], ['rechazado', 'Rechazados']] as const).map(([v, t]) => (
              <button key={v} type="button" className={estado === v ? 'cmp-chip elegido' : 'cmp-chip'} aria-pressed={estado === v} onClick={() => setEstado(v)}>{t}</button>
            ))}
          </div>
          {filas.length === 0 ? (
            <div className="relleno"><Vacio>{datos.filas.length === 0 ? `No hay pagos en ${datos.anio}. Tu primer pago aparece aquí con su comprobante.` : 'Nada con ese filtro.'}</Vacio></div>
          ) : (
            <div className="bloque sin-relleno lst-tabla">
              <div className="tabla-envoltura">
                <table className="tabla lst">
                  <thead><tr><th>Fecha</th><th>Concepto</th><th>Medio</th><th className="derecha">Monto</th><th>Estado</th><th>Comprobante</th></tr></thead>
                  <tbody>{filas.map(p => <FilaPago key={p.id} p={p} bajando={bajando} bajar={bajar} />)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <section className="bloque sin-relleno vnt-caja">
          <h2 className="vnt-titulo-tabla">Tus gastos con Reyban</h2>
          <table className="tabla lst">
            <thead><tr><th>Mes</th><th className="derecha">Pagos</th><th className="derecha">Total</th><th className="derecha">IGV</th></tr></thead>
            <tbody>{datos.porMes.map(m => (
              <tr key={m.mes}><td>{MESES[m.mes - 1][0].toUpperCase() + MESES[m.mes - 1].slice(1)} {datos.anio}</td><td className="derecha">{m.pagos}</td>
                <td className="derecha lst-precio">S/ {dinero(m.total)}</td><td className="derecha secundario">S/ {dinero(igv(m.total))}</td></tr>
            ))}</tbody>
          </table>
          <div className="vnt-total"><span>Total {datos.anio}</span><strong>S/ {dinero(totalAnio)}</strong></div>
        </section>
      </div>
      <p className="nota ddu-nota">Tu tarjeta y los datos de tu comprobante se cambian en <Link to="/mi-plan/pagos">Mi plan › Mis pagos</Link>. Una boleta no tiene XML propio: baja su PDF.</p>
    </div>
  )
}

function FilaPago({ p, bajando, bajar }: { p: PagoMio; bajando: string | null; bajar: (clave: string, a: () => Promise<void>) => Promise<void> }) {
  return (
    <tr>
      <td className="sin-corte">{fecha(p.fecha)}</td>
      <td><div>{p.concepto}</div>{(p.modo === 'prueba' || p.modo === 'simulado') && <div className="secundario">pago de prueba</div>}</td>
      <td className="sin-corte">{textoMedio(p.medio, p.tarjeta)}</td>
      <td className="derecha lst-precio">S/ {dinero(p.monto)}</td>
      <td><span className={`ddu-estado ${CLASE_ESTADO[p.estado]}`}>{NOMBRE_ESTADO[p.estado]}</span>
        {p.estado === 'rechazado' && p.error && <div className="secundario vnt-ref" title={p.error}>{p.error}</div>}</td>
      <td>
        {p.comprobanteListo ? (
          <>
            <div className="mono sin-corte">{p.comprobanteNumero}</div>
            <div className="vnt-archivos">
              <button type="button" className="enlace" disabled={bajando !== null} onClick={() => void bajar(p.id + 'pdf', () => ventasServicio.comprobante(p.id, 'pdf'))}>
                {bajando === p.id + 'pdf' ? 'Bajando…' : 'PDF'}</button>
              {p.comprobanteTipo === '01' && (
                <button type="button" className="enlace" disabled={bajando !== null} onClick={() => void bajar(p.id + 'xml', () => ventasServicio.comprobante(p.id, 'xml'))}>
                  {bajando === p.id + 'xml' ? 'Bajando…' : 'XML'}</button>
              )}
            </div>
          </>
        ) : <span className="secundario">{p.estado === 'pagado' ? 'Llega pronto a tu correo' : '—'}</span>}
      </td>
    </tr>
  )
}