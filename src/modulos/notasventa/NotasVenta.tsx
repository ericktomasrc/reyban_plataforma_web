import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Aviso } from '../../componentes/Aviso'
import { Boton } from '../../componentes/Boton'
import { Cargando, Vacio } from '../../componentes/Cargando'
import { FiltroFechas } from '../../componentes/FiltrosComunes'
import { Paginacion } from '../../componentes/Paginacion'
import { ErrorApi } from '../../nucleo/api/errores'
import { Permisos } from '../../nucleo/autorizacion/permisos'
import { useMensaje } from '../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../nucleo/sesion/SesionContexto'
import '../facturacion/comprobantes-lista.css'
import '../deudas/deudas.css'
import './notas-venta.css'
import { claseEstado, detalleNota, dinero, enLima } from './formatoNotas'
import { NOMBRE_ESTADO, notasVentaServicio, type FiltroNota, type PaginaNotas } from './notasVentaServicio'

/**
 * e282 (097) — NOTAS DE VENTA. Vender sin comprobante electrónico: al fiado,
 * un pedido separado o una venta rápida. No va a SUNAT; cuando el cliente lo
 * pide, se convierte en boleta o factura (y no descuenta stock dos veces).
 */

const CHIPS: [FiltroNota, string][] = [
  ['todas', 'Todas'], ['por_cobrar', 'Por cobrar'], ['pedidos', 'Por entregar'], ['pagadas', 'Pagadas'], ['convertidas', 'Convertidas'], ['anuladas', 'Anuladas'],
]

