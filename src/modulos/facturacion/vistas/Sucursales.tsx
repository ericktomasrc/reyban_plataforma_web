import { useEffect, useMemo, useState } from 'react'
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
import type { LocalSunat, Sucursal, UsuarioSucursales } from '../servicios/facturacionServicio'

const NOMBRE_TIPO: Record<string, string> = { '01': 'Factura', '03': 'Boleta', '07': 'N. crédito', '08': 'N. débito' }

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
 * anexos). Cada uno con su código SUNAT, su dirección, sus series y sus
 * usuarios. La 0000 (domicilio fiscal) existe siempre.
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
  const [verUsuarios, setVerUsuarios] = useState(0)

  const sucursales = lista.datos?.sucursales ?? []
  const gestiona = !!lista.datos?.puedeGestionar
  const todasLasSeries = sucursales.flatMap(s => s.series.map(x => x.serie))

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
      setVerUsuarios(v => v + 1)
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

      {lista.datos && (
        <div className="bloque sin-relleno">
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Código SUNAT</th><th>Sucursal</th><th>Dirección</th><th>Series</th>
                  <th className="derecha">Usuarios</th>{gestiona && <th />}
                </tr>
              </thead>
              <tbody>
                {sucursales.map(s => (
                  <tr key={s.id} className={s.activo ? undefined : 'apagada'}>
                    <td className="mono">{s.codigo}</td>
                    <td>
                      <div className="principal">{s.nombre}</div>
                      <div className="secundario">
                        {s.esPrincipal ? 'Domicilio fiscal' : s.activo ? 'Local anexo' : <span className="estado malo">Desactivada · no emite</span>}
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
                    <td className="derecha">{s.usuarios || (s.esPrincipal || s.activo ? '' : '0')}</td>
                    {gestiona && (
                      <td className="acciones-bandeja">
                        <div className="botonera">
                          <Boton estilo="plano" onClick={() => setEditando(s)} disabled={ocupada !== null}>Editar</Boton>
                          {s.activo && (
                            <Boton estilo="plano" onClick={() => setSeries(s)} disabled={ocupada !== null}>+ Series</Boton>
                          )}
                          {!s.esPrincipal && (s.activo
                            ? <Boton estilo="plano" onClick={() => void desactivar(s)} ocupado={ocupada === s.id}>Desactivar</Boton>
                            : <Boton estilo="plano" onClick={() => void reactivar(s)} ocupado={ocupada === s.id}>Reactivar</Boton>)}
                          {!s.esPrincipal && (
                            <Boton estilo="plano" className="peligro" disabled={!s.puedeEliminar || ocupada !== null}
                                   title={s.puedeEliminar ? 'Nunca emitió: se puede eliminar' : s.motivoNoEliminar ?? undefined}
                                   onClick={() => void eliminar(s)}>
                              Eliminar
                            </Boton>
                          )}
                        </div>
                        {!s.esPrincipal && !s.puedeEliminar && s.motivoNoEliminar && (
                          <div className="secundario">{s.motivoNoEliminar}</div>
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

      {gestiona && sucursales.filter(s => s.activo).length > 1 && (
        <UsuariosPorSucursal sucursales={sucursales.filter(s => s.activo)} todas={sucursales} recargar={verUsuarios}
                             alCambiar={() => void lista.recargar()} />
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
  const visibles = filas.filter(f => f.tipo === '01' || f.tipo === '03' || notasPropias)

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


// =============================================================================
// USUARIOS POR SUCURSAL
// =============================================================================

function UsuariosPorSucursal({ sucursales, todas, recargar, alCambiar }: {
  sucursales: Sucursal[]
  /** También las desactivadas, para nombrarlas. */
  todas: Sucursal[]
  recargar: number
  alCambiar: () => void
}) {
  const mensaje = useMensaje()
  const usuarios = useCargar(() => sucursalesServicio.usuarios())
  const [editando, setEditando] = useState<UsuarioSucursales | null>(null)
  const nombres = useMemo(() => new Map(todas.map(s => [s.id, s.activo ? `${s.nombre} (${s.codigo})` : `${s.nombre} (desactivada)`])), [todas])

  useEffect(() => { if (recargar > 0) void usuarios.recargar() }, [recargar]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="bloque sin-relleno">
        <div className="relleno">
          <h2 className="subtitulo">Usuarios por sucursal</h2>
          <p className="nota">Al emitir, cada usuario solo ve las series de sus sucursales. Sin sucursales asignadas, trabaja en todas.</p>
        </div>
        {usuarios.error && <Aviso>{usuarios.error}</Aviso>}
        {usuarios.datos && (
          <table className="tabla">
            <thead><tr><th>Usuario</th><th>Sucursales</th><th /></tr></thead>
            <tbody>
              {usuarios.datos.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="principal">{u.nombre}</div>
                    <div className="secundario">{u.correo}</div>
                  </td>
                  <td>
                    {u.todas ? <span className="etiqueta acento">Todas</span>
                      : <div className="etiquetas">{u.sucursales.map(id => (
                          <span key={id} className="etiqueta">{nombres.get(id) ?? 'eliminada'}</span>
                        ))}</div>}
                  </td>
                  <td className="acciones-bandeja">
                    <Boton estilo="plano" onClick={() => setEditando(u)}>Editar</Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editando && (
        <DialogoUsuario usuario={editando} sucursales={sucursales}
          onCerrar={() => setEditando(null)}
          onListo={async m => { setEditando(null); mensaje.bien(m); await usuarios.recargar(); alCambiar() }} />
      )}
    </>
  )
}

function DialogoUsuario({ usuario, sucursales, onCerrar, onListo }: {
  usuario: UsuarioSucursales
  sucursales: Sucursal[]
  onCerrar: () => void
  onListo: (mensaje: string) => Promise<void>
}) {
  const [todas, setTodas] = useState(usuario.todas)
  const [marcadas, setMarcadas] = useState<string[]>(usuario.sucursales.filter(id => sucursales.some(s => s.id === id)))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const series = sucursales.filter(s => marcadas.includes(s.id)).flatMap(s => s.series.filter(x => x.tipo === '01' || x.tipo === '03').map(x => x.serie))

  async function guardar() {
    if (!todas && marcadas.length === 0) { setError('Marca al menos una sucursal, o elige «Todas».'); return }
    setGuardando(true); setError(null)
    try {
      await onListo((await sucursalesServicio.asignar(usuario.id, todas ? [] : marcadas)).mensaje)
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      titulo={`Editar a ${usuario.nombre}`}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void guardar()} ocupado={guardando} textoOcupado="Guardando…">Guardar</Boton>
        </>
      }
    >
      <p><strong>¿En qué sucursales trabaja?</strong></p>
      <div className="opciones-en-linea">
        <label className="casilla"><input type="radio" checked={todas} onChange={() => setTodas(true)} /> Todas</label>
        <label className="casilla"><input type="radio" checked={!todas} onChange={() => setTodas(false)} /> Solo algunas</label>
      </div>
      {!todas && (
        <div className="lista-casillas">
          {sucursales.map(s => (
            <label key={s.id} className="casilla">
              <input type="checkbox" checked={marcadas.includes(s.id)}
                     onChange={e => setMarcadas(m => e.target.checked ? [...m, s.id] : m.filter(x => x !== s.id))} />
              {' '}{s.nombre} ({s.codigo})
            </label>
          ))}
        </div>
      )}
      <p className="nota">
        {todas
          ? `Al emitir, ${usuario.nombre} ve las series de todas las sucursales.`
          : marcadas.length > 0
            ? `Al emitir, ${usuario.nombre} solo ve ${series.length > 0 ? `las series ${series.join(', ')}` : 'las series de esas sucursales'}.`
            : ''}
      </p>
      {error && <Aviso>{error}</Aviso>}
    </Dialogo>
  )
}