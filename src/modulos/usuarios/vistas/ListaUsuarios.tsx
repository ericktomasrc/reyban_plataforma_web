import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Si } from '../../../nucleo/autorizacion/Protegido'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { esFutura, fechaYHora } from '../../../nucleo/formato/fechas'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useSesion, useYo } from '../../../nucleo/sesion/SesionContexto'
import { DialogoAltaUsuario } from '../componentes/DialogoAltaUsuario'
import { DialogoEditarUsuario } from '../componentes/DialogoEditarUsuario'
import { DialogoRoles } from '../componentes/DialogoRoles'
import { usuariosServicio } from '../servicios/usuariosServicio'
import type { UsuarioEnLista } from '../tipos'

/**
 * La gente de una empresa y lo que puede hacer cada uno.
 *
 * ESTA PANTALLA ES DEL ADMINISTRADOR DE LA EMPRESA. El super administrador no
 * pertenece a ninguna, así que aquí no tiene nada que gestionar; se le dice y
 * no se le enseña una tabla con los usuarios de todos sus clientes mezclados.
 *
 * Ningún dato de otra empresa puede llegar a esta tabla aunque el código se
 * equivoque: el aislamiento actúa en la base, no en esta consulta.
 */
export function ListaUsuarios() {
  const { usuario: yo } = useYo()
  const { puede } = useSesion()
  const { pedir, dialogo: confirmacion } = useConfirmar()

  const usuarios = useCargar<UsuarioEnLista[]>(() => usuariosServicio.listar())
  const catalogo = useCargar(() => usuariosServicio.roles())

  const [creando, setCreando] = useState(false)

  /** El último enlace que salió, para confirmarlo sin sacar un diálogo. */
  const [aviso, setAviso] = useState<string>()

  const [editandoRoles, setEditandoRoles] = useState<UsuarioEnLista>()
  const [editando, setEditando]           = useState<UsuarioEnLista>()
  const [errorAccion, setErrorAccion] = useState<string>()

  const roles = catalogo.datos ?? []

  async function desactivar(u: UsuarioEnLista) {
    const seguro = await pedir({
      titulo: `Desactivar a ${u.nombre}`,
      confirmar: 'Desactivar',
      tono: 'peligro',
      mensaje: (
        <>
          <p>
            <strong>{u.nombre}</strong> dejará de poder entrar, y sus sesiones
            abiertas se cierran ahora mismo.
          </p>
          <p>Se puede reactivar después. No se borra nada.</p>
        </>
      ),
    })
    if (!seguro) return

    setErrorAccion(undefined)
    try {
      await usuariosServicio.desactivar(u.id)
      await usuarios.recargar()
    } catch (e) {
      setErrorAccion(e instanceof ErrorApi ? e.message : `No se pudo desactivar a ${u.nombre}.`)
    }
  }

  async function reactivar(u: UsuarioEnLista) {
    setErrorAccion(undefined)
    try {
      await usuariosServicio.reactivar(u.id)
      await usuarios.recargar()
    } catch (e) {
      setErrorAccion(e instanceof ErrorApi ? e.message : `No se pudo reactivar a ${u.nombre}.`)
    }
  }

  /**
   * Un solo botón para dos casos: reenviar la invitación a quien nunca entró,
   * y restablecer la contraseña de quien la perdió. El aviso cambia; la
   * llamada es la misma, y el correo elige su texto en el back.
   */
  async function enviarEnlace(u: UsuarioEnLista) {
    const nuevo = u.ultimoIngresoEn === null

    const seguro = await pedir({
      titulo: nuevo ? 'Reenviar la invitación' : 'Enviar un enlace de acceso',
      confirmar: nuevo ? 'Reenviar' : 'Enviar enlace',
      mensaje: nuevo ? (
        <p>
          Se le manda otra vez el enlace para elegir contraseña a{' '}
          <strong>{u.correo}</strong>. El enlace anterior deja de valer.
        </p>
      ) : (
        <>
          <p>
            Se manda a <strong>{u.correo}</strong> un enlace para elegir una
            contraseña nueva.
          </p>
          <p>
            Su contraseña actual sigue valiendo hasta que use el enlace, y su
            segundo factor se reiniciará: tendrá que escanear un QR nuevo.
          </p>
        </>
      ),
    })
    if (!seguro) return

    setErrorAccion(undefined)
    setAviso(undefined)
    try {
      const r = await usuariosServicio.enviarEnlace(u.id)
      if (r.enviado) setAviso(r.mensaje)
      else           setErrorAccion(r.mensaje)
    } catch (e) {
      setErrorAccion(e instanceof ErrorApi ? e.message : 'No se pudo enviar el enlace.')
    }
  }

  if (yo.esSuperAdmin) {
    return (
      <>
        <h1 className="titulo-pagina">Usuarios</h1>
        <div className="bloque">
          <Vacio>
            Esta pantalla gestiona la gente de una empresa, y tú no perteneces a
            ninguna. Cada empresa administra los suyos desde su propia cuenta:
            al darla de alta recibe un administrador que puede crear el resto.
          </Vacio>
        </div>
      </>
    )
  }

  if (usuarios.cargando && !usuarios.datos) return <Cargando />

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Usuarios</h1>
        <Si puede={Permisos.Usuarios.Crear}>
          <Boton onClick={() => setCreando(true)}>Crear usuario</Boton>
        </Si>
      </div>

      {usuarios.error && <Aviso>{usuarios.error}</Aviso>}
      {errorAccion && <Aviso>{errorAccion}</Aviso>}
      {aviso && <Aviso tono="bien">{aviso}</Aviso>}

      <div className="bloque sin-relleno">
        {usuarios.datos && usuarios.datos.length > 0 ? (
          <table className="tabla">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Roles</th>
                <th>Último ingreso</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>

            <tbody>
              {usuarios.datos.map(u => {
                const soyYo     = u.id === yo.id
                const bloqueado = esFutura(u.bloqueadoHasta)

                return (
                  <tr key={u.id} className={u.activo ? undefined : 'apagada'}>
                    <td>
                      <div className="principal">
                        {u.nombre}
                        {soyYo && <span className="etiqueta marca-yo">tú</span>}
                      </div>
                      <div className="secundario">{u.correo}</div>
                    </td>

                    <td>
                      {u.roles.length > 0 ? (
                        <div className="etiquetas">
                          {u.roles.map(r => (
                            <span key={r.rolId} className="etiqueta acento">{r.nombre}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="vacio">Sin rol</span>
                      )}
                    </td>

                    <td className="secundario">{fechaYHora(u.ultimoIngresoEn)}</td>

                    <td>
                      {!u.activo ? (
                        <span className="estado malo">Desactivado</span>
                      ) : bloqueado ? (
                        <span
                          className="estado aviso"
                          title={`Hasta ${fechaYHora(u.bloqueadoHasta)}`}
                        >
                          Bloqueado
                        </span>
                      ) : (
                        <span className="estado bueno">Activo</span>
                      )}
                    </td>

                    <td className="acciones">
                      {/* Nadie cambia sus propios roles ni se desactiva a sí
                          mismo. Lo impide el back; aquí solo se esconde el
                          botón para no ofrecer algo que va a fallar. */}
                      {soyYo ? null : u.activo ? (
                        <>
                          {/* Editar va primero: es lo menos delicado de la
                              fila, y lo más probable que alguien busque. */}
                          <Si puede={Permisos.Usuarios.Editar}>
                            <Boton estilo="plano" onClick={() => setEditando(u)}>
                              Editar
                            </Boton>
                          </Si>

                          <Si puede={Permisos.Usuarios.RolesGestionar}>
                            <Boton estilo="plano" onClick={() => setEditandoRoles(u)}>
                              Roles
                            </Boton>
                          </Si>

                          <Si puede={Permisos.Usuarios.Editar}>
                            <Boton estilo="plano" onClick={() => void enviarEnlace(u)}>
                              {u.ultimoIngresoEn === null ? 'Reenviar' : 'Enviar enlace'}
                            </Boton>
                          </Si>

                          <Si puede={Permisos.Usuarios.Desactivar}>
                            <Boton estilo="plano" onClick={() => void desactivar(u)}>
                              Desactivar
                            </Boton>
                          </Si>
                        </>
                      ) : (
                        <Si puede={Permisos.Usuarios.Desactivar}>
                          <Boton estilo="plano" onClick={() => void reactivar(u)}>
                            Reactivar
                          </Boton>
                        </Si>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="relleno">
            <Vacio>Todavía no hay nadie más en la empresa.</Vacio>
          </div>
        )}
      </div>

      {confirmacion}

      {puede(Permisos.Usuarios.Crear) && (
        <DialogoAltaUsuario
          abierto={creando}
          roles={roles}
          onCerrar={() => setCreando(false)}
          onCreado={datos => {
            setCreando(false)
            setAviso(datos.invitacionEnviada
              ? `${datos.nombre} ya tiene cuenta. Le mandamos el enlace a ${datos.correo}.`
              : undefined)
            setErrorAccion(datos.invitacionEnviada
              ? undefined
              : `${datos.nombre} quedó creado, pero el correo no salió. Usa «Reenviar».`)
            void usuarios.recargar()
          }}
        />
      )}

      {editando && (
        <DialogoEditarUsuario
          usuario={editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={r => {
            setEditando(undefined)
            setErrorAccion(undefined)

            // Si el correo cambió y el aviso a la dirección antigua no salió,
            // eso no es un error del arreglo —ya está hecho— pero quien lo
            // hizo tiene que saberlo: el dueño de la cuenta no se enteró.
            if (r.correoCambiado && !r.avisoAlAnterior) {
              setAviso(undefined)
              setErrorAccion(r.mensaje)
            } else {
              setAviso(r.mensaje)
            }

            void usuarios.recargar()
          }}
        />
      )}

      {editandoRoles && (
        <DialogoRoles
          usuario={editandoRoles}
          roles={roles}
          onCerrar={() => setEditandoRoles(undefined)}
          onGuardado={() => {
            setEditandoRoles(undefined)
            void usuarios.recargar()
          }}
        />
      )}
    </>
  )
}
