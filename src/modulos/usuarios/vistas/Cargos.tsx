import { useState } from 'react'
import { Paginacion } from '../../../componentes/Paginacion'
import { contiene, usePaginaLocal } from '../../../nucleo/hooks/usePaginaLocal'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Asterisco, Campo } from '../../../componentes/Campo'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion, useYo } from '../../../nucleo/sesion/SesionContexto'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { cargosServicio } from '../servicios/cargosServicio'
import type { CargoEnLista } from '../servicios/cargosServicio'

/**
 * 047 — LA MAESTRA DE CARGOS (como «Puestos de trabajo» en Odoo).
 *
 * La misma pantalla para dos maestras distintas:
 *   · Personal › Cargos            los de la empresa abierta
 *   · Mi equipo › Cargos del estudio  los de la Cuenta Profesional (acento azul)
 *
 * En la ficha no hace falta venir aquí: al escribir un cargo nuevo se crea
 * solo. Esto es para corregir y ordenar:
 *   · Renombrar uno en uso pide motivo, y cambia todas sus fichas.
 *   · Si el puesto cambió de verdad: crear el nuevo y «Pasar a otro cargo».
 *   · No se desactiva uno que usa alguien activo. Nada se borra.
 */
export function Cargos({ deEstudio = false }: { deEstudio?: boolean }) {
  const { empresa } = useYo()
  const { puede } = useSesion()
  const mensaje = useMensaje()
  const servicio = cargosServicio(deEstudio)
  const lista = useCargar(() => servicio.listar())

  const [editando, setEditando] = useState<CargoEnLista | 'nuevo' | null>(null)
  const [pasando, setPasando] = useState<CargoEnLista | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  // Ordenar la maestra de la empresa es del administrador; la del estudio, del
  // dueño y los colaboradores administradores (lo decide la base igual).
  const ordena = deEstudio || puede(Permisos.Usuarios.RolesGestionar)
  const cargos = lista.datos ?? []
  // 24 oct: buscar, estado y páginas (lo más nuevo arriba lo da el servidor).
  const [q, setQ] = useState('')
  const [estadoF, setEstadoF] = useState('todos')
  const filtrados = cargos.filter(c => contiene(q, c.nombre) &&
    (estadoF === 'todos' || (estadoF === 'activos' ? c.activo : !c.activo)))
  const { visibles, paginacion } = usePaginaLocal(filtrados, `${q}|${estadoF}`)
  const volver = deEstudio ? '/colaboradores' : '/usuarios'

  async function activo(c: CargoEnLista, si: boolean) {
    setOcupado(c.id)
    try {
      const r = si ? await servicio.activar(c.id) : await servicio.desactivar(c.id)
      mensaje.bien(r.mensaje)
      await lista.recargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cambiar.')
    } finally {
      setOcupado(null)
    }
  }

  if (lista.cargando && !lista.datos) return <Cargando />

  return (
    <div className={deEstudio ? 'mi-equipo' : undefined}>
      <Link to={volver} className="enlace-volver">← {deEstudio ? 'Mi equipo' : 'Personal de la empresa'}</Link>

      <div className="cabecera-bandeja">
        <div>
          {deEstudio && <span className="marca-estudio">MI ESTUDIO · SOLO CUENTA PROFESIONAL</span>}
          <h1 className="titulo-pagina titulo-serif">{deEstudio ? 'Cargos del estudio' : `Cargos de ${empresa?.nombre ?? 'la empresa'}`}</h1>
          <p className="bajada-pagina">
            {deEstudio
              ? 'Los cargos de la gente de tu estudio. Son distintos de los cargos de cada empresa.'
              : 'Los cargos del personal de esta empresa.'}
            {' '}Al escribir uno nuevo en una ficha, se agrega solo; aquí se corrigen y ordenan.
          </p>
        </div>
        {ordena && <Boton onClick={() => setEditando('nuevo')}>Nuevo cargo</Boton>}
      </div>

      {lista.error && <Aviso>{lista.error}</Aviso>}

      {cargos.length > 1 && (
        <div className="filtros-lista">
          <label className="buscar"><span>Buscar</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre del cargo" /></label>
          <label><span>Estado</span>
            <select value={estadoF} onChange={e => setEstadoF(e.target.value)}>
              <option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Desactivados</option>
            </select></label>
        </div>
      )}

      <div className="bloque sin-relleno">
        {cargos.length === 0 ? (
          <div className="relleno"><Vacio>Todavía no hay cargos. Aparecen al escribirlos en la ficha de cada persona.</Vacio></div>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead><tr><th>Cargo</th><th>Personas</th><th>Estado</th>{ordena && <th />}</tr></thead>
              <tbody>
                {visibles.map(c => (
                  <tr key={c.id} className={c.activo ? undefined : 'apagada'}>
                    <td>
                      <div className="principal">{c.nombre}</div>
                      {c.motivo && <div className="secundario">Último cambio: {c.motivo}</div>}
                    </td>
                    <td>
                      {c.usos === 0 ? <span className="vacio">Nadie</span> : (
                        <span title={c.personas.map(p => p.nombre + (p.activo ? '' : ' (desactivado)')).join(', ')}>
                          {c.usos} {c.usos === 1 ? 'persona' : 'personas'}
                          {c.usos !== c.usosActivos && <span className="secundario"> · {c.usos - c.usosActivos} desactivada{c.usos - c.usosActivos === 1 ? '' : 's'}</span>}
                        </span>
                      )}
                    </td>
                    <td>{c.activo ? <span className="estado bueno">Activo</span> : <span className="estado malo">Desactivado</span>}</td>
                    {ordena && (
                      <td className="acciones-texto">
                        <button type="button" className="enlace" disabled={ocupado !== null} onClick={() => setEditando(c)}>Renombrar</button>
                        {c.usos > 0 && cargos.filter(x => x.id !== c.id && x.activo).length > 0 && (
                          <>
                            <span className="separa" aria-hidden="true">·</span>
                            <button type="button" className="enlace" disabled={ocupado !== null} onClick={() => setPasando(c)}>Pasar a otro cargo</button>
                          </>
                        )}
                        <span className="separa" aria-hidden="true">·</span>
                        {c.activo
                          ? c.usosActivos > 0
                            ? <span className="enlace-apagado" tabIndex={0}
                                    title={`Lo usa${c.usosActivos === 1 ? '' : 'n'} ${c.usosActivos} persona${c.usosActivos === 1 ? '' : 's'} activa${c.usosActivos === 1 ? '' : 's'}: pásala${c.usosActivos === 1 ? '' : 's'} primero a otro cargo.`}>
                                Desactivar ⓘ
                              </span>
                            : <button type="button" className="enlace" disabled={ocupado !== null} onClick={() => void activo(c, false)}>Desactivar</button>
                          : <button type="button" className="enlace" disabled={ocupado !== null} onClick={() => void activo(c, true)}>Reactivar</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Paginacion {...paginacion} />

      {editando && (
        <DialogoCargo cargo={editando === 'nuevo' ? null : editando} deEstudio={deEstudio}
          onCerrar={() => setEditando(null)}
          onListo={async m => { setEditando(null); mensaje.bien(m); await lista.recargar() }} />
      )}
      {pasando && (
        <DialogoPasar cargo={pasando} otros={cargos.filter(x => x.id !== pasando.id && x.activo)} deEstudio={deEstudio}
          onCerrar={() => setPasando(null)}
          onListo={async m => { setPasando(null); mensaje.bien(m); await lista.recargar() }} />
      )}
    </div>
  )
}


function DialogoCargo({ cargo, deEstudio, onCerrar, onListo }: {
  cargo: CargoEnLista | null
  deEstudio: boolean
  onCerrar: () => void
  onListo: (mensaje: string) => Promise<void>
}) {
  const servicio = cargosServicio(deEstudio)
  const [nombre, setNombre] = useState(cargo?.nombre ?? '')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<{ texto: string; campo?: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const enUso = (cargo?.usos ?? 0) > 0

  async function guardar() {
    setError(null)
    if (!nombre.trim()) { setError({ texto: 'Escribe el nombre del cargo.', campo: 'nombre' }); return }
    if (enUso && nombre.trim() !== cargo!.nombre && motivo.trim().length < 5) {
      setError({ texto: 'Escribe el motivo del cambio (por ejemplo, «estaba mal escrito»).', campo: 'motivo' }); return
    }
    setGuardando(true)
    try {
      const r = cargo ? await servicio.renombrar(cargo.id, nombre.trim(), motivo.trim() || null) : await servicio.crear(nombre.trim())
      await onListo(r.mensaje)
    } catch (e) {
      setError({ texto: e instanceof ErrorApi ? e.message : 'No se pudo guardar.', campo: e instanceof ErrorApi ? e.campo : undefined })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo titulo={cargo ? `Renombrar «${cargo.nombre}»` : 'Nuevo cargo'} abierto onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void guardar()} ocupado={guardando} textoOcupado="Guardando…">Guardar</Boton>
        </>
      }>
      <Campo etiqueta="Nombre del cargo" obligatorio value={nombre} maxLength={80} autoFocus
             onChange={e => setNombre(e.target.value)} mal={error?.campo === 'nombre'} />
      {enUso && (
        <>
          <Aviso tono="ojo">
            Lo usan <strong>{cargo!.usos} {cargo!.usos === 1 ? 'persona' : 'personas'}</strong>: el nuevo nombre se verá en sus
            fichas. Úsalo para corregir cómo está escrito. Si el puesto cambió de verdad, crea el cargo nuevo y usa
            «Pasar a otro cargo».
          </Aviso>
          <label className="campo">
            <span className="etiqueta">Motivo del cambio<Asterisco /></span>
            <input value={motivo} maxLength={300} onChange={e => setMotivo(e.target.value)} placeholder="Estaba mal escrito"
                   aria-invalid={error?.campo === 'motivo' || undefined} />
            <span className="pista">Queda en la bitácora, con quién y cuándo.</span>
          </label>
        </>
      )}
      {error && <Aviso>{error.texto}</Aviso>}
    </Dialogo>
  )
}


function DialogoPasar({ cargo, otros, deEstudio, onCerrar, onListo }: {
  cargo: CargoEnLista
  otros: CargoEnLista[]
  deEstudio: boolean
  onCerrar: () => void
  onListo: (mensaje: string) => Promise<void>
}) {
  const servicio = cargosServicio(deEstudio)
  const [hacia, setHacia] = useState(otros[0]?.id ?? '')
  const [elegidas, setElegidas] = useState<string[]>(cargo.personas.map(p => p.id))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function pasar() {
    if (!hacia) { setError('Elige a qué cargo pasan.'); return }
    if (elegidas.length === 0) { setError('Marca al menos una persona.'); return }
    setGuardando(true); setError(null)
    try {
      const todas = elegidas.length === cargo.personas.length
      await onListo((await servicio.pasar(cargo.id, hacia, todas ? null : elegidas)).mensaje)
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo pasar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo titulo={`Pasar de «${cargo.nombre}» a otro cargo`} abierto onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void pasar()} ocupado={guardando} textoOcupado="Pasando…">Pasar</Boton>
        </>
      }>
      <label className="campo">
        <span className="etiqueta">Nuevo cargo<Asterisco /></span>
        <select value={hacia} onChange={e => setHacia(e.target.value)}>
          {otros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <span className="pista">¿No está? Créalo primero con «Nuevo cargo».</span>
      </label>
      <div className="casillas-acceso">
        <span className="rotulo">Quiénes pasan</span>
        {cargo.personas.map(p => (
          <label key={p.id}>
            <input type="checkbox" checked={elegidas.includes(p.id)}
                   onChange={e => setElegidas(x => e.target.checked ? [...x, p.id] : x.filter(y => y !== p.id))} />
            <span>{p.nombre}{!p.activo && <span className="secundario"> (desactivado)</span>}</span>
          </label>
        ))}
      </div>
      <p className="nota">El cambio queda en la bitácora de cada ficha. Si nadie queda en «{cargo.nombre}», lo puedes desactivar.</p>
      {error && <Aviso>{error}</Aviso>}
    </Dialogo>
  )
}