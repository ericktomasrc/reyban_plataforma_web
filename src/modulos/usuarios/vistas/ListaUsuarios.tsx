import { useMemo, useState } from 'react'
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
import { DialogoFicha } from '../componentes/DialogoFicha'
import { NOMBRE_DOCUMENTO } from '../componentes/CamposFicha'
import { usuariosServicio } from '../servicios/usuariosServicio'
import { recuperacion2faServicio } from '../../acceso/servicios/recuperacion2faServicio'
import type { RecuperacionEnCurso } from '../../acceso/servicios/recuperacion2faServicio'
import { NOMBRE_ALCANCE } from '../tipos'
import type { UsuarioEnLista } from '../tipos'

const NIVEL: Record<string, string> = { dueno: 'Dueño', colaborador_admin: 'Colaborador administrador', colaborador: 'Colaborador' }

/**
 * 046 — PERSONAL DE LA EMPRESA (antes «Usuarios»; maqueta aprobada, pantalla 1).
 *
 * Cada persona con su ficha, su rol (qué puede hacer), su alcance (qué ve) y
 * sus sucursales. «Agregar personal» y «Editar» abren la misma ficha
 * (DialogoFicha). Las fichas de antes salen como «Ficha incompleta»: no se
 * bloquea a nadie, se completa al editar.
 *
 * El jefe de sucursal con «Agrega personal» ve aquí solo al personal de sus
 * sucursales (lo recorta la API). En una Cuenta Profesional, debajo, «Además
 * entran desde tu estudio» (solo lectura).
 *
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
  const opciones = useCargar(() => usuariosServicio.opciones())
  const estudio = useCargar(() => usuariosServicio.estudio())

  // 039: quién está recuperando su segundo factor (solo los de mi empresa).
  const recuperaciones = useCargar<RecuperacionEnCurso[]>(() => recuperacion2faServicio.enCurso())

  // 046: la ficha abierta (null = agregar).
  const [ficha, setFicha]                 = useState<UsuarioEnLista | null | undefined>(undefined)
  const [menu, setMenu]                   = useState<string | null>(null)
  const [filtro, setFiltro]               = useState<string>('todos')

  const mensaje = useMensaje()

  const sucursales = opciones.datos?.sucursales ?? []
  const nombreSucursal = useMemo(() => new Map(sucursales.map(s => [s.id, s.nombre])), [sucursales])
  const variasSucursales = (opciones.datos?.totalSucursales ?? 0) > 1

  const todos = usuarios.datos ?? []
  const visibles = todos.filter(u =>
    filtro === 'todos' ? true
      : filtro === 'incompleta' ? !!u.fichaIncompleta
      : (u.sucursales ?? []).length === 0 || (u.sucursales ?? []).includes(filtro))

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

  /** 039: la persona dice que no la pidió, o ya encontró su teléfono. */
  async function cancelarRecuperacion(u: UsuarioEnLista, r: RecuperacionEnCurso) {
    const seguro = await pedir({
      titulo: `Cancelar la recuperación de ${u.nombre}`,
      confirmar: 'Cancelar la recuperación',
      tono: 'peligro',
      mensaje: (
        <>
          <p>
            <strong>{u.nombre}</strong> pidió recuperar su segundo factor (dice haber perdido el
            teléfono y sus códigos). Si la cancelas, su teléfono y sus códigos siguen valiendo.
          </p>
          <p>Hazlo si no la pidió, o si ya los recuperó. Le avisamos por correo.</p>
        </>
      ),
    })
    if (!seguro) return

    try {
      const x = await recuperacion2faServicio.cancelar(r.id)
      mensaje.bien(x.mensaje)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cancelar.')
    }
    await recuperaciones.recargar()
  }

  /** 039: le robaron la laptop con la sesión abierta. */
  async function cerrarSesiones(u: UsuarioEnLista) {
    const seguro = await pedir({
      titulo: `Cerrar las sesiones de ${u.nombre}`,
      confirmar: 'Cerrar sus sesiones',
      tono: 'peligro',
      mensaje: (
        <p>
          Se cierran ahora todas sus sesiones abiertas, en cualquier equipo. Tendrá que volver a
          entrar con su contraseña y su segundo factor. Le avisamos por correo.
        </p>
      ),
    })
    if (!seguro) return

    try {
      const x = await recuperacion2faServicio.cerrarSesiones(u.id)
      mensaje.bien(x.mensaje)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudieron cerrar sus sesiones.')
    }
  }

  if (yo.esSuperAdmin) {
    return (
      <>
        <h1 className="titulo-pagina">Personal de la empresa</h1>
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
      <div className="cabecera-bandeja">
        <div>
          <h1 className="titulo-pagina titulo-serif">Personal de la empresa</h1>
          <p className="bajada-pagina">
            {opciones.datos?.restringido
              ? 'Solo ves y agregas personal de tus sucursales.'
              : <>Las personas que trabajan en {empresa?.nombre ?? 'tu empresa'}: qué pueden hacer (rol), qué pueden ver
                  (alcance) y en qué sucursal.</>}
            {/* 035: los roles propios. */}
            {puede(Permisos.Usuarios.RolesGestionar) && (
              <> <Link to="/usuarios/roles">Roles y permisos</Link></>
            )}
          </p>
        </div>
        {puede(Permisos.Usuarios.Crear) && opciones.datos && (
          <Boton onClick={() => setFicha(null)}>Agregar personal</Boton>
        )}
      </div>

      {usuarios.error && <Aviso>{usuarios.error}</Aviso>}
      {opciones.error && <Aviso>{opciones.error}</Aviso>}

      {todos.length > 1 && (
        <div className="filtros-personal" role="group" aria-label="Filtrar">
          <button type="button" className={filtro === 'todos' ? 'elegido' : undefined} onClick={() => setFiltro('todos')}>
            Todos ({todos.length})
          </button>
          {variasSucursales && sucursales.map(s => {
            // Sin sucursales marcadas = trabaja en todas: cuenta en cada una.
            const n = todos.filter(u => (u.sucursales ?? []).length === 0 || (u.sucursales ?? []).includes(s.id)).length
            return (
              <button key={s.id} type="button" className={filtro === s.id ? 'elegido' : undefined} onClick={() => setFiltro(s.id)}>
                {s.nombre} ({n})
              </button>
            )
          })}
          {todos.some(u => u.fichaIncompleta) && (
            <button type="button" className={'ojo' + (filtro === 'incompleta' ? ' elegido' : '')} onClick={() => setFiltro('incompleta')}>
              Ficha incompleta ({todos.filter(u => u.fichaIncompleta).length})
            </button>
          )}
        </div>
      )}

      <div className="bloque sin-relleno lista-usuarios">
        {visibles.length > 0 ? (
          <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Cargo · rol</th>
                <th>Alcance</th>
                {variasSucursales && <th>Sucursales</th>}
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>

            <tbody>
              {visibles.map(u => {
                const soyYo     = u.id === yo.id
                const bloqueado = esFutura(u.bloqueadoHasta)
                const recupera  = recuperaciones.datos?.find(r => r.usuarioId === u.id)

                return (
                  <tr key={u.id} className={u.activo ? undefined : 'apagada'}>
                    <td>
                      <div className="principal">
                        {u.nombre}
                        {soyYo && <span className="etiqueta marca-yo">tú</span>}
                      </div>
                      {u.fichaIncompleta
                        ? <div className="ficha-incompleta">Ficha incompleta{!u.numeroDocumento ? ' · falta el documento' : ''}</div>
                        : <div className="secundario">{NOMBRE_DOCUMENTO[u.tipoDocumento ?? '1']} {u.numeroDocumento} · {u.correo}</div>}
                      {u.fichaIncompleta && <div className="secundario">{u.correo}</div>}
                    </td>

                    <td>
                      {u.cargo && <div>{u.cargo}</div>}
                      <div className={u.cargo ? 'secundario' : undefined}>
                        {u.roles.length > 0 ? u.roles.map(r => r.nombre).join(' · ') : <span className="vacio">Sin rol</span>}
                        {u.notas && ' · notas de crédito'}
                        {u.personal && ' · puede agregar personal'}
                      </div>
                    </td>

                    <td>{NOMBRE_ALCANCE[u.alcance ?? 'empresa']}</td>

                    {variasSucursales && (
                      <td>
                        {(u.sucursales ?? []).length === 0
                          ? 'Todas'
                          : (u.sucursales ?? []).map(id => nombreSucursal.get(id) ?? '(desactivada)').join(', ')}
                        {u.sucursalDefecto && (u.sucursales ?? []).length !== 1 && nombreSucursal.get(u.sucursalDefecto) && (
                          <div className="secundario">por defecto: {nombreSucursal.get(u.sucursalDefecto)}</div>
                        )}
                      </td>
                    )}

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
                      {/* 039 */}
                      {recupera && (
                        <div className="recuperando" title="Dice haber perdido el teléfono y sus códigos.">
                          {recupera.estado === 'por_confirmar'
                            ? 'Pidió recuperar su segundo factor (sin confirmar)'
                            : recupera.lista
                              ? 'Recuperando su segundo factor · espera terminada'
                              : `Recuperando su segundo factor · disponible el ${recupera.disponibleTexto}`}
                        </div>
                      )}
                    </td>

                    <td className="acciones-bandeja">
                      {/* Nadie cambia sus propios roles ni se desactiva a sí
                          mismo. Lo impide el back; aquí solo se esconde el
                          botón para no ofrecer algo que va a fallar.

                          «Editar» queda a la vista (es lo más buscado); lo
                          demás va en «⋯» para que la tabla quepa junto al
                          panel de invitar. */}
                      {soyYo ? (
                        <Si puede={Permisos.Usuarios.Editar}>
                          {opciones.datos && (
                            <Boton estilo="secundario" onClick={() => setFicha(u)}>
                              {u.fichaIncompleta ? 'Completar ficha' : 'Mi ficha'}
                            </Boton>
                          )}
                        </Si>
                      ) : u.activo ? (
                        <>
                          <Si puede={Permisos.Usuarios.Editar}>
                            {opciones.datos && (
                              <Boton estilo="secundario" onClick={() => setFicha(u)}>
                                {u.fichaIncompleta ? 'Completar ficha' : 'Editar'}
                              </Boton>
                            )}
                          </Si>

                          {(puede(Permisos.Usuarios.Editar)
                            || puede(Permisos.Usuarios.Desactivar) || puede(Permisos.Usuarios.SesionesRevocar)) && (
                            <div className="menu-fila">
                              <Boton estilo="secundario" aria-label={`Más acciones de ${u.nombre}`}
                                     aria-expanded={menu === u.id} onClick={() => setMenu(m => m === u.id ? null : u.id)}>⋯</Boton>
                              {menu === u.id && (
                                <div className="menu-fila-lista" role="menu">
                                  {puede(Permisos.Usuarios.Editar) && (
                                    <button type="button" role="menuitem" onClick={() => { setMenu(null); void enviarEnlace(u) }}>
                                      {u.ultimoIngresoEn === null ? 'Reenviar la invitación' : 'Enviar enlace de acceso'}
                                    </button>
                                  )}
                                  {/* 039 */}
                                  {recupera && puede(Permisos.Usuarios.Desactivar) && (
                                    <button type="button" role="menuitem"
                                            onClick={() => { setMenu(null); void cancelarRecuperacion(u, recupera) }}>
                                      Cancelar la recuperación
                                    </button>
                                  )}
                                  {puede(Permisos.Usuarios.SesionesRevocar) && (
                                    <button type="button" role="menuitem"
                                            onClick={() => { setMenu(null); void cerrarSesiones(u) }}>
                                      Cerrar sus sesiones
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
          </div>
        ) : (
          <div className="relleno">
            <Vacio>{filtro === 'todos' ? 'Todavía no hay nadie más en la empresa.' : 'Nadie con ese filtro.'}</Vacio>
          </div>
        )}
      </div>

      <div className="bloque">
        <strong>Alcance: qué puede ver cada uno</strong>
        <p className="nota">
          <strong>Toda la empresa</strong> — todo (la central). <strong>Su sucursal</strong> — solo lo de sus
          sucursales. <strong>Solo lo suyo</strong> — solo los comprobantes que él emitió.
        </p>
      </div>

      {/* 046: la gente de la Cuenta Profesional que también entra (solo lectura). */}
      {estudio.datos && estudio.datos.length > 0 && (
        <div className="bloque bloque-estudio">
          <strong>Además entran desde tu estudio</strong>
          <p className="nota">Son de Mi equipo (Cuenta Profesional): sus datos y su acceso se cambian allí.</p>
          <table className="tabla">
            <thead><tr><th>Persona</th><th>Nivel</th><th>Rol</th><th>Alcance</th></tr></thead>
            <tbody>
              {estudio.datos.map((p, i) => (
                <tr key={i}>
                  <td>{p.nombre}</td>
                  <td>{NIVEL[p.nivel] ?? p.nivel}</td>
                  <td>{p.rol}</td>
                  <td>{NOMBRE_ALCANCE[p.alcance] ?? p.alcance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmacion}

      {ficha !== undefined && opciones.datos && (
        <DialogoFicha
          usuario={ficha}
          opciones={opciones.datos}
          empresa={empresa?.nombre ?? 'tu empresa'}
          onCerrar={() => setFicha(undefined)}
          onListo={(m, tono) => {
            setFicha(undefined)
            if (tono === 'ojo') mensaje.ojo(m)
            else mensaje.bien(m)
            void usuarios.recargar()
          }}
        />
      )}
    </>
  )
}