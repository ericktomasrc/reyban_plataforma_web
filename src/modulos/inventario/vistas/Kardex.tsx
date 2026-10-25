import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { FiltroFechas } from '../../../componentes/FiltrosComunes'
import { Paginacion } from '../../../componentes/Paginacion'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { cantidad, inventarioServicio, NOMBRE_MOVIMIENTO, type FilaKardex, type Kardex as DatosKardex } from '../servicios/inventarioServicio'
import '../inventario.css'

const enLima = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * 052 — EL KARDEX DE UN PRODUCTO: cada entrada y salida con el documento que
 * la causó, quién la hizo y el saldo. Nada se borra: un error se corrige con
 * otro movimiento.
 */
export function Kardex() {
  const { id = '' } = useParams()
  const mensaje = useMensaje()
  const [sucursal, setSucursal] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [movimiento, setMovimiento] = useState('')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [datos, setDatos] = useState<DatosKardex>()
  const [error, setError] = useState<string>()
  const [bajando, setBajando] = useState(false)

  useEffect(() => {
    let vivo = true
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await inventarioServicio.kardex(id, { sucursalId: sucursal, desde, hasta, movimiento, pagina, porPagina })
          if (vivo) { setDatos(r); setError(undefined) }
        } catch (e) {
          if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el kardex.')
        }
      })()
    }, 200)
    return () => { vivo = false; clearTimeout(t) }
  }, [id, sucursal, desde, hasta, movimiento, pagina, porPagina])

  async function excel() {
    setBajando(true)
    try { await inventarioServicio.kardexExcel(id, { sucursalId: sucursal, desde, hasta, movimiento }) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar el Excel.') }
    finally { setBajando(false) }
  }

  const p = datos?.producto
  const variasSucursales = (datos?.sucursales.length ?? 0) > 1

  return (
    <>
      <Link to="/inventario" className="enlace-volver">← Stock</Link>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Kardex{p ? ` · ${p.descripcion}` : ''}</h1>
          {p && (
            <p className="secundario">
              <span className="mono">{p.codigo}</span> · {p.unidadMedida} · cada entrada y salida, con el documento que la causó.
              Nada se borra: un error se corrige con otro movimiento.
            </p>
          )}
        </div>
        <Boton estilo="secundario" onClick={() => void excel()} ocupado={bajando} textoOcupado="Bajando…">Descargar Excel</Boton>
      </div>

      {error && <Aviso>{error}</Aviso>}
      {p && !p.controlaStock && <Aviso tono="ojo">Este producto ya no controla stock: su kardex se guarda, pero no se mueve.</Aviso>}

      <div className="filtros-lista">
        {variasSucursales && (
          <label>
            <span>Sucursal</span>
            <select value={sucursal} onChange={e => { setSucursal(e.target.value); setPagina(1) }}>
              <option value="">Todas</option>
              {datos!.sucursales.map(s => <option key={s.id} value={s.id}>{s.codigo} {s.nombre}</option>)}
            </select>
          </label>
        )}
        <FiltroFechas desde={desde} hasta={hasta} onDesde={v => { setDesde(v); setPagina(1) }} onHasta={v => { setHasta(v); setPagina(1) }} />
        <label>
          <span>Movimiento</span>
          <select value={movimiento} onChange={e => { setMovimiento(e.target.value); setPagina(1) }}>
            <option value="">Todos</option>
            <option value="ventas">Ventas y despachos</option>
            <option value="compras">Compras</option>
            <option value="traslados">Traslados</option>
            <option value="ajustes">Ajustes, conteos y stock inicial</option>
            <option value="devoluciones">Devoluciones</option>
          </select>
        </label>
        {datos && (
          <div className="inv-resumen">
            <span>Físico <strong>{cantidad(datos.fisico)}</strong></span>
            <span>Reservado <strong className="inv-reservado">{cantidad(datos.reservado)}</strong></span>
            <span>Disponible <strong className="inv-bien">{cantidad(datos.disponible)}</strong></span>
          </div>
        )}
      </div>

      <div className="bloque sin-relleno">
        {!datos ? (
          <div className="relleno"><Cargando /></div>
        ) : datos.filas.length === 0 ? (
          <div className="relleno"><Vacio>Sin movimientos con esos filtros.</Vacio></div>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                {variasSucursales && !sucursal && <th>Sucursal</th>}
                <th>Movimiento</th><th>Documento</th><th>Quién</th>
                <th className="num">Entra</th><th className="num">Sale</th><th className="num">Saldo físico</th>
              </tr>
            </thead>
            <tbody>
              {datos.filas.map(f => <FilaMovimiento key={f.id} f={f} conSucursal={variasSucursales && !sucursal} />)}
            </tbody>
          </table>
        )}
      </div>

      {datos && (
        <Paginacion total={datos.total} pagina={datos.pagina} porPagina={datos.porPagina}
                    onCambiar={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(1) }} />
      )}

      <p className="nota se-aplica">
        Se aplica: kardex de cantidades. El costo (kardex valorizado, promedio ponderado) llega con «Inventario valorizado»;
        los costos que se anotan desde hoy en las compras ya quedan guardados para eso.
      </p>
    </>
  )
}

function FilaMovimiento({ f, conSucursal }: { f: FilaKardex; conSucursal: boolean }) {
  const soloReserva = f.cantidad === 0 && f.reservado !== 0
  const documento = f.operacionCodigo
    ? <Link to={`/inventario/operaciones/${f.operacionId}`} className="mono">{f.operacionCodigo}</Link>
    : f.fuente === 'documento' && f.documentoNumero
      ? <Link to={`/facturacion/comprobantes/${f.fuenteId}`} className="mono">{f.documentoNumero}</Link>
      : f.guiaNumero
        ? <Link to={`/guias/${f.guiaId}`} className="mono">{f.guiaNumero}</Link>
        : <span className="vacio">—</span>
  const detalle = [
    f.proveedor, f.documentoProveedor, f.motivo && f.tipo !== 'conteo' ? f.motivo.replace('_', ' ') : null, f.nota,
    f.referenciaNumero ? `de ${f.referenciaNumero}` : null,
    soloReserva ? 'no mueve el físico' : null,
  ].filter(Boolean).join(' · ')

  return (
    <tr className={soloReserva ? 'inv-reserva' : undefined}>
      <td>{enLima(f.creadoEn)}</td>
      {conSucursal && <td className="mono">{f.sucursalCodigo}</td>}
      <td className={soloReserva ? 'inv-reservado' : undefined}>
        {NOMBRE_MOVIMIENTO[f.tipo] ?? f.tipo}
        {detalle && <div className="secundario">{detalle}</div>}
      </td>
      <td>{documento}</td>
      <td>{f.usuario ?? 'sistema'}</td>
      <td className="num mono">{f.cantidad > 0 ? cantidad(f.cantidad) : ''}</td>
      <td className="num mono">
        {f.cantidad < 0 ? cantidad(-f.cantidad) : ''}
        {soloReserva && <span className="inv-reservado">({f.reservado > 0 ? '' : '−'}{cantidad(Math.abs(f.reservado))})</span>}
      </td>
      <td className={`num mono${f.saldoFisico < 0 ? ' inv-mal' : ''}`}><strong>{cantidad(f.saldoFisico)}</strong></td>
    </tr>
  )
}