export function NotasVenta() {
  const { puede } = useSesion()
  const mensaje = useMensaje()
  const navegar = useNavigate()
  const emite = puede(Permisos.Facturacion.Emitir)
  const [estado, setEstado] = useState<FiltroNota>('todas')
  const [q, setQ] = useState('')
  const [buscar, setBuscar] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [datos, setDatos] = useState<PaginaNotas>()
  const [fallo, setFallo] = useState<string>()
  const [bajando, setBajando] = useState(false)

  useEffect(() => { const t = window.setTimeout(() => { setBuscar(q.trim()); setPagina(1) }, 400); return () => window.clearTimeout(t) }, [q])

  useEffect(() => {
    let vivo = true
    notasVentaServicio.listar({ estado, q: buscar || undefined, desde: desde || undefined, hasta: hasta || undefined, pagina, porPagina })
      .then(d => { if (vivo) { setDatos(d); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer la lista.') })
    return () => { vivo = false }
  }, [estado, buscar, desde, hasta, pagina, porPagina])

  const elegir = (e: FiltroNota) => { setEstado(e); setPagina(1) }
  const c = datos?.cifras

  async function excel() {
    setBajando(true)
    try { await notasVentaServicio.excel({ estado, q: buscar || undefined, desde: desde || undefined, hasta: hasta || undefined }) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar el Excel.') }
    finally { setBajando(false) }
  }

  return (
    <div className="ddu-pagina nv-pagina">
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">
            Notas de venta
            {c && c.notasMes > 0 && <span className="lst-cuenta">{c.notasMes} este mes</span>}
          </h1>
          <p className="bajada-pagina">
            Para vender al fiado, separar un pedido o vender sin comprobante electrónico todavía. <strong>No se envía a SUNAT</strong>:
            cuando el cliente lo pida, la conviertes en boleta o factura.
          </p>
        </div>
        <div className="nv-acciones">
          {datos && datos.total > 0 && <Boton estilo="secundario" onClick={() => void excel()} ocupado={bajando} textoOcupado="Bajando…">Descargar Excel</Boton>}
          {emite && <Link className="boton" to="/facturacion/notas-venta/nueva">Nueva nota de venta</Link>}
        </div>
      </div>

      {c && (
        <div className="cmp-mes" role="group" aria-label="Mostrar">
          <button type="button" className={`cmp-mes-dato${estado === 'todas' ? ' elegido' : ''}`} onClick={() => elegir('todas')}>
            <span>Vendido este mes</span><strong>S/ {dinero(c.vendidoMes)}</strong>
            <small>{c.notasMes} {c.notasMes === 1 ? 'nota' : 'notas'}</small>
          </button>
          <button type="button" className={`cmp-mes-dato${c.fiado > 0 ? ' ojo' : ''}${estado === 'por_cobrar' ? ' elegido' : ''}`} onClick={() => elegir('por_cobrar')}>
            <span>Fiado por cobrar</span><strong>S/ {dinero(c.fiado)}</strong>
            <small>{c.fiadoClientes === 0 ? 'nadie te debe' : `${c.fiadoClientes} ${c.fiadoClientes === 1 ? 'cliente' : 'clientes'} · en Cobros y pagos`}</small>
          </button>
          <button type="button" className={`cmp-mes-dato${estado === 'pedidos' ? ' elegido' : ''}`} onClick={() => elegir('pedidos')}>
            <span>Por entregar</span><strong>{c.pedidos}</strong>
            <small>{c.pedidos === 0 ? 'nada separado' : `S/ ${dinero(c.pedidosMonto)} · stock separado`}</small>
          </button>
          <button type="button" className={`cmp-mes-dato${estado === 'convertidas' ? ' elegido' : ''}`} onClick={() => elegir('convertidas')}>
            <span>Convertidas</span><strong>{c.convertidasMes}</strong><small>a boleta o factura este mes</small>
          </button>
        </div>
      )}

      <div className="lst-caja">
        <div className="lst-filtros nv-filtros">
          <label className="lst-buscar"><span className="solo-lector">Buscar</span>
            <input type="search" value={q} placeholder="Cliente, N.º de nota o producto" onChange={e => setQ(e.target.value)} /></label>
          <FiltroFechas desde={desde} hasta={hasta} onDesde={v => { setDesde(v); setPagina(1) }} onHasta={v => { setHasta(v); setPagina(1) }} />
        </div>
        <div className="cmp-chips" role="group" aria-label="Qué ver">
          {CHIPS.map(([v, t]) => (
            <button key={v} type="button" className={estado === v ? 'cmp-chip elegido' : 'cmp-chip'} aria-pressed={estado === v} onClick={() => elegir(v)}>{t}</button>
          ))}
        </div>

        {fallo && <div className="relleno"><Aviso>{fallo}</Aviso></div>}
        {!datos && !fallo && <div className="relleno"><Cargando /></div>}
        {datos && (datos.filas.length === 0 ? (
          <div className="relleno">
            <Vacio>
              {buscar ? `Nada con «${buscar}».`
                : estado === 'por_cobrar' ? 'Nadie te debe por notas de venta.'
                : estado === 'pedidos' ? 'No hay pedidos por entregar.'
                : estado !== 'todas' ? 'No hay notas con ese filtro.'
                : 'Todavía no hay notas de venta. Usa «Nueva nota de venta» para vender al fiado o separar un pedido.'}
            </Vacio>
          </div>
        ) : (
          <div className="bloque sin-relleno lst-tabla">
            <div className="tabla-envoltura">
              <table className="tabla lst tabla-clic">
                <thead><tr>
                  <th>Fecha</th><th>Cliente</th><th className="derecha">Total</th><th>Estado</th><th>Boleta / factura</th>
                </tr></thead>
                <tbody>
                  {datos.filas.map(n => (
                    <tr key={n.id} onClick={() => navegar(`/facturacion/notas-venta/${n.id}`)}>
                      <td className="sin-corte"><div className="principal">{enLima(n.fecha)}</div><div className="secundario mono">{n.numero}</div></td>
                      <td className="lst-nombre"><div className="principal" title={n.cliente}>{n.cliente}</div>
                        <div className="secundario">{detalleNota(n)}</div></td>
                      <td className="derecha lst-precio">
                        S/ {dinero(n.total)}
                        {n.saldo > 0 && n.pagado > 0 && <div className="secundario">debe {dinero(n.saldo)}</div>}
                      </td>
                      <td><span className={`ddu-estado ${claseEstado[n.estado]}`}>{NOMBRE_ESTADO[n.estado]}</span>
                        {n.estado === 'convertida' && n.saldo > 0 && <div className="secundario">debe S/ {dinero(n.saldo)}</div>}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {n.documentoId
                          ? <Link className="mono nv-doc" to={`/facturacion/comprobantes/${n.documentoId}`}>{n.documento}</Link>
                          : n.estado === 'anulada' ? <span className="secundario">—</span>
                          : emite && <Link className="boton secundario nv-convertir" to={`/facturacion/notas-venta/${n.id}`}>Convertir</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      {datos && datos.filas.length > 0 && (
        <Paginacion total={datos.total} pagina={datos.pagina} porPagina={datos.porPagina} onCambiar={setPagina}
                    onPorPagina={n => { setPorPagina(n); setPagina(1) }} />
      )}
      <p className="nota ddu-nota">
        Una nota de venta no reemplaza a la boleta o factura ante SUNAT: si el cliente pide comprobante, conviértela. Nada se borra: una nota
        se anula con motivo.
      </p>
    </div>
  )
}