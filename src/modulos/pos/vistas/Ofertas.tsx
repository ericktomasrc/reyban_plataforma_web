import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { NOMBRE_TIPO } from '../ofertas'
import { posServicio, type EstadoOferta, type FilaOferta, type ListaOfertas } from '../servicios/posServicio'
import '../../facturacion/comprobantes-lista.css'
import '../../deudas/deudas.css'
import '../pos.css'

/**
 * e279 (094) — PUNTO DE VENTA › OFERTAS. Vender más barato por un tiempo sin
 * cambiar el precio del producto ni el stock. La oferta se aplica sola al
 * vender en el punto de venta. Nada se borra: se pausa o se termina.
 */

const dinero = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const cant = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 2 })

const NOMBRE_ESTADO: Record<EstadoOferta, string> = { activa: 'Activa', programada: 'Programada', pausada: 'En pausa', terminada: 'Terminada' }
const CLASE_ESTADO: Record<EstadoOferta, string> = { activa: 'bien', programada: 'ojo', pausada: 'gris', terminada: 'gris' }

/** El precio normal de lo que lleva la oferta (con IGV). */
function precioNormal(f: Pick<FilaOferta, 'tipo' | 'productos'>) {
  if (f.tipo === 'pack' || f.tipo === 'cantidad') return f.productos.reduce((s, p) => s + p.precio * p.cantidad, 0)
  return f.productos[0]?.precio ?? 0
}

/** «Combo desayuno» → «Pan + leche + mantequilla · Bellavista». */
function detalle(f: FilaOferta) {
  const p = f.productos
  const que = f.tipo === 'pack' ? p.map(x => (x.cantidad !== 1 ? `${cant(x.cantidad)} ` : '') + x.descripcion).join(' + ')
    : f.tipo === 'lote' ? `${p[0]?.descripcion ?? ''} · solo lote ${f.lote}${f.loteVence ? ` · vence ${fecha(f.loteVence)}` : ''}${f.loteQuedan != null ? ` · quedan ${cant(f.loteQuedan)}` : ''}`
    : f.tipo === 'minimo' ? `${p[0]?.descripcion ?? ''} · desde ${cant(p[0]?.cantidad ?? 0)} unidades`
    : `${p[0]?.descripcion ?? ''} · ${cant(p[0]?.cantidad ?? 0)} unidades`
  return `${que} · ${f.todasSucursales ? 'todas las sucursales' : f.nombresSucursales.join(', ')}`
}

function vigencia(f: FilaOferta, hoy: string) {
  const rango = f.hasta ? `${fecha(f.desde)} – ${fecha(f.hasta)}` : `Desde ${fecha(f.desde)}`
  if (f.estadoLista !== 'activa' || !f.hasta) return { rango, nota: f.hasta ? null : 'sin fecha de fin' }
  const dias = Math.round((Date.parse(f.hasta) - Date.parse(hoy)) / 86_400_000)
  return { rango, nota: dias === 0 ? 'termina hoy' : dias === 1 ? 'queda 1 día' : `quedan ${dias} días` }
}

export function Ofertas() {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [datos, setDatos] = useState<ListaOfertas>()
  const [fallo, setFallo] = useState<string>()
  const [recargar, setRecargar] = useState(0)
  const [filtro, setFiltro] = useState<EstadoOferta | ''>('activa')
  const [q, setQ] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    posServicio.ofertas()
      .then(d => { if (vivo) { setDatos(d); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudieron leer las ofertas.') })
    return () => { vivo = false }
  }, [recargar])

  const filas = useMemo(() => {
    const t = q.trim().toLocaleLowerCase('es')
    return (datos?.filas ?? [])
      .filter(f => !filtro || f.estadoLista === filtro)
      .filter(f => !t || f.nombre.toLocaleLowerCase('es').includes(t) || f.productos.some(p => p.descripcion.toLocaleLowerCase('es').includes(t) || p.codigo.toLocaleLowerCase('es').includes(t)))
  }, [datos, filtro, q])

  async function cambiarEstado(f: FilaOferta, estado: 'activa' | 'pausada' | 'terminada') {
    const preguntas = {
      pausada: { titulo: '¿Poner en pausa la oferta?', confirmar: 'Sí, pausar', tono: 'normal' as const,
        mensaje: <p><strong>{f.nombre}</strong> deja de aplicarse en el punto de venta hasta que la reanudes. Lo vendido con ella se guarda.</p> },
      activa: { titulo: '¿Reanudar la oferta?', confirmar: 'Sí, reanudar', tono: 'normal' as const,
        mensaje: <p><strong>{f.nombre}</strong> se vuelve a aplicar sola al vender{f.hasta ? <> hasta el <strong>{fecha(f.hasta)}</strong></> : null}.</p> },
      terminada: { titulo: '¿Terminar la oferta?', confirmar: 'Sí, terminar', tono: 'peligro' as const,
        mensaje: <p><strong>{f.nombre}</strong> ya no se aplica más y no se puede reanudar. Lo vendido con ella <strong>se guarda</strong> (nada se borra). Si la quieres de nuevo, crea otra.</p> },
    }
    if (!await pedir(preguntas[estado])) return
    setOcupado(f.id)
    try { const r = await posServicio.estadoOferta(f.id, estado); mensaje.bien(r.mensaje); setRecargar(n => n + 1) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cambiar la oferta.') }
    finally { setOcupado(null) }
  }

  async function excel() {
    setOcupado('excel')
    try { await posServicio.ofertasExcel() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo bajar el Excel.') }
    finally { setOcupado(null) }
  }

  if (fallo) return <div className="pos-ofertas"><Aviso>{fallo}</Aviso></div>
  if (!datos) return <Cargando />
  const cuenta = (e: EstadoOferta | '') => datos.filas.filter(f => !e || f.estadoLista === e).length

  return (
    <div className="pos-ofertas">
      {dialogo}
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">Ofertas <span className="lst-cuenta">{datos.activas} {datos.activas === 1 ? 'activa' : 'activas'}</span></h1>
          <p className="bajada-pagina">Vende más barato por un tiempo sin cambiar el precio de tus productos. Al vender en el punto de venta, la oferta se aplica sola y sale en la boleta.</p>
        </div>
        <div className="pos-cab-acciones">
          <Boton estilo="secundario" ocupado={ocupado === 'excel'} textoOcupado="Bajando…" onClick={() => void excel()}>Descargar Excel</Boton>
          {datos.puedeCambiar && <Link className="boton" to="/pos/ofertas/nueva">Nueva oferta</Link>}
        </div>
      </div>

      <div className="cmp-mes estatico">
        <div className="cmp-mes-dato elegido"><span>Activas hoy</span><strong>{datos.activas}</strong>
          <small>{datos.terminanSemana > 0 ? `${datos.terminanSemana} ${datos.terminanSemana === 1 ? 'termina' : 'terminan'} esta semana` : 'ninguna termina esta semana'}</small></div>
        <div className="cmp-mes-dato"><span>Vendido con ofertas este mes</span><strong>S/ {dinero(datos.cobradoMes)}</strong>
          <small>{datos.ventasMes} {datos.ventasMes === 1 ? 'venta' : 'ventas'}</small></div>
        <div className={`cmp-mes-dato${datos.descuentoMes > 0 ? ' ojo' : ''}`}><span>Descuento dado este mes</span><strong>S/ {dinero(datos.descuentoMes)}</strong>
          <small>lo que dejaste de cobrar</small></div>
        <div className={`cmp-mes-dato${datos.lotesPorVencer > 0 ? ' mal' : ''}`}><span>Lotes por vencer sin oferta</span><strong>{datos.lotesPorVencer}</strong>
          <small>vencen en menos de 15 días</small></div>
      </div>

      <div className="lst-caja">
        <div className="lst-filtros">
          <label className="lst-buscar">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre de la oferta o producto" aria-label="Buscar oferta" />
          </label>
          <div className="cmp-chips pos-of-chips" role="group" aria-label="Qué ofertas ver">
            {([['activa', 'Activas'], ['programada', 'Programadas'], ['pausada', 'En pausa'], ['terminada', 'Terminadas'], ['', 'Todas']] as const).map(([v, t]) => (
              <button key={v} type="button" className={filtro === v ? 'cmp-chip elegido' : 'cmp-chip'} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>
                {t} <span className="secundario">{cuenta(v)}</span>
              </button>
            ))}
          </div>
        </div>
        {filas.length === 0 ? (
          <div className="relleno"><Vacio>
            {datos.filas.length === 0
              ? <>Todavía no tienes ofertas. Ejemplo: «2 gaseosas por S/ 16» o «pan + leche + mantequilla por S/ 20».{datos.puedeCambiar && <> <Link to="/pos/ofertas/nueva">Crear la primera</Link>.</>}</>
              : 'Ninguna oferta con ese filtro.'}
          </Vacio></div>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla lst pos-of-tabla">
              <thead><tr><th>Oferta</th><th>Tipo</th><th className="derecha">Precio normal</th><th className="derecha">Precio oferta</th><th>Vigencia</th><th className="derecha">Vendidas</th><th>Estado</th>{datos.puedeCambiar && <th />}</tr></thead>
              <tbody>
                {filas.map(f => {
                  const normal = precioNormal(f)
                  const v = vigencia(f, datos.hoy)
                  const pct = normal > 0 ? Math.round((1 - f.precio / normal) * 100) : 0
                  const porUnidad = f.tipo === 'minimo' || f.tipo === 'lote'
                  return (
                    <tr key={f.id}>
                      <td><div className="principal">{f.nombre}</div><div className="secundario">{detalle(f)}</div></td>
                      <td>{NOMBRE_TIPO[f.tipo]}</td>
                      <td className="derecha">S/ {dinero(normal)}{porUnidad && ' c/u'}</td>
                      <td className="derecha"><strong>S/ {dinero(f.precio)}{porUnidad && ' c/u'}</strong><div className="secundario">−{pct}%</div></td>
                      <td>{v.rango}{v.nota && <div className="secundario">{v.nota}</div>}</td>
                      <td className="derecha">{f.vendidas > 0 ? cant(f.vendidas) : '—'}{f.limite != null && <div className="secundario">de {cant(f.limite)}</div>}</td>
                      <td><span className={`ddu-estado ${CLASE_ESTADO[f.estadoLista]}`}>{NOMBRE_ESTADO[f.estadoLista]}</span></td>
                      {datos.puedeCambiar && (
                        <td className="acciones">
                          {f.estado !== 'terminada' && <>
                            <Link className="boton plano" to={`/pos/ofertas/${f.id}`}>Cambiar</Link>
                            {f.estado === 'pausada'
                              ? <Boton estilo="plano" disabled={ocupado !== null} onClick={() => void cambiarEstado(f, 'activa')}>Reanudar</Boton>
                              : f.estadoLista !== 'terminada' && <Boton estilo="plano" disabled={ocupado !== null} onClick={() => void cambiarEstado(f, 'pausada')}>Pausar</Boton>}
                            <Boton estilo="plano" disabled={ocupado !== null} onClick={() => void cambiarEstado(f, 'terminada')}>Terminar</Boton>
                          </>}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="nota">Una oferta no cambia el precio del producto ni el stock: solo rebaja lo que se cobra mientras está activa. Nada se borra: una oferta se pausa o se termina.</p>
    </div>
  )
}