import { useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { usuariosServicio } from '../servicios/usuariosServicio'
import type { RolDisponible, UsuarioEnLista } from '../tipos'

interface Props {
  usuario: UsuarioEnLista
  roles: RolDisponible[]
  onCerrar: () => void
  onGuardado: () => void
}

/**
 * Cambiar los roles de un usuario.
 *
 * AQUÍ SÍ HAY BOTÓN DE GUARDAR, al revés que en los módulos de una empresa.
 * La API reemplaza la lista entera de una vez, así que marcar y desmarcar
 * tiene que poder hacerse sin que cada clic sea una llamada — si no, quitar un
 * rol para poner otro dejaría al usuario un instante sin ninguno.
 *
 * Lo que el back desactiva, no borra: la bitácora conserva quién quitó qué y
 * cuándo se lo devolvieron.
 */
export function DialogoRoles({ usuario, roles, onCerrar, onGuardado }: Props) {
  const [elegidos, setElegidos] = useState<string[]>(usuario.roles.map(r => r.rolId))
  const mensaje = useMensaje()
  const [guardando, setGuardando] = useState(false)

  const alternar = (id: string) =>
    setElegidos(v => v.includes(id) ? v.filter(r => r !== id) : [...v, id])

  async function guardar() {
    setGuardando(true)
    try {
      await usuariosServicio.cambiarRoles(usuario.id, elegidos)
      onGuardado()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudieron guardar los roles.')
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      titulo={`Roles de ${usuario.nombre}`}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void guardar()} ocupado={guardando} textoOcupado="Guardando…">
            Guardar
          </Boton>
        </>
      }
    >

      {elegidos.length === 0 && (
        <div className="aviso ojo">
          Sin ningún rol, esta persona entrará y no podrá hacer nada.
        </div>
      )}

      <div className="casillas">
        {roles.map(r => (
          <label key={r.id} className="casilla">
            <input
              type="checkbox"
              checked={elegidos.includes(r.id)}
              onChange={() => alternar(r.id)}
            />
            <span>
              <strong>{r.nombre}</strong>
              {r.descripcion && <em>{r.descripcion}</em>}

              {/* Los permisos del rol, a la vista. Sin esto, «Facturador» es
                  una palabra y nadie sabe qué está concediendo al marcarla. */}
              {r.permisos.length > 0 && (
                <span className="etiquetas permisos-del-rol">
                  {r.permisos.map(p => (
                    <span key={p} className="etiqueta">{p}</span>
                  ))}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </Dialogo>
  )
}