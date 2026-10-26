import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Aviso } from '../../componentes/Aviso'
import { Boton } from '../../componentes/Boton'
import { Cargando, Vacio } from '../../componentes/Cargando'
import { Dialogo } from '../../componentes/Dialogo'
import { Paginacion } from '../../componentes/Paginacion'
import { Pestanas } from '../../componentes/Pestanas'
import { ErrorApi } from '../../nucleo/api/errores'
import { Permisos } from '../../nucleo/autorizacion/permisos'
import { fecha } from '../../nucleo/formato/fechas'
import { usePestana } from '../../nucleo/hooks/usePestana'
import { useMensaje } from '../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../nucleo/sesion/SesionContexto'
import { consultasServicio } from '../facturacion/servicios/facturacionServicio'
import { inventarioServicio } from '../inventario/servicios/inventarioServicio'
import {
  CATEGORIAS, NOMBRE_CATEGORIA, NOMBRE_TIPO, TIPOS_COMPROBANTE, comprasServicio,
  type ClaseCompra, type Compra, type PaginaCompras,
} from './comprasServicio'

/**
 * e178 (059) — COMPRAS Y GASTOS: lo que la empresa compra y gasta, con o sin
 * inventario. Pestañas Compras · Gastos · Anuladas, de 20 en 20, con búsqueda.
 * Una compra no se borra: se anula, con motivo.
 */

const dinero = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

export function Compras() {
  const { puede } = useSesion()
  const mensaje = useMensaje()
  const registra = puede(Permisos.Compras.Registrar)
  const [ver, setVer] = usePestana(['compras', 'gastos', 'anuladas'] as const)
  const hoy = hoyLima()
  const [desde, setDesde] = useState(hoy.slice(0, 8) + '01')
  const [hasta, setHasta] = useState(hoy)
  const [q, setQ] = useState('')
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [datos, setDatos] = useState<PaginaCompras>()
  const [fallo, setFallo] = useState<string>()
  const [editando, setEditando] = useState<{ compra?: Compra; clase: ClaseCompra }>()
  const [anulando, setAnulando] = useState<Compra>()
  const [vuelta, setVuelta] = useState(0)
  const navegar = useNavigate()
  // e182: con inventario, la mercadería se ingresa al stock desde aquí.
  const [inventario, setInventario] = useState(false)
  useEffect(() => {
    inventarioServicio.estado().then(e => setInventario(e.encendido && e.contratado !== false)).catch(() => { /* sin inventario */ })
  }, [])

  useEffect(() => { const t = window.setTimeout(() => { setBuscar(q.trim()); setPagina(1) }, 400); return () => window.clearTimeout(t) }, [q])

  useEffect(() => {
    let vivo = true
    comprasServicio.listar({
      desde, hasta, q: buscar || undefined, pagina, porPagina,
      clase: ver === 'compras' ? 'compra' : ver === 'gastos' ? 'gasto' : undefined,
      estado: ver === 'anuladas' ? 'anuladas' : undefined,
    })
      .then(d => { if (vivo) { setDatos(d); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer las compras.') })
    return () => { vivo = false }
  }, [desde, hasta, buscar, pagina, porPagina, ver, vuelta])

  const recargar = () => setVuelta(v => v + 1)

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Compras y gastos</h1>
          <p className="secundario">
            Lo que compras y gastas: las facturas de tus proveedores y los gastos del día a día. Con esto salen el
            Registro de Compras y, más adelante, tu margen. <Link to="/reportes/compras">Ver el reporte</Link>
          </p>
        </div>
        {registra && (
          <div className="acciones-linea">
            <Boton estilo="secundario" onClick={() => setEditando({ clase: 'gasto' })}>+ Gasto</Boton>
            <Boton onClick={() => setEditando({ clase: 'compra' })}>+ Compra</Boton>
          </div>
        )}
      </div>

      <Pestanas etiqueta="Compras y gastos" valor={ver} onCambio={v => { setVer(v); setPagina(1) }} opciones={[
        { valor: 'compras', texto: 'Compras', cuenta: datos?.conteo.compras },
        { valor: 'gastos', texto: 'Gastos', cuenta: datos?.conteo.gastos },
        { valor: 'anuladas', texto: 'Anuladas', cuenta: datos?.conteo.anuladas, ocultarVacia: true },
      ]} />

      <div className="filtros-lista">
        <label><span>Desde</span><input type="date" value={desde} max={hasta} onChange={e => { setDesde(e.target.value); setPagina(1) }} /></label>
        <label><span>Hasta</span><input type="date" value={hasta} min={desde} max={hoy} onChange={e => { setHasta(e.target.value); setPagina(1) }} /></label>
        <label className="buscar"><span>Buscar</span>
          <input type="search" value={q} placeholder="Proveedor, RUC, número o descripción" onChange={e => setQ(e.target.value)} /></label>
      </div>

      {fallo && <Aviso>{fallo}</Aviso>}
      {!datos && !fallo && <Cargando />}
      {datos && (
        <>
          {ver !== 'anuladas' && datos.total > 0 && (
            <p className="nota">
              {datos.total} en el periodo · Base <strong className="mono">{dinero(datos.totales.base)}</strong> ·
              IGV <strong className="mono">{dinero(datos.totales.igv)}</strong> · Total <strong className="mono">S/ {dinero(datos.totales.total)}</strong>
              {' '}(en soles)
            </p>
          )}
          {datos.filas.length === 0 ? (
            <Vacio>{buscar ? `Nada con «${buscar}».` : ver === 'gastos' ? 'No hay gastos en este periodo.' : ver === 'anuladas' ? 'Ninguna anulada.' : 'No hay compras en este periodo.'}</Vacio>
          ) : (
            <div className="bloque sin-relleno">
              <div className="tabla-envoltura">
                <table className={`tabla${registra && ver !== 'anuladas' ? ' tabla-clic' : ''}`}>
                  <thead><tr><th>Fecha</th><th>Comprobante</th><th>Proveedor</th><th>Categoría</th>
                    <th className="derecha">Base</th><th className="derecha">IGV</th><th className="derecha">Total</th><th /></tr></thead>
                  <tbody>
                    {datos.filas.map(c => (
                      <tr key={c.id} onClick={registra && !c.anuladaEn ? () => setEditando({ compra: c, clase: c.clase }) : undefined}>
                        <td className="secundario sin-corte">{fecha(c.fecha)}</td>
                        <td>
                          {c.comprobanteTipo === '00' ? <span className="secundario">Sin comprobante</span>
                            : <><span className="mono">{c.serie}-{c.numero}</span><div className="secundario">{NOMBRE_TIPO[c.comprobanteTipo]}</div></>}
                        </td>
                        <td>{c.proveedorNombre ?? <span className="secundario">—</span>}
                          {c.proveedorDoc && <div className="secundario mono">{c.proveedorDoc}</div>}
                          {c.descripcion && <div className="secundario">{c.descripcion}</div>}
                          {c.ingreso && <Link className="etiqueta acento" to={`/inventario/operaciones/${c.invOperacionId}`} onClick={e => e.stopPropagation()}>✓ En stock · {c.ingreso}</Link>}
                          {!c.ingreso && !c.anuladaEn && inventario && registra && c.clase === 'compra' && c.categoria === 'mercaderia' && (
                            <button type="button" className="enlace" onClick={e => { e.stopPropagation(); navegar(`/inventario/ingresos/nuevo?compra=${c.id}`) }}>Ingresar al stock</button>
                          )}</td>
                        <td className="secundario">{NOMBRE_CATEGORIA[c.categoria] ?? c.categoria}</td>
                        <td className="derecha mono">{dinero(c.base + c.noGravado)}</td>
                        <td className="derecha mono">{dinero(c.igv)}</td>
                        <td className="derecha mono">{c.moneda === 'USD' ? 'US$ ' : ''}{dinero(c.total)}</td>
                        <td className="derecha" onClick={e => e.stopPropagation()}>
                          {c.anuladaEn
                            ? <span className="secundario" title={c.anuladaMotivo ?? ''}>Anulada · {c.anuladaMotivo}</span>
                            : registra && <button type="button" className="enlace" onClick={() => setAnulando(c)}>Anular</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="lineas-pie">
                <Paginacion total={datos.total} pagina={datos.pagina} porPagina={datos.porPagina} onCambiar={setPagina}
                            onPorPagina={n => { setPorPagina(n); setPagina(1) }} />
              </div>
            </div>
          )}
        </>
      )}

      {editando && (
        <DialogoCompra compra={editando.compra} clase={editando.clase} onCerrar={() => setEditando(undefined)}
                       onHecho={(m, id, alStock) => {
                         setEditando(undefined); mensaje.bien(alStock ? `${m} Ahora elige los productos que llegaron y sus cantidades.` : m)
                         if (alStock && id) navegar(`/inventario/ingresos/nuevo?compra=${id}`)
                         else recargar()
                       }} />
      )}
      {anulando && (
        <DialogoAnular compra={anulando} onCerrar={() => setAnulando(undefined)}
                       onHecho={m => { setAnulando(undefined); mensaje.bien(m); recargar() }} />
      )}
    </>
  )
}

function DialogoCompra({ compra, clase: claseInicial, onCerrar, onHecho }: {
  compra?: Compra; clase: ClaseCompra; onCerrar: () => void
  /** e182: `alStock` = seguir al ingreso al stock con esta compra. */
  onHecho: (m: string, id?: string, alStock?: boolean) => void
}) {
  const [clase, setClase] = useState<ClaseCompra>(compra?.clase ?? claseInicial)
  const [fechaE, setFechaE] = useState(compra?.fecha ?? hoyLima())
  const [tipo, setTipo] = useState(compra?.comprobanteTipo ?? (claseInicial === 'gasto' ? '00' : '01'))
  const [doc, setDoc] = useState(compra?.proveedorDoc ?? '')
  const [nombre, setNombre] = useState(compra?.proveedorNombre ?? '')
  const [serie, setSerie] = useState(compra?.serie ?? '')
  const [numero, setNumero] = useState(compra?.numero ?? '')
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>(compra?.moneda ?? 'PEN')
  const [tc, setTc] = useState(compra?.tipoCambio ? String(compra.tipoCambio) : '')
  const [total, setTotal] = useState(compra ? String(compra.total) : '')
  const [base, setBase] = useState(compra ? String(compra.base) : '')
  const [igv, setIgv] = useState(compra ? String(compra.igv) : '')
  const [aMano, setAMano] = useState(!!compra && Math.abs(Math.round((compra.total / 1.18) * 100) / 100 - compra.base) > 0.01)
  const [categoria, setCategoria] = useState(compra?.categoria ?? (claseInicial === 'gasto' ? 'servicios' : 'mercaderia'))
  const [descripcion, setDescripcion] = useState(compra?.descripcion ?? '')
  const [consultado, setConsultado] = useState<string>()
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()
  const [inventario, setInventario] = useState(false)
  const [alStock, setAlStock] = useState(true)

  useEffect(() => {
    inventarioServicio.estado().then(e => setInventario(e.encendido && e.contratado !== false)).catch(() => { /* sin inventario */ })
  }, [])
  const ofreceStock = inventario && clase === 'compra' && categoria === 'mercaderia' && !compra?.ingreso

  // El RUC trae la razón social de SUNAT.
  useEffect(() => {
    if (!/^(10|15|17|20)\d{9}$/.test(doc) || (compra && compra.proveedorDoc === doc)) return
    let vivo = true
    consultasServicio.ruc(doc)
      .then(f => { if (vivo && f.razonSocial) { setNombre(f.razonSocial); setConsultado('✓ Traída de SUNAT') } })
      .catch(() => { if (vivo) setConsultado('No se pudo consultar: escríbela a mano.') })
    return () => { vivo = false }
  }, [doc, compra])

  const n = (s: string) => Number(s.replace(',', '.'))
  const tot = n(total)
  const gravado = tipo === '01'
  // Una factura se parte sola en base + IGV (18 %), salvo que se escriba a mano.
  const baseCalc = gravado && !aMano ? Math.round((tot / 1.18) * 100) / 100 : n(base)
  const igvCalc = gravado && !aMano ? Math.round((tot - baseCalc) * 100) / 100 : n(igv)
  const conComprobante = tipo !== '00'

  async function guardar() {
    setOcupado(true); setFallo(undefined)
    const d = {
      clase, fecha: fechaE, comprobanteTipo: tipo, moneda, categoria,
      proveedorDoc: doc.trim() || null, proveedorNombre: nombre.trim() || null,
      serie: conComprobante ? serie.trim() || null : null, numero: conComprobante ? numero.trim() || null : null,
      tipoCambio: moneda === 'USD' ? n(tc) : null,
      total: tot,
      ...(gravado ? { base: baseCalc, igv: igvCalc, noGravado: Math.max(0, Math.round((tot - baseCalc - igvCalc) * 100) / 100) } : { base: 0, igv: 0, noGravado: tot }),
      descripcion: descripcion.trim() || null,
    }
    try {
      const r = compra ? await comprasServicio.editar(compra.id, d) : await comprasServicio.crear(d)
      onHecho(r.mensaje, r.id, ofreceStock && alStock)
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo guardar.')
    } finally { setOcupado(false) }
  }

  const listo = tot > 0 && fechaE && (!conComprobante || (doc.trim() && nombre.trim() && serie.trim() && numero.trim()))
    && (moneda === 'PEN' || n(tc) > 0)

  return (
    <Dialogo titulo={compra ? 'Corregir' : clase === 'gasto' ? 'Anotar un gasto' : 'Anotar una compra'} abierto onCerrar={onCerrar}
      acciones={<>
        <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={() => void guardar()} ocupado={ocupado} textoOcupado="Guardando…" disabled={!listo}>Guardar</Boton>
      </>}>
      <div className="segmentado" role="tablist" aria-label="Qué es">
        {(['compra', 'gasto'] as const).map(c => (
          <button key={c} type="button" role="tab" aria-selected={clase === c} className={clase === c ? 'elegido' : undefined}
                  onClick={() => { setClase(c); if (!compra) setCategoria(c === 'gasto' ? 'servicios' : 'mercaderia') }}>
            {c === 'compra' ? 'Compra' : 'Gasto'}
          </button>
        ))}
      </div>

      <div className="pareja">
        <label className="campo"><span className="etiqueta">Comprobante</span>
          <select value={tipo} onChange={e => setTipo(e.target.value)}>
            {TIPOS_COMPROBANTE.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="campo"><span className="etiqueta">Fecha de emisión</span>
          <input type="date" value={fechaE} max={hoyLima()} onChange={e => setFechaE(e.target.value)} /></label>
      </div>

      {conComprobante && (
        <>
          <div className="pareja">
            <label className="campo"><span className="etiqueta">RUC o DNI del proveedor</span>
              <input className="mono" inputMode="numeric" value={doc} maxLength={11} onChange={e => setDoc(e.target.value.replace(/\D/g, ''))} />
              {consultado && <span className="pista">{consultado}</span>}
            </label>
            <label className="campo"><span className="etiqueta">Proveedor</span>
              <input value={nombre} maxLength={200} onChange={e => setNombre(e.target.value)} /></label>
          </div>
          <div className="pareja">
            <label className="campo"><span className="etiqueta">Serie</span>
              <input className="mono" value={serie} maxLength={10} placeholder="F001" onChange={e => setSerie(e.target.value)} /></label>
            <label className="campo"><span className="etiqueta">Número</span>
              <input className="mono" inputMode="numeric" value={numero} maxLength={20} placeholder="1234" onChange={e => setNumero(e.target.value)} /></label>
          </div>
        </>
      )}

      <div className="pareja">
        <label className="campo"><span className="etiqueta">Total {gravado ? '(con IGV)' : ''}</span>
          <input className="mono" inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} /></label>
        <label className="campo"><span className="etiqueta">Moneda</span>
          <select value={moneda} onChange={e => setMoneda(e.target.value as 'PEN' | 'USD')}>
            <option value="PEN">Soles</option><option value="USD">Dólares</option>
          </select>
        </label>
      </div>
      {moneda === 'USD' && (
        <label className="campo"><span className="etiqueta">Tipo de cambio</span>
          <input className="mono" inputMode="decimal" value={tc} placeholder="3.750" onChange={e => setTc(e.target.value)} /></label>
      )}

      {gravado && tot > 0 && (
        aMano ? (
          <div className="pareja">
            <label className="campo"><span className="etiqueta">Base imponible</span>
              <input className="mono" inputMode="decimal" value={base} onChange={e => setBase(e.target.value)} /></label>
            <label className="campo"><span className="etiqueta">IGV</span>
              <input className="mono" inputMode="decimal" value={igv} onChange={e => setIgv(e.target.value)} /></label>
          </div>
        ) : (
          <p className="nota">
            Base <strong className="mono">{dinero(baseCalc)}</strong> + IGV <strong className="mono">{dinero(igvCalc)}</strong>.{' '}
            <button type="button" className="enlace" onClick={() => { setBase(String(baseCalc)); setIgv(String(igvCalc)); setAMano(true) }}>
              ¿No es así en la factura? Escríbelos
            </button>
          </p>
        )
      )}

      <label className="campo"><span className="etiqueta">Categoría</span>
        <select value={categoria} onChange={e => setCategoria(e.target.value)}>
          {CATEGORIAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
      <label className="campo"><span className="etiqueta">Descripción (opcional)</span>
        <input value={descripcion} maxLength={300} placeholder={clase === 'gasto' ? 'Ej.: Luz de octubre' : 'Ej.: 300 bolsas de cemento'} onChange={e => setDescripcion(e.target.value)} /></label>

      {ofreceStock && (
        <label className="casilla-stock">
          <input type="checkbox" checked={alStock} onChange={e => setAlStock(e.target.checked)} />
          <span>
            <strong>Además, ingresar al stock</strong>
            <em>Al guardar se abre el ingreso por compra con el proveedor y el comprobante ya puestos: solo eliges los productos y las cantidades.</em>
          </span>
        </label>
      )}
      {fallo && <Aviso>{fallo}</Aviso>}
    </Dialogo>
  )
}

function DialogoAnular({ compra, onCerrar, onHecho }: { compra: Compra; onCerrar: () => void; onHecho: (m: string) => void }) {
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()
  async function anular() {
    setOcupado(true); setFallo(undefined)
    try { onHecho((await comprasServicio.anular(compra.id, motivo.trim())).mensaje) }
    catch (e) { setFallo(e instanceof ErrorApi ? e.message : 'No se pudo anular.') }
    finally { setOcupado(false) }
  }
  return (
    <Dialogo titulo="Anular" abierto onCerrar={onCerrar}
      acciones={<>
        <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={() => void anular()} ocupado={ocupado} disabled={motivo.trim().length < 3}>Anular</Boton>
      </>}>
      <p>
        {compra.comprobanteTipo === '00' ? <>El gasto de <strong>S/ {dinero(compra.total)}</strong></>
          : <>El comprobante <strong className="mono">{compra.serie}-{compra.numero}</strong> de {compra.proveedorNombre}</>}
        {' '}deja de contar. No se borra: queda en «Anuladas».
      </p>
      <label className="campo"><span className="etiqueta">Motivo</span>
        <input value={motivo} maxLength={200} autoFocus placeholder="Ej.: se anotó dos veces" onChange={e => setMotivo(e.target.value)} /></label>
      {fallo && <Aviso>{fallo}</Aviso>}
    </Dialogo>
  )
}