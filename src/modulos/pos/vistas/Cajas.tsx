import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { Paginacion } from '../../../componentes/Paginacion'
import { Pestanas } from '../../../componentes/Pestanas'
import { TablaDatos } from '../../../componentes/TablaDatos'
import { usePestana } from '../../../nucleo/hooks/usePestana'
import { ErrorApi } from '../../../nucleo/api/errores'
import { posServicio, type DetalleCaja, type FilaCaja } from '../servicios/posServicio'
import { ArqueoSistemaTabla, TablaVentas } from './PuntoDeVenta'
import '../pos.css'

/**
 * e173 (055) — CAJAS: las aperturas y cierres (las mías, o de todas las
 * sucursales con «Ver las cajas y arqueos de todos»), y el arqueo de cada una.
 */

const dinero = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const cuando = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

export function Cajas() {
  const navegar = useNavigate()
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState<{ total: number; filas: FilaCaja[] }>()
  const [fallo, setFallo] = useState<string>()

  useEffect(() => {
    let vivo = true
    posServicio.cajas(pagina)
      .then(r => { if (vivo) { setDatos(r); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer las cajas.') })
    return () => { vivo = false }
  }, [pagina])

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Cajas</h1>
          <p className="secundario">Aperturas y cierres. Toca una para ver su arqueo, sus ventas y sus movimientos.</p>
        </div>
        <Link to="/pos" className="boton">Ir al punto de venta</Link>
      </div>
      {fallo && <Aviso>{fallo}</Aviso>}
      {!datos && !fallo && <Cargando />}
      {datos && datos.filas.length === 0 && <Vacio>Todavía no se ha abierto ninguna caja.</Vacio>}
      {datos && datos.filas.length > 0 && (
        <div className="bloque sin-relleno">
          <div className="tabla-envoltura">
            <table className="tabla tabla-clic">
              <thead>
                <tr>
                  <th>Sucursal · caja</th><th>Quién</th><th>Abrió</th><th>Cerró</th>
                  <th className="derecha">Ventas</th><th className="derecha">Vendido</th>
                  <th className="derecha">Efectivo esperado</th><th className="derecha">Contado</th><th className="derecha">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {datos.filas.map(f => (
                  <tr key={f.id} onClick={() => navegar(`/pos/cajas/${f.id}`)}>
                    <td><div className="principal">{f.caja}</div><div className="secundario">{f.sucursal}</div></td>
                    <td>{f.usuario}</td>
                    <td className="secundario sin-corte">{cuando(f.abiertaEn)}</td>
                    <td className="sin-corte">{f.cerradaEn ? <span className="secundario">{cuando(f.cerradaEn)}</span> : <span className="texto-bien">● Abierta</span>}</td>
                    <td className="derecha">{f.ventas}</td>
                    <td className="derecha mono">{dinero(f.vendido)}</td>
                    <td className="derecha mono">{f.esperado != null ? dinero(f.esperado) : '—'}</td>
                    <td className="derecha mono">{f.contado != null ? dinero(f.contado) : '—'}</td>
                    <td className={`derecha mono${f.diferencia ? ' texto-mal' : ''}`}>{f.diferencia != null ? dinero(f.diferencia) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {datos.total > 20 && <div className="lineas-pie"><Paginacion total={datos.total} pagina={pagina} porPagina={20} onCambiar={setPagina} /></div>}
        </div>
      )}
    </>
  )
}

export function VerCaja() {
  const { id } = useParams()
  const [ver, setVer] = usePestana(['ventas', 'movimientos'] as const)
  const [d, setD] = useState<DetalleCaja>()
  const [fallo, setFallo] = useState<string>()

  useEffect(() => {
    if (!id) return
    posServicio.caja(id).then(setD).catch(e => setFallo(e instanceof ErrorApi ? e.message : 'No se pudo leer la caja.'))
  }, [id])

  if (fallo) return <Aviso>{fallo}</Aviso>
  if (!d) return <Cargando />
  const s = d.sesion
  // Cerrada: lo que dijo el sistema al cerrar (no cambia después).
  const arqueo = s.resumen ?? d.arqueo
  const esperado = s.esperado ?? d.esperado

  return (
    <div className="pos-arqueo">
      <Link to="/pos/cajas" className="enlace-volver no-imprimir">← Cajas</Link>
      <div className="encabezado-pagina">
        <div>
          <p className="vc-tipo">Arqueo de caja</p>
          <h1 className="titulo-pagina">{s.caja} · {s.sucursal}</h1>
          <p className="secundario">
            {s.usuario} · abrió {cuando(s.abiertaEn)}
            {s.cerradaEn ? <> · cerró {cuando(s.cerradaEn)}{s.cerradaPor && s.cerradaPor !== s.usuario && <> ({s.cerradaPor})</>}</> : <> · <span className="texto-bien">sigue abierta</span></>}
          </p>
        </div>
        <Boton estilo="secundario" className="no-imprimir" onClick={() => window.print()}>Imprimir arqueo</Boton>
      </div>

      <div className="pos-cierre-cuerpo">
        <ArqueoSistemaTabla a={arqueo} esperado={esperado} />
        <section className="pos-tarjeta">
          <h2 className="pos-h2">{s.cerradaEn ? 'Lo que se contó' : 'Todavía no se cuenta'}</h2>
          {s.cerradaEn ? (
            <table className="tabla pos-calculo">
              <tbody>
                <tr><td>Efectivo esperado</td><td className="derecha mono">{dinero(esperado)}</td></tr>
                <tr><td>Efectivo contado</td><td className="derecha mono">{dinero(s.contado ?? 0)}</td></tr>
                <tr className="fila-total"><td><strong>Diferencia</strong></td>
                  <td className={`derecha mono${s.diferencia ? ' texto-mal' : ' texto-bien'}`}><strong>{dinero(s.diferencia ?? 0)}</strong></td></tr>
                {s.observacion && <tr><td colSpan={2} className="secundario">«{s.observacion}»</td></tr>}
                <tr><td>Dejó en caja</td><td className="derecha mono">{dinero(s.dejaEnCaja ?? 0)}</td></tr>
                <tr><td>Entregó / depositó</td><td className="derecha mono">{dinero(s.entrega ?? 0)}</td></tr>
              </tbody>
            </table>
          ) : <p className="nota">El efectivo esperado se va actualizando con cada venta y movimiento.</p>}
          {s.notaApertura && <p className="nota">Al abrir: «{s.notaApertura}»</p>}
        </section>
      </div>

      {/* e175: ventas e ingresos/retiros en pestañas, cada una de 20 en 20. */}
      <div className="no-imprimir">
        <Pestanas etiqueta="Caja" valor={ver} onCambio={setVer} opciones={[
          { valor: 'ventas', texto: 'Ventas', cuenta: d.ventas.length },
          { valor: 'movimientos', texto: 'Ingresos y retiros', cuenta: d.movimientos.length },
        ]} />
      </div>
      {ver === 'ventas' ? <TablaVentas d={d} /> : d.movimientos.length === 0 ? <p className="nota">Ninguno.</p> : (
        <TablaDatos filas={d.movimientos} clave={(_, i) => i} buscar={m => [m.motivo, m.detalle, m.por]} textoBuscar="Motivo o persona"
          ordenInicial={{ clave: 'hora', desc: true }}
          columnas={[
            { clave: 'hora', titulo: 'Hora', clase: 'secundario', celda: m => cuando(m.en), orden: m => m.en },
            { clave: 'tipo', titulo: 'Tipo', celda: m => m.tipo === 'ingreso' ? 'Ingreso' : 'Retiro', orden: m => m.tipo },
            { clave: 'motivo', titulo: 'Motivo', orden: m => m.motivo,
              celda: m => <>{m.motivo}{m.detalle && <div className="secundario">{m.detalle}</div>}</> },
            { clave: 'por', titulo: 'Quién', clase: 'secundario', celda: m => m.por ?? '—', orden: m => m.por },
            { clave: 'monto', titulo: 'Monto', clase: 'derecha mono', orden: m => m.monto,
              celda: m => <>{m.tipo === 'retiro' ? '−' : ''}{dinero(m.monto)}</> },
          ]} />
      )}
    </div>
  )
}