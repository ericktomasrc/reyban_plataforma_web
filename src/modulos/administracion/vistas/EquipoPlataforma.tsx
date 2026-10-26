import { useCallback, useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { equipoServicio, type EquipoPlataforma, type MiembroEquipo } from '../servicios/equipoServicio'

const fecha = (iso: string) => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * 067 — EL EQUIPO DE LA PLATAFORMA. Soporte, ventas o contabilidad entran al
 * panel con solo una parte de los permisos. El dueño (con todo) siempre queda.
 * Cada pantalla y cada acción del servidor pide su permiso.
 */
export function EquipoPlataformaPagina() {
  const mensaje = useMensaje()
  const { pedir, dialogo: confirmacion } = useConfirmar()
  const [datos, setDatos] = useState<EquipoPlataforma>()
  const [error, setError] = useState<string>()
  const [editando, setEditando] = useState<MiembroEquipo | 'nuevo'>()

  const cargar = useCallback(async () => {
    try { setDatos(await equipoServicio.leer()); setError(undefined) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el equipo.') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const nombre = (c: string) => datos?.permisos.find(p => p.codigo === c)?.descripcion ?? c

  async function accion(m: MiembroEquipo, que: 'desactivar' | 'reactivar' | 'reenviar') {
    if (que === 'desactivar' && !(await pedir({
      titulo: `¿Quitar a ${m.nombre} del equipo?`,
      mensaje: 'Ya no podrá entrar a la plataforma y se cierran sus sesiones. Su historial se conserva y se puede volver a activar.',
      confirmar: 'Quitar del equipo', tono: 'peligro',
    }))) return
    try {
      const r = await equipoServicio[que](m.id)
      mensaje.bien(r.mensaje)
      void cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo.')
    }
  }

  if (error) return <Aviso>{error}</Aviso>
  if (!datos) return <Cargando />

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Equipo de la plataforma</h1>
          <p className="secundario">
            Quiénes administran la plataforma y qué pueden hacer. El <strong>dueño</strong> puede todo; los demás, solo
            lo que se les marque (por ejemplo, soporte: ver empresas y «ver como»).
          </p>
        </div>
        <Boton onClick={() => setEditando('nuevo')}>Sumar a alguien</Boton>
      </div>

      <div className="bloque sin-relleno">
        <table className="tabla">
          <thead><tr><th>Persona</th><th>Puede</th><th>Último ingreso</th><th /></tr></thead>
          <tbody>
            {datos.gente.map(m => (
              <tr key={m.id} className={m.activo ? undefined : 'apagada'}>
                <td>
                  <div className="principal">{m.nombre}{m.yo && <span className="secundario"> (tú)</span>}</div>
                  <div className="secundario">{m.correo}{!m.activo && ' · desactivado'}{m.activo && !m.dosfaActivo && ' · aún no entra (invitación pendiente)'}</div>
                </td>
                <td>
                  {m.duenio
                    ? <span className="etiqueta acento">Dueño · todo</span>
                    : (m.permisos ?? []).length === 0
                      ? <span className="secundario">Solo mirar las empresas</span>
                      : <ul className="lista-permisos">{(m.permisos ?? []).map(p => <li key={p}>{nombre(p)}</li>)}</ul>}
                </td>
                <td className="secundario">{m.ultimoIngresoEn ? fecha(m.ultimoIngresoEn) : '—'}</td>
                <td>
                  {!m.yo && (datos.soyDuenio || !m.duenio) && (
                    <div className="acciones-equipo">
                      {m.activo && <button type="button" className="enlace" onClick={() => setEditando(m)}>Permisos</button>}
                      {m.activo && !m.dosfaActivo && <button type="button" className="enlace" onClick={() => void accion(m, 'reenviar')}>Reenviar enlace</button>}
                      {m.activo
                        ? <button type="button" className="enlace" onClick={() => void accion(m, 'desactivar')}>Quitar</button>
                        : <button type="button" className="enlace" onClick={() => void accion(m, 'reactivar')}>Reactivar</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nota">Siempre queda al menos un dueño. Nadie se cambia a sí mismo, ni da un permiso que no tiene.</p>

      {editando && (
        <DialogoMiembro datos={datos} miembro={editando === 'nuevo' ? undefined : editando}
                        onCerrar={() => setEditando(undefined)}
                        onHecho={m => { setEditando(undefined); mensaje.bien(m); void cargar() }} />
      )}
      {confirmacion}
    </>
  )
}

function DialogoMiembro({ datos, miembro, onCerrar, onHecho }: {
  datos: EquipoPlataforma; miembro?: MiembroEquipo; onCerrar: () => void; onHecho: (m: string) => void
}) {
  const mensaje = useMensaje()
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [duenio, setDuenio] = useState(miembro?.duenio ?? false)
  const [marcados, setMarcados] = useState<string[]>(miembro?.permisos ?? [])
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    try {
      const permisos = duenio ? null : marcados
      const r = miembro
        ? await equipoServicio.permisos(miembro.id, permisos)
        : await equipoServicio.agregar({ nombre: nombre.trim(), correo: correo.trim(), permisos })
      onHecho(r.mensaje)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo titulo={miembro ? `Permisos de ${miembro.nombre}` : 'Sumar a alguien al equipo'} abierto onCerrar={onCerrar}
             acciones={<><Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
               <Boton ocupado={guardando} disabled={!miembro && (!nombre.trim() || !correo.trim())} onClick={() => void guardar()}>
                 {miembro ? 'Guardar' : 'Enviar invitación'}
               </Boton></>}>
      {!miembro && (
        <>
          <label className="campo"><span className="etiqueta">Nombre</span>
            <input value={nombre} autoFocus maxLength={120} onChange={e => setNombre(e.target.value)} /></label>
          <label className="campo"><span className="etiqueta">Correo</span>
            <input className="sin-mayusculas" type="email" value={correo} maxLength={200} onChange={e => setCorreo(e.target.value)} />
            <span className="pista">Le llega un enlace para crear su contraseña y su segundo factor.</span></label>
        </>
      )}
      {datos.soyDuenio && (
        <label className="casilla">
          <input type="checkbox" checked={duenio} onChange={e => setDuenio(e.target.checked)} />
          <span><strong>Dueño: puede todo</strong><em>Incluido sumar gente y cambiar permisos de otros dueños.</em></span>
        </label>
      )}
      {!duenio && (
        <div className="casillas-acceso">
          <span className="etiqueta">Qué puede hacer (además de ver la lista de empresas)</span>
          {datos.permisos.map(p => (
            <label key={p.codigo}>
              <input type="checkbox" checked={marcados.includes(p.codigo)}
                     onChange={e => setMarcados(m => e.target.checked ? [...m, p.codigo] : m.filter(x => x !== p.codigo))} />
              <span>{p.descripcion}</span>
            </label>
          ))}
        </div>
      )}
      {miembro && <p className="nota">Lo nuevo vale desde su próximo ingreso (se cierran sus sesiones abiertas).</p>}
    </Dialogo>
  )
}