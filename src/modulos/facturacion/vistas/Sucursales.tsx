import { useEffect, useState } from 'react'
import { Paginacion } from '../../../componentes/Paginacion'
import { contiene, usePaginaLocal } from '../../../nucleo/hooks/usePaginaLocal'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { SelectorUbigeo, buscarUbigeo, legible } from '../../../nucleo/ubigeo/SelectorUbigeo'
import { sucursalesServicio } from '../servicios/facturacionServicio'
import type { LocalSunat, Sucursal } from '../servicios/facturacionServicio'

const NOMBRE_TIPO: Record<string, string> = { '01': 'Factura', '03': 'Boleta', '07': 'N. crédito', '08': 'N. débito', '09': 'Guía', '31': 'Guía transp.' }

/** La siguiente serie libre con ese prefijo: «F» + 3 → F002; «FC» + 2 → FC02. */
function sugerir(usadas: string[], prefijo: string, cifras: number): string {
  const forma = new RegExp(`^${prefijo}\\d{${cifras}}$`)
  let max = 0
  for (const s of usadas) if (forma.test(s)) max = Math.max(max, Number(s.slice(prefijo.length)))
  return prefijo + String(max + 1).padStart(cifras, '0')
}

function lugarDe(ubigeo: string | null): string | null {
  const u = ubigeo ? buscarUbigeo(ubigeo) : null
  return u ? `${legible(u.distrito)}, ${legible(u.provincia)} - ${legible(u.departamento)}` : null
}

/**
 * 23 OCT (044) — CONFIGURACIÓN › SUCURSALES (maqueta aprobada el 22 oct).
 *
 * Los locales del MISMO RUC, como figuran en la ficha RUC (establecimientos
 * anexos). Cada uno con su código SUNAT, su dirección, sus series y cuánta
 * gente trabaja en él. La 0000 (domicilio fiscal) existe siempre.
 *
 * 046: quién trabaja en cada sucursal ya no se elige aquí: está en la ficha de
 * cada persona (Personal de la empresa). Los botones son texto; «Eliminar» va
 * en rojo si se puede y en gris con ⓘ (y el motivo) si no.
 *
 * ELIMINAR solo si nunca tuvo movimiento; con el mínimo movimiento, el botón
 * dice por qué no y queda DESACTIVAR: deja de emitir y todo lo suyo se queda.
 */
export function Sucursales() {
  const mensaje = useMensaje()
  const { pedir, dialogo: confirmacion } = useConfirmar()
  const lista = useCargar(() => sucursalesServicio.listar())
  const [editando, setEditando] = useState<Sucursal | 'nueva' | null>(null)
  const [series, setSeries] = useState<Sucursal | null>(null)
  const [ocupada, setOcupada] = useState<string | null>(null)

  const sucursales = lista.datos?.sucursales ?? []
  const gestiona = !!lista.datos?.puedeGestionar
  const todasLasSeries = sucursales.flatMap(s => s.series.map(x => x.serie))
  // 24 oct: buscar, estado y páginas (lo más nuevo arriba lo da el servidor).
  const [q, setQ] = useState('')
  const [estadoF, setEstadoF] = useState('todos')
  const { visibles, paginacion } = usePaginaLocal(
    sucursales.filter(s => contiene(q, s.codigo, s.nombre, s.direccion, s.lugar) &&
      (estadoF === 'todos' || (estadoF === 'activas' ? s.activo : !s.activo))),
    `${q}|${estadoF}`)

  async function desactivar(s: Sucursal) {
    const seguro = await pedir({
      titulo: `Desactivar «${s.nombre}»`,
      tono: 'peligro',
      confirmar: 'Desactivar',
      mensaje: (
        <>
          <p>Deja de emitir: sus series ya no salen al hacer un comprobante.</p>
          <p><strong>Sus comprobantes y reportes se quedan</strong>, y la puedes reactivar cuando quieras.</p>
        </>
      ),
    })
    if (!seguro) return
    setOcupada(s.id)
    try {
      const r = await sucursalesServicio.desactivar(s.id)
      if (r.aviso) mensaje.ojo(`${r.mensaje} ${r.aviso}`)
      else mensaje.bien(r.mensaje)
      await lista.recargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo desactivar.')
    } finally {
      setOcupada(null)
    }
  }

  async function reactivar(s: Sucursal) {
    setOcupada(s.id)
    try {
      mensaje.bien((await sucursalesServicio.reactivar(s.id)).mensaje)
      await lista.recargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo reactivar.')
    } finally {
      setOcupada(null)
    }
  }

  async function eliminar(s: Sucursal) {
    const seguro = await pedir({
      titulo: `Eliminar «${s.nombre}» (${s.codigo})`,
      tono: 'peligro',
      confirmar: 'Eliminar',
      mensaje: (
        <>
          <p>Nunca emitió, así que no queda nada suyo: desaparece de la lista y su código {s.codigo} queda libre.</p>
          {s.series.length > 0 && <p>Sus series sin usar ({s.series.map(x => x.serie).join(', ')}) se quitan.</p>}
        </>
      ),
    })
    if (!seguro) return
    setOcupada(s.id)
    try {
      mensaje.bien((await sucursalesServicio.eliminar(s.id)).mensaje)
      await lista.recargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo eliminar.')
    } finally {
      setOcupada(null)
    }
  }

  if (lista.cargando && !lista.datos) return <Cargando />

  return (
    <>
      <div className="cabecera-bandeja">
        <div>
          <h1 className="titulo-pagina">Sucursales</h1>
          <p className="bajada-pagina">Los locales de tu empresa registrados en tu ficha RUC. Todos emiten con el mismo RUC.</p>
        </div>
        {gestiona && <Boton onClick={() => setEditando('nueva')}>Nueva sucursal</Boton>}
      </div>

      {lista.error && <Aviso>{lista.error}</Aviso>}
      {lista.datos && !lista.datos.seriesLeidas && (
        <Aviso tono="ojo">No se pudo consultar las series al servicio de facturación: pueden faltar en la lista.</Aviso>
      )}

      {lista.datos && sucursales.length > 3 && (
        <div className="filtros-lista">
          <label className="buscar"><span>Buscar</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Código, nombre o dirección" /></label>
          <label><span>Estado</span>
            <select value={estadoF} onChange={e => setEstadoF(e.target.value)}>
              <option value="todos">Todas</option><option value="activas">Activas</option><option value="inactivas">Desactivadas</option>
            </select></label>
        </div>
      )}

      {lista.datos && (
        <div className="bloque sin-relleno">
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Código SUNAT</th><th>Sucursal</th><th>Dirección</th><th>Series</th>
                  <th>Personal</th>{gestiona && <th />}
                </tr>
              </thead>
              <tbody>
                {visibles.map(s => (
                  <tr key={s.id} className={s.activo ? undefined : 'apagada'}>
                    <td className="mono">{s.codigo}</td>
                    <td>
                      <div className="principal">{s.nombre}</div>
                      <div className="secundario">
                        {s.esPrincipal ? 'Domicilio fiscal'
                          : !s.activo ? <span className="estado malo">Desactivada · no emite</span>
                          : s.documentos === 0 ? 'Local anexo · nunca emitió'
                          : `Local anexo · ${s.documentos} comprobante${s.documentos === 1 ? '' : 's'}`}
                      </div>
                    </td>
                    <td>
                      {s.direccion ?? <span className="vacio">Sin dirección</span>}
                      {s.lugar && <div className="secundario">{s.lugar}</div>}
                    </td>
                    <td>
                      {s.series.length > 0
                        ? <div className="etiquetas">{s.series.map(x => (
                            <span key={x.tipo + x.serie} className="etiqueta" title={`${NOMBRE_TIPO[x.tipo] ?? x.tipo} · va en la ${x.ultimo}`}>{x.serie}</span>
                          ))}</div>
                        : <span className="vacio">—</span>}
                    </td>
                    <td className="columna-personal">
                      <Link to="/usuarios">{s.usuarios} {s.usuarios === 1 ? 'persona' : 'personas'}</Link>
                    </td>
                    {gestiona && (
                      <td className="acciones-texto">
                        <button type="button" className="enlace" onClick={() => setEditando(s)} disabled={ocupada !== null}>Editar</button>
                        {s.activo && (
                          <>
                            <span className="separa" aria-hidden="true">·</span>
                            <button type="button" className="enlace" onClick={() => setSeries(s)} disabled={ocupada !== null}>+ Series</button>
                          </>
                        )}
                        {!s.esPrincipal && (
                          <>
                            <span className="separa" aria-hidden="true">·</span>
                            {s.activo
                              ? <button type="button" className="enlace" onClick={() => void desactivar(s)} disabled={ocupada !== null}>
                                  {ocupada === s.id ? 'Desactivando…' : 'Desactivar'}
                                </button>
                              : <button type="button" className="enlace" onClick={() => void reactivar(s)} disabled={ocupada !== null}>
                                  {ocupada === s.id ? 'Reactivando…' : 'Reactivar'}
                                </button>}
                            <span className="separa" aria-hidden="true">·</span>
                            {s.puedeEliminar
                              ? <button type="button" className="enlace peligro" title="Nunca emitió: se puede eliminar"
                                        onClick={() => void eliminar(s)} disabled={ocupada !== null}>Eliminar</button>
                              : <span className="enlace-apagado" tabIndex={0} title={s.motivoNoEliminar ?? 'No se puede eliminar'}
                                      aria-label={`Eliminar no disponible: ${s.motivoNoEliminar ?? ''}`}>Eliminar ⓘ</span>}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Paginacion {...paginacion} />

      {lista.datos && sucursales.length <= 1 && (
        <div className="bloque">
          <h2 className="subtitulo">Una empresa con un solo local no ve nada nuevo</h2>
          <p className="nota">
            La 0000 (domicilio fiscal) existe siempre, con todas tus series. Si tienes otro local declarado en SUNAT
            (tienda, almacén, oficina), agrégalo con «Nueva sucursal»: el código de establecimiento está en tu ficha RUC
            (SUNAT SOL › Consulta RUC › Establecimientos anexos).
          </p>
          <p className="nota">
            <strong>Nada se borra:</strong> una sucursal que cierra se desactiva; deja de emitir, pero sus comprobantes y
            reportes quedan. Solo una que nunca emitió se puede eliminar.
          </p>
        </div>
      )}

      {/* 046: quién emite en cada sucursal se elige en la ficha de cada persona. */}
      {lista.datos && sucursales.length > 1 && (
        <div className="bloque pie-sucursales">
          <span className="nota">Quién emite en cada sucursal se elige en la ficha de cada persona.</span>
          <Link to="/usuarios"><strong>Ir a Personal de la empresa →</strong></Link>
        </div>
      )}

      {editando && (
        <DialogoSucursal
          sucursal={editando === 'nueva' ? null : editando}
          usadas={todasLasSeries}
          onCerrar={() => setEditando(null)}
          onListo={async m => { setEditando(null); mensaje.bien(m); await lista.recargar() }} />
      )}

      {series && (
        <DialogoSeries
          sucursal={series}
          usadas={todasLasSeries}
          onCerrar={() => setSeries(null)}
          onListo={async m => { setSeries(null); mensaje.bien(m); await lista.recargar() }} />
      )}

      {confirmacion}
    </>
  )
}


// =============================================================================
// NUEVA / EDITAR
// =============================================================================

interface FilaSerie { tipo: string; titulo: string; serie: string; marcada: boolean }

function seriesSugeridas(usadas: string[]): FilaSerie[] {
  return [
    { tipo: '01', titulo: 'Factura', serie: sugerir(usadas, 'F', 3), marcada: true },
    { tipo: '03', titulo: 'Boleta', serie: sugerir(usadas, 'B', 3), marcada: true },
    { tipo: '07', titulo: 'Nota de crédito de facturas', serie: sugerir(usadas, 'FC', 2), marcada: false },
    { tipo: '07', titulo: 'Nota de crédito de boletas', serie: sugerir(usadas, 'BC', 2), marcada: false },
    { tipo: '08', titulo: 'Nota de débito de facturas', serie: sugerir(usadas, 'FD', 2), marcada: false },
    { tipo: '08', titulo: 'Nota de débito de boletas', serie: sugerir(usadas, 'BD', 2), marcada: false },
    // 050: la guía de remisión del remitente (T + 3 números). La del transportista se crea sola con su primera guía.
    { tipo: '09', titulo: 'Guía de remisión', serie: sugerir(usadas, 'T', 3), marcada: false },
  ]
}

function DialogoSucursal({ sucursal, usadas, onCerrar, onListo }: {
  sucursal: Sucursal | null
  usadas: string[]
  onCerrar: () => void
  onListo: (mensaje: string) => Promise<void>
}) {
  const nueva = sucursal === null
  const { pedir, dialogo: confirmacion } = useConfirmar()
  const [codigo, setCodigo] = useState(sucursal?.codigo ?? '')
  const [nombre, setNombre] = useState(sucursal?.nombre ?? '')
  const [direccion, setDireccion] = useState(sucursal?.direccion ?? '')
  const [ubigeo, setUbigeo] = useState(sucursal?.ubigeo ?? '')
  const [filas, setFilas] = useState<FilaSerie[]>(() => seriesSugeridas(usadas))
  const [notasPropias, setNotasPropias] = useState(false)
  const [locales, setLocales] = useState<{ cargado: boolean; locales: LocalSunat[] } | null>(null)
  const [elegido, setElegido] = useState<number | null>(null)
  const [error, setError] = useState<{ texto: string; campo?: string } | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Los locales de mi RUC según SUNAT, para no escribir la dirección.
  useEffect(() => {
    if (!nueva) return
    let vivo = true
    sucursalesServicio.localesSunat()
      .then(r => { if (vivo) setLocales(r) })
      .catch(() => { if (vivo) setLocales({ cargado: false, locales: [] }) })
    return () => { vivo = false }
  }, [nueva])

  function elegirLocal(i: number, l: LocalSunat) {
    setElegido(i)
    setDireccion(l.direccion ?? '')
    setUbigeo(l.ubigeo ?? '')
  }

  const codigoFijo = !nueva && (sucursal!.esPrincipal || !sucursal!.puedeCambiarCodigo)
  const visibles = filas.filter(f => f.tipo === '01' || f.tipo === '03' || f.tipo === '09' || notasPropias)

  async function guardar(confirmado = false) {
    setError(null)
    const c = codigo.trim()
    if (!/^\d{4}$/.test(c)) { setError({ texto: 'El código de establecimiento son 4 dígitos, como en tu ficha RUC. Ej.: 0001.', campo: 'codigo' }); return }
    if (nueva && c === '0000') { setError({ texto: 'La 0000 es el domicilio fiscal y ya existe. Los locales anexos van desde 0001.', campo: 'codigo' }); return }
    if (!nombre.trim()) { setError({ texto: 'Ponle un nombre a la sucursal. Ej.: Tienda Norte.', campo: 'nombre' }); return }
    if (direccion.trim().length < 5) { setError({ texto: 'Escribe la dirección del local (sale en sus comprobantes).', campo: 'direccion' }); return }

    const peticion = {
      codigo: c, nombre: nombre.trim(), direccion: direccion.trim(), ubigeo: ubigeo || null, confirmado,
      series: nueva ? visibles.filter(f => f.marcada && f.serie.trim()).map(f => ({ tipo: f.tipo, serie: f.serie.trim().toUpperCase() })) : undefined,
    }

    setGuardando(true)
    try {
      const r = nueva ? await sucursalesServicio.crear(peticion) : await sucursalesServicio.cambiar(sucursal!.id, peticion)
      await onListo(r.mensaje)
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'direccion_repetida') {
        setGuardando(false)
        const igual = await pedir({ titulo: 'Esa dirección ya la tiene otra sucursal', mensaje: e.message, confirmar: 'Guardar igual' })
        if (igual) await guardar(true)
        return
      }
      setError({ texto: e instanceof ErrorApi ? e.message : 'No se pudo guardar.' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      titulo={nueva ? 'Nueva sucursal' : `Editar «${sucursal!.nombre}»`}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void guardar()} ocupado={guardando} textoOcupado="Guardando…">
            {nueva ? 'Guardar sucursal' : 'Guardar'}
          </Boton>
        </>
      }
    >
      {nueva && (
        <div className="locales-sunat">
          <strong>Locales de tu RUC según SUNAT</strong>
          {locales === null ? (
            <span className="secundario">Buscando en el padrón de locales anexos…</span>
          ) : !locales.cargado ? (
            <span className="secundario">El padrón de locales anexos de SUNAT todavía no está cargado: escribe la dirección.</span>
          ) : locales.locales.length === 0 ? (
            <span className="secundario">
              SUNAT no tiene locales anexos registrados para tu RUC. Si abriste uno, decláralo primero en SUNAT: el código
              de establecimiento sale de tu ficha RUC.
            </span>
          ) : (
            <>
              <span className="secundario">Del padrón de locales anexos. Elige uno y se llena la dirección.</span>
              <div className="lista-locales" role="radiogroup">
                {locales.locales.map((l, i) => (
                  <button key={i} type="button" role="radio" aria-checked={elegido === i}
                          className={elegido === i ? 'local elegido' : 'local'}
                          disabled={!!l.yaEs} onClick={() => elegirLocal(i, l)}>
                    <span>{l.direccion}</span>
                    <span className="secundario">{l.yaEs ? `Ya es la sucursal ${l.yaEs}` : l.lugar ?? ''}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="pareja">
        <Campo etiqueta="Nombre de la sucursal" obligatorio value={nombre} maxLength={80}
               onChange={e => setNombre(e.target.value)} placeholder="Tienda Norte"
               mal={error?.campo === 'nombre'} />
        <Campo etiqueta="Código de establecimiento (SUNAT)" obligatorio value={codigo} maxLength={4}
               inputMode="numeric" disabled={codigoFijo} placeholder="0001"
               onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 4))}
               mal={error?.campo === 'codigo'}
               pista={sucursal?.esPrincipal ? 'El domicilio fiscal es siempre 0000.'
                 : codigoFijo ? 'Ya salieron comprobantes con este código: no se puede cambiar.'
                 : 'Está en tu ficha RUC (SUNAT SOL › Consulta RUC › Establecimientos anexos).'} />
      </div>

      <Campo etiqueta="Dirección" obligatorio value={direccion} maxLength={200}
             onChange={e => { setDireccion(e.target.value); setElegido(null) }}
             mal={error?.campo === 'direccion'} pista="Sale en el PDF y el ticket de los comprobantes de esta sucursal." />

      <SelectorUbigeo ubigeo={ubigeo} onCambio={v => { setUbigeo(v.ubigeo); setElegido(null) }}
                      error={error?.campo === 'ubigeo' ? error.texto : undefined} />
      {ubigeo && lugarDe(ubigeo) && <p className="pista">{lugarDe(ubigeo)} ({ubigeo})</p>}

      {nueva && (
        <div className="series-sucursal">
          <strong>Series de esta sucursal</strong>
          <span className="secundario">Se crean al guardar, en 0. Cada serie pertenece a una sola sucursal.</span>
          {visibles.map(f => {
            const i = filas.indexOf(f)
            return (
              <label key={f.titulo} className="fila-serie">
                <input type="checkbox" checked={f.marcada}
                       onChange={e => setFilas(fs => fs.map((x, k) => k === i ? { ...x, marcada: e.target.checked } : x))} />
                <span>{f.titulo}</span>
                <input className="mono" value={f.serie} maxLength={4} disabled={!f.marcada} aria-label={`Serie de ${f.titulo}`}
                       onChange={e => setFilas(fs => fs.map((x, k) => k === i ? { ...x, serie: e.target.value.toUpperCase() } : x))} />
              </label>
            )
          })}
          <label className="fila-serie">
            <input type="checkbox" checked={notasPropias} onChange={e => setNotasPropias(e.target.checked)} />
            <span>Notas de crédito y débito propias</span>
          </label>
          {!notasPropias && (
            <span className="secundario">Si no marcas notas propias, las notas de esta sucursal usan las de la empresa (FC01 / FD01…).</span>
          )}
        </div>
      )}

      {error && <Aviso>{error.texto}</Aviso>}
      {confirmacion}
    </Dialogo>
  )
}


// =============================================================================
// AGREGAR SERIES A UNA SUCURSAL QUE YA EXISTE
// =============================================================================

function DialogoSeries({ sucursal, usadas, onCerrar, onListo }: {
  sucursal: Sucursal
  usadas: string[]
  onCerrar: () => void
  onListo: (mensaje: string) => Promise<void>
}) {
  const [filas, setFilas] = useState<FilaSerie[]>(() => seriesSugeridas(usadas).map(f => ({
    ...f, marcada: (f.tipo === '01' || f.tipo === '03') && !sucursal.series.some(x => x.tipo === f.tipo),
  })))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const elegidas = filas.filter(f => f.marcada && f.serie.trim()).map(f => ({ tipo: f.tipo, serie: f.serie.trim().toUpperCase() }))
    if (elegidas.length === 0) { setError('Marca al menos una serie.'); return }
    setGuardando(true); setError(null)
    try {
      await onListo((await sucursalesServicio.agregarSeries(sucursal.id, elegidas)).mensaje)
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo agregar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      titulo={`Series de «${sucursal.nombre}»`}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void guardar()} ocupado={guardando} textoOcupado="Agregando…">Agregar</Boton>
        </>
      }
    >
      <p className="nota">
        Tiene {sucursal.series.length > 0 ? sucursal.series.map(x => x.serie).join(', ') : 'ninguna serie todavía'}.
        Las nuevas se crean en 0 y son solo de esta sucursal.
      </p>
      <div className="series-sucursal">
        {filas.map((f, i) => (
          <label key={f.titulo} className="fila-serie">
            <input type="checkbox" checked={f.marcada}
                   onChange={e => setFilas(fs => fs.map((x, k) => k === i ? { ...x, marcada: e.target.checked } : x))} />
            <span>{f.titulo}</span>
            <input className="mono" value={f.serie} maxLength={4} disabled={!f.marcada} aria-label={`Serie de ${f.titulo}`}
                   onChange={e => setFilas(fs => fs.map((x, k) => k === i ? { ...x, serie: e.target.value.toUpperCase() } : x))} />
          </label>
        ))}
      </div>
      {error && <Aviso>{error}</Aviso>}
    </Dialogo>
  )
}