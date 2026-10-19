import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { Si } from '../../../nucleo/autorizacion/Protegido'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { esFutura, fechaYHora } from '../../../nucleo/formato/fechas'
import { useCargar } from '../../../nucleo/hooks/useCargar'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion, useYo } from '../../../nucleo/sesion/SesionContexto'
import { DialogoEditarUsuario } from '../componentes/DialogoEditarUsuario'
import { DialogoRoles } from '../componentes/DialogoRoles'
import { PanelInvitar } from '../componentes/PanelInvitar'
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
 *
 * Lienzo «Cuenta Negocio», pantalla 2: la tabla a la izquierda y «Invitar a
 * alguien» a la derecha, sin diálogo. Quien nunca entró sale como
 * «Invitación enviada».
 */
export function ListaUsuarios() {
  const { usuario: yo, empresa } = useYo()
  const { puede } = useSesion()
  const { pedir, dialogo: confirmacion } = useConfirmar()

  const usuarios = useCargar<UsuarioEnLista[]>(() => usuariosServicio.listar())
  const catalogo = useCargar(() => usuariosServicio.roles())

  const [editandoRoles, setEditandoRoles] = useState<UsuarioEnLista>()
  const [editando, setEditando]           = useState<UsuarioEnLista>()
  const [menu, setMenu]                   = useState<string | null>(null)

  const mensaje = useMensaje()

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

    try {
      await usuariosServicio.desactivar(u.id)
      await usuarios.recargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : `No se pudo desactivar a ${u.nombre}.`)
    }
  }

  async function reactivar(u: UsuarioEnLista) {
    try {
      await usuariosServicio.reactivar(u.id)
      await usuarios.recargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : `No se pudo reactivar a ${u.nombre}.`)
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

    try {
      const r = await usuariosServicio.enviarEnlace(u.id)
      if (r.enviado) mensaje.bien(r.mensaje)
      else           mensaje.ojo(r.mensaje)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo enviar el enlace.')
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
      <div className="bienvenida-cabecera">
        <h1 className="titulo-pagina titulo-serif">Usuarios</h1>
        <p className="bajada-pagina">
          Las personas que trabajan en {empresa?.nombre ?? 'tu empresa'} y lo que puede hacer cada una.
          {/* 035: los roles propios. */}
          {puede(Permisos.Usuarios.RolesGestionar) && (
            <> <Link to="/usuarios/roles">Roles y permisos</Link></>
          )}
        </p>
      </div>

      {usuarios.error && <Aviso>{usuarios.error}</Aviso>}

      <div className="colaboradores">
      <div className="bloque sin-relleno lista-usuarios">
        {usuarios.datos && usuarios.datos.length > 0 ? (
          <table className="tabla">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Roles</th>
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
                      ) : u.ultimoIngresoEn === null && !soyYo ? (
                        <span className="estado aviso" title="Todavía no entró: no ha usado su enlace.">
                          Invitación enviada
                        </span>
                      ) : (
                        <span className="estado bueno">Activo</span>
                      )}
                      {/* El último ingreso, debajo del estado: una columna menos
                          para que la tabla quepa junto al panel. */}
                      {u.ultimoIngresoEn && (
                        <div className="secundario">Entró {fechaYHora(u.ultimoIngresoEn)}</div>
                      )}
                    </td>

                    <td className="acciones-bandeja">
                      {/* Nadie cambia sus propios roles ni se desactiva a sí
                          mismo. Lo impide el back; aquí solo se esconde el
                          botón para no ofrecer algo que va a fallar.

                          «Editar» queda a la vista (es lo más buscado); lo
                          demás va en «⋯» para que la tabla quepa junto al
                          panel de invitar. */}
                      {soyYo ? null : u.activo ? (
                        <>
                          <Si puede={Permisos.Usuarios.Editar}>
                            <Boton estilo="secundario" onClick={() => setEditando(u)}>Editar</Boton>
                          </Si>

                          {(puede(Permisos.Usuarios.RolesGestionar) || puede(Permisos.Usuarios.Editar)
                            || puede(Permisos.Usuarios.Desactivar)) && (
                            <div className="menu-fila">
                              <Boton estilo="secundario" aria-label={`Más acciones de ${u.nombre}`}
                                     aria-expanded={menu === u.id} onClick={() => setMenu(m => m === u.id ? null : u.id)}>⋯</Boton>
                              {menu === u.id && (
                                <div className="menu-fila-lista" role="menu">
                                  {puede(Permisos.Usuarios.RolesGestionar) && (
                                    <button type="button" role="menuitem" onClick={() => { setMenu(null); setEditandoRoles(u) }}>
                                      Cambiar rol
                                    </button>
                                  )}
                                  {puede(Permisos.Usuarios.Editar) && (
                                    <button type="button" role="menuitem" onClick={() => { setMenu(null); void enviarEnlace(u) }}>
                                      {u.ultimoIngresoEn === null ? 'Reenviar la invitación' : 'Enviar enlace de acceso'}
                                    </button>
                                  )}
                                  {puede(Permisos.Usuarios.Desactivar) && (
                                    <button type="button" role="menuitem" className="peligro"
                                            onClick={() => { setMenu(null); void desactivar(u) }}>
                                      Desactivar
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <Si puede={Permisos.Usuarios.Desactivar}>
                          <Boton estilo="secundario" onClick={() => void reactivar(u)}>
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

      {puede(Permisos.Usuarios.Crear) && (
        <PanelInvitar empresa={empresa?.nombre ?? 'tu empresa'} onCreado={() => void usuarios.recargar()} />
      )}
      </div>

      {confirmacion}

      {editando && (
        <DialogoEditarUsuario
          usuario={editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={r => {
            setEditando(undefined)

            // Si el correo cambió y el aviso a la dirección antigua no salió,
            // eso no es un error del arreglo —ya está hecho— pero quien lo
            // hizo tiene que saberlo: el dueño de la cuenta no se enteró.
            if (r.correoCambiado && !r.avisoAlAnterior) mensaje.ojo(r.mensaje)
            else                                        mensaje.bien(r.mensaje)

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