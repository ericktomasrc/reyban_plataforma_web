import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { FiltroFechas } from '../../../componentes/FiltrosComunes'
import { Paginacion } from '../../../componentes/Paginacion'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { InventarioApagado } from '../componentes/InventarioApagado'
import { useEstadoInventario } from '../componentes/usoInventario'
import { cantidad, inventarioServicio, type PaginaTraslados, type Traslado } from '../servicios/inventarioServicio'
import '../inventario.css'

const enLima = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  en_transito: { texto: '● En tránsito', clase: 'inv-bajo' },
  recibido: { texto: '● Recibido', clase: 'inv-bien' },
  con_diferencia: { texto: '● Recibido con diferencia', clase: 'inv-mal' },
  anulado: { texto: 'Anulado', clase: '' },
}

/**
 * 052 — TRASLADOS ENTRE SUCURSALES. El traslado ES la guía con motivo 04: al
 * emitirla sale del origen y queda en tránsito; el destino marca «Recibí» con
 * lo que llegó de verdad.
 */
export function Traslados() {
  const navegar = useNavigate()
  const { puede } = useSesion()
  const { estado, error: errorEstado } = useEstadoInventario()
  const [filtro, setFiltro] = useState('por_recibir')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(20)
  const [datos, setDatos] = useState<PaginaTraslados>()
  const [error, setError] = useState<string>()
  const [recibiendo, setRecibiendo] = useState<string>()
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    if (!estado?.encendido) return
    let vivo = true
    const t = setTimeout(() => {
      inventarioServicio.traslados({ filtro: filtro === 'todos' ? undefined : filtro, desde, hasta, pagina, porPagina })
        .then(r => { if (vivo) { setDatos(r); setError(undefined) } })
        .catch(e => { if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los traslados.') })
    }, 200)
    return () => { vivo = false; clearTimeout(t) }
  }, [estado, filtro, desde, hasta, pagina, porPagina, recargar])

  if (errorEstado) return <Aviso>{errorEstado}</Aviso>
  if (!estado) return <Cargando />
  if (!estado.encendido) return <InventarioApagado titulo="Traslados" />

  const chip = (f: string, texto: string, n?: number, peligro?: boolean) => (
    <button type="button" className={`chip${filtro === f ? ' elegido' : ''}${peligro ? ' chip-peligro' : ''}`}
            onClick={() => { setFiltro(f); setPagina(1) }}>
      {texto}{n !== undefined && ` (${n})`}
    </button>
  )

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Traslados</h1>
          <p className="secundario">
            Mover mercadería de una sucursal a otra. El traslado ES la guía de remisión con motivo «Traslado entre
            establecimientos de la misma empresa» (04): no hay que hacer dos cosas.
          </p>
        </div>
        {puede(Permisos.Guias.Emitir) && <Boton onClick={() => navegar('/guias/nueva?motivo=04')}>Nuevo traslado</Boton>}
      </div>

      <div className="inv-pasos">
        <div><small>1 · ORIGEN</small>Emite la guía 04 con los productos. Revisa que haya disponible.</div>
        <div><small>2 · AL EMITIRLA</small>Sale del físico del origen y queda <strong>en tránsito</strong>.</div>
        <div><small>3 · DESTINO «RECIBÍ»</small>Cuenta lo que llegó; entra al físico del destino.</div>
        <div><small>4 · SI FALTA ALGO</small>La diferencia queda anotada como «faltante en traslado».</div>
      </div>

      {error && <Aviso>{error}</Aviso>}

      <div className="filtros-guias">
        <div className="chips">
          {chip('por_recibir', 'Por recibir aquí', datos?.porRecibir)}
          {chip('enviados', 'Enviados en camino')}
          {chip('recibidos', 'Recibidos')}
          {(datos?.conDiferencia ?? 0) > 0 && chip('diferencia', 'Con diferencia', datos?.conDiferencia, true)}
          {chip('todos', 'Todos')}
        </div>
      </div>
      <div className="filtros-lista">
        <FiltroFechas desde={desde} hasta={hasta} onDesde={v => { setDesde(v); setPagina(1) }} onHasta={v => { setHasta(v); setPagina(1) }} />
      </div>

      <div className="bloque sin-relleno">
        {!datos ? (
          <div className="relleno"><Cargando /></div>
        ) : datos.filas.length === 0 ? (
          <div className="relleno"><Vacio>{filtro === 'por_recibir' ? 'No hay nada en camino a tu sucursal.' : 'Ningún traslado con ese filtro.'}</Vacio></div>
        ) : (
          <table className="tabla">
            <thead><tr><th>Guía</th><th>De → a</th><th>Productos</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {datos.filas.map(t => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/guias/${t.guiaId}`} className="principal mono">{t.guiaNumero ?? '(sin número)'}</Link>
                    <div className="secundario">{t.recibidoEn ? `recibido ${enLima(t.recibidoEn)}${t.recibidoPor ? ` por ${t.recibidoPor}` : ''}` : `salió ${enLima(t.salioEn)}`}</div>
                  </td>
                  <td>{t.origen} → <strong>{t.destino}</strong></td>
                  <td>{t.productos}</td>
                  <td className={ESTADOS[t.estado]?.clase}>
                    <strong>{ESTADOS[t.estado]?.texto ?? t.estado}</strong>
                    {t.estado === 'con_diferencia' && t.recibido !== null && (
                      <div className="secundario">llegaron {cantidad(t.recibido)} · faltan {cantidad(t.enviado - t.recibido)}</div>
                    )}
                  </td>
                  <td>
                    {t.puedeRecibir
                      ? <Boton onClick={() => setRecibiendo(t.id)}>Recibí</Boton>
                      : t.estado !== 'en_transito' && <Boton estilo="plano" onClick={() => setRecibiendo(t.id)}>Ver</Boton>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {datos && (
        <Paginacion total={datos.total} pagina={datos.pagina} porPagina={datos.porPagina}
                    onCambiar={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(1) }} />
      )}

      <p className="nota se-aplica">
        Se aplica: si SUNAT rechaza la guía 04, no se mueve nada. Si se registra su anulación en SOL antes de «Recibí», la
        mercadería vuelve al origen. Solo quien trabaja en la sucursal de destino ve el botón «Recibí».
      </p>

      {recibiendo && (
        <DialogoRecibir id={recibiendo} onCerrar={() => setRecibiendo(undefined)}
                        onHecho={() => { setRecibiendo(undefined); setRecargar(n => n + 1) }} />
      )}
    </>
  )
}

const MOTIVOS: Record<string, string> = {
  merma: 'Llegó roto (merma)', perdida: 'No llegó (pérdida)', enviado_menos: 'Se envió de menos (vuelve al origen)',
}

function DialogoRecibir({ id, onCerrar, onHecho }: { id: string; onCerrar: () => void; onHecho: () => void }) {
  const mensaje = useMensaje()
  const [t, setT] = useState<Traslado>()
  const [llego, setLlego] = useState<Record<string, string>>({})
  const [motivo, setMotivo] = useState<Record<string, string>>({})
  const [nota, setNota] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string>()

  useEffect(() => {
    let vivo = true
    inventarioServicio.traslado(id)
      .then(r => {
        if (!vivo) return
        setT(r)
        setLlego(Object.fromEntries(r.lineas.map(l => [l.productoId, String(l.recibido ?? l.enviado)])))
      })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudo cargar el traslado.') })
    return () => { vivo = false }
  }, [id])

  const num = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : NaN }
  const editable = !!t?.puedeRecibir
  const malas = t?.lineas.some(l => { const n = num(llego[l.productoId]); return !(n >= 0) || n > l.enviado }) ?? true
  const sinMotivo = t?.lineas.some(l => num(llego[l.productoId]) < l.enviado && !motivo[l.productoId]) ?? false

  async function confirmar() {
    if (!t) return
    setOcupado(true)
    try {
      const r = await inventarioServicio.recibir(t.id,
        t.lineas.map(l => ({ productoId: l.productoId, recibido: num(llego[l.productoId]), motivo: motivo[l.productoId] || null })),
        nota.trim() || null)
      mensaje.bien(r.mensaje); onHecho()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo registrar la recepción.')
    } finally { setOcupado(false) }
  }

  return (
    <Dialogo titulo={t ? `${editable ? 'Recibí' : 'Traslado'} · ${t.guiaNumero}` : 'Traslado'} abierto onCerrar={onCerrar}
      acciones={editable ? <>
        <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={() => void confirmar()} ocupado={ocupado} disabled={malas || sinMotivo}>Confirmar recepción</Boton>
      </> : <Boton estilo="secundario" onClick={onCerrar}>Cerrar</Boton>}>
      {fallo ? <Aviso>{fallo}</Aviso> : !t ? <Cargando /> : (
        <>
          <p className="parrafo">{t.origen} → <strong>{t.destino}</strong>{editable && ' · escribe lo que llegó de verdad. Si todo llegó completo, no cambies nada.'}</p>
          <table className="tabla inv-lineas">
            <thead><tr><th>Producto</th><th className="num">Enviado</th><th className="num">Llegó</th><th className="num">Diferencia</th></tr></thead>
            <tbody>
              {t.lineas.map(l => {
                const n = num(llego[l.productoId])
                const falta = n >= 0 ? l.enviado - n : 0
                return (
                  <tr key={l.productoId}>
                    <td>{l.descripcion}<div className="secundario mono">{l.codigo} · {l.unidad}</div>
                      {editable && falta > 0 && (
                        <select value={motivo[l.productoId] ?? ''} aria-label="Qué pasó con lo que falta"
                                onChange={e => setMotivo(m => ({ ...m, [l.productoId]: e.target.value }))}>
                          <option value="">¿Qué pasó con lo que falta?</option>
                          {Object.entries(MOTIVOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      )}
                      {!editable && l.motivoDiferencia && <div className="secundario">{MOTIVOS[l.motivoDiferencia]}</div>}
                    </td>
                    <td className="num mono">{cantidad(l.enviado)}</td>
                    <td className="num">
                      {editable
                        ? <input className="cantidad mono" inputMode="decimal" value={llego[l.productoId] ?? ''} aria-label={`Llegó de ${l.descripcion}`}
                                 aria-invalid={!(n >= 0) || n > l.enviado}
                                 onChange={e => setLlego(x => ({ ...x, [l.productoId]: e.target.value }))} />
                        : <span className="mono">{cantidad(l.recibido)}</span>}
                    </td>
                    <td className={`num mono${falta > 0 ? ' inv-mal' : ''}`}>{falta > 0 ? `faltan ${cantidad(falta)}` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {editable && (
            <>
              <label className="campo">
                <span className="etiqueta">Nota (opcional)</span>
                <input value={nota} maxLength={250} onChange={e => setNota(e.target.value)} />
              </label>
              <p className="nota se-aplica">
                Se aplica: lo que llegó entra a {t.destino}. Lo que falta «llegó roto» o «no llegó» queda en el kardex del
                destino como faltante; «se envió de menos» vuelve al físico de {t.origen}.
              </p>
            </>
          )}
        </>
      )}
    </Dialogo>
  )
}