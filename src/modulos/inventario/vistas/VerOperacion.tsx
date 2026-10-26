import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { fecha } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { cantidad, inventarioServicio, PREFIJO_OPERACION, type Operacion } from '../servicios/inventarioServicio'
import '../inventario.css'

const numero = (s: string) => { const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN }

/**
 * 052 — UNA OPERACIÓN DE INVENTARIO: ingreso, ajuste, stock inicial o conteo.
 * El ingreso y el ajuste se pueden ANULAR (el movimiento contrario). El conteo
 * abierto se llena aquí y se cierra: ajusta cada diferencia con el stock de
 * ese momento.
 */
export function VerOperacion() {
  const { id = '' } = useParams()
  const mensaje = useMensaje()
  const { puede } = useSesion()
  const [o, setO] = useState<Operacion>()
  const [error, setError] = useState<string>()
  const [recargar, setRecargar] = useState(0)
  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [contado, setContado] = useState<Record<string, string>>({})

  useEffect(() => {
    let vivo = true
    inventarioServicio.operacion(id)
      .then(r => {
        if (!vivo) return
        setO(r); setError(undefined)
        setContado(Object.fromEntries(r.lineas.map(l => [l.productoId, l.contado === null ? '' : String(l.contado)])))
      })
      .catch(e => { if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar.') })
    return () => { vivo = false }
  }, [id, recargar])

  if (error) return <Aviso>{error}</Aviso>
  if (!o) return <Cargando />

  const conteoAbierto = o.tipo === 'conteo' && o.estado === 'abierto'
  const puedeAnular = (o.tipo === 'ingreso' && puede(Permisos.Inventario.Ingresar)) || (o.tipo === 'ajuste' && puede(Permisos.Inventario.Ajustar))
  const negativosSiAnula = o.lineas.filter(l => l.quedariaSiAnula < 0)
  const volver = o.tipo === 'ingreso' ? { a: '/inventario/ingresos', texto: 'Ingresos por compra' } : { a: '/inventario/ajustes', texto: 'Ajustes y conteos' }

  async function anular() {
    setOcupado(true)
    try {
      const r = await inventarioServicio.anular(o!.id, motivo.trim())
      mensaje.bien(r.mensaje); setAnulando(false); setRecargar(n => n + 1)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo anular.')
    } finally { setOcupado(false) }
  }

  const lineasConteo = () => o!.lineas.map(l => ({ productoId: l.productoId, contado: contado[l.productoId]?.trim() ? numero(contado[l.productoId]) : null }))
  const malConteo = Object.values(contado).some(v => v.trim() !== '' && !(numero(v) >= 0))

  async function guardarConteo(cerrar: boolean) {
    if (malConteo) { mensaje.error('Lo contado tiene que ser un número (0 o más).'); return }
    setOcupado(true)
    try {
      await inventarioServicio.guardarConteo(o!.id, lineasConteo())
      if (cerrar) {
        const r = await inventarioServicio.cerrarConteo(o!.id)
        mensaje.bien(r.mensaje)
      } else mensaje.bien('Conteo guardado. Sigue abierto.')
      setRecargar(n => n + 1)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar el conteo.')
    } finally { setOcupado(false) }
  }

  async function descartar() {
    setOcupado(true)
    try {
      const r = await inventarioServicio.descartarConteo(o!.id)
      mensaje.bien(r.mensaje); setRecargar(n => n + 1)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo descartar.')
    } finally { setOcupado(false) }
  }

  return (
    <>
      <Link to={volver.a} className="enlace-volver">← {volver.texto}</Link>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">
            {PREFIJO_OPERACION[o.tipo]} <span className={`mono${o.estado === 'anulada' ? ' tachado' : ''}`}>{o.codigo}</span>
          </h1>
          <p className="secundario">
            {fecha(o.fecha)} · {o.sucursal}{o.usuario && <> · {o.usuario}</>}
            {o.tipo === 'ajuste' && o.motivoNombre && <> · {o.motivoNombre}</>}
          </p>
        </div>
        {o.estado === 'registrada' && puedeAnular && (
          <Boton estilo="peligro" onClick={() => setAnulando(true)}>{o.tipo === 'ingreso' ? 'Anular ingreso' : 'Anular ajuste'}</Boton>
        )}
      </div>

      {o.estado === 'anulada' && (
        <Aviso tono="ojo">Anulado{o.anuladaEn && <> el {new Date(o.anuladaEn).toLocaleDateString('es-PE')}</>}: {o.anuladaMotivo}. Se hizo el movimiento contrario; queda en el kardex.</Aviso>
      )}

      {(o.proveedor || o.documentoProveedor || o.nota) && (
        <div className="bloque">
          {o.proveedor && <p className="parrafo"><strong>{o.proveedor.razonSocial}</strong> · <span className="mono">{o.proveedor.numeroDocumento}</span></p>}
          {o.documentoProveedor && <p className="parrafo">Su factura: <span className="mono">{o.documentoProveedor}</span></p>}
          {o.nota && <p className="parrafo">{o.nota}</p>}
        </div>
      )}

      <div className="bloque sin-relleno">
        <table className="tabla inv-lineas">
          <thead>
            <tr>
              <th>Producto</th>
              {o.tipo === 'conteo' ? (
                <><th className="num">Sistema</th><th className="num">Contado</th><th className="num">Diferencia</th></>
              ) : o.tipo === 'stock_inicial' ? (
                <><th className="num">Había</th><th className="num">Cargado</th></>
              ) : (
                <><th className="num">{o.tipo === 'ingreso' ? 'Llegó' : 'Entra (+) / sale (−)'}</th>
                  {o.tipo === 'ingreso' && <th className="num">Costo unit.</th>}</>
              )}
              <th className="num">Hay ahora</th>
            </tr>
          </thead>
          <tbody>
            {o.lineas.map(l => {
              const sistema = conteoAbierto ? l.fisicoAhora : l.sistema ?? 0
              const c = contado[l.productoId] ?? ''
              const dif = conteoAbierto ? (c.trim() && numero(c) >= 0 ? numero(c) - sistema : null) : l.contado !== null ? l.cantidad : null
              return (
                <tr key={l.productoId}>
                  <td>
                    <div className="principal">{l.descripcion}</div>
                    <div className="secundario mono">{l.codigo} · {l.unidad}</div>
                    {l.lote && <div className="secundario">Lote <span className="mono">{l.lote}</span>{l.vence && <> · vence {l.vence}</>}</div>}
                    {/* 061: comprado en cajas: lo que decía el comprobante del proveedor. */}
                    {l.presentacion && l.cantidadPresentacion != null && (
                      <div className="secundario">
                        {cantidad(l.cantidadPresentacion)} × {l.presentacion}
                        {l.costoPresentacion != null && <> a {l.costoPresentacion.toFixed(2)} c/u</>}
                      </div>
                    )}
                  </td>
                  {o.tipo === 'conteo' ? (
                    <>
                      <td className="num mono">{cantidad(sistema)}</td>
                      <td className="num">
                        {conteoAbierto && puede(Permisos.Inventario.Contar)
                          ? <input className="cantidad mono" inputMode="decimal" value={c} placeholder="sin contar"
                                   aria-label={`Contado de ${l.descripcion}`} aria-invalid={c.trim() !== '' && !(numero(c) >= 0)}
                                   onChange={e => setContado(x => ({ ...x, [l.productoId]: e.target.value }))} />
                          : <span className="mono">{l.contado === null ? '—' : cantidad(l.contado)}</span>}
                      </td>
                      <td className={`num mono${dif === null ? '' : dif < 0 ? ' inv-mal' : dif > 0 ? ' inv-bien' : ''}`}>
                        {dif === null ? '—' : `${dif > 0 ? '+' : ''}${cantidad(dif)}`}
                      </td>
                    </>
                  ) : o.tipo === 'stock_inicial' ? (
                    <><td className="num mono">{cantidad(l.sistema)}</td><td className="num mono">{cantidad(l.cantidad)}</td></>
                  ) : (
                    <>
                      <td className="num mono">{o.tipo === 'ajuste' && l.cantidad > 0 ? '+' : ''}{cantidad(l.cantidad)}</td>
                      {o.tipo === 'ingreso' && <td className="num mono">{l.costoUnitario !== null ? l.costoUnitario.toFixed(2) : '—'}</td>}
                    </>
                  )}
                  <td className="num mono">{cantidad(l.fisicoAhora)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {conteoAbierto && puede(Permisos.Inventario.Contar) && (
        <>
          <p className="nota se-aplica">
            Se aplica: lo que dejes «sin contar» queda como está. Al cerrar, la diferencia se calcula con el stock de ese momento:
            cuenta cuando no haya ventas en camino de esa sucursal.
          </p>
          <div className="inv-pie">
            <Boton estilo="plano" onClick={() => void descartar()} disabled={ocupado}>Descartar conteo</Boton>
            <Boton estilo="secundario" onClick={() => void guardarConteo(false)} ocupado={ocupado}>Guardar y seguir</Boton>
            <Boton onClick={() => void guardarConteo(true)} ocupado={ocupado} textoOcupado="Cerrando…">Cerrar conteo y ajustar</Boton>
          </div>
        </>
      )}

      <Dialogo titulo={`Anular ${o.codigo}`} abierto={anulando} onCerrar={() => setAnulando(false)}
        acciones={<>
          <Boton estilo="secundario" onClick={() => setAnulando(false)}>Cancelar</Boton>
          <Boton estilo="peligro" onClick={() => void anular()} ocupado={ocupado} disabled={motivo.trim().length < 3}>Anular</Boton>
        </>}>
        <p className="parrafo">No se borra: se hace el movimiento contrario, con el motivo, y queda en el kardex y en la bitácora.</p>
        {negativosSiAnula.length > 0 && (
          <Aviso tono="ojo">
            Ya se vendió parte: {negativosSiAnula.map(l => `${l.descripcion} quedaría en ${cantidad(l.quedariaSiAnula)}`).join(' · ')}.
          </Aviso>
        )}
        <label className="campo">
          <span className="etiqueta">¿Por qué se anula?</span>
          <input value={motivo} maxLength={250} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: se registró dos veces" autoFocus />
        </label>
      </Dialogo>
    </>
  )
}