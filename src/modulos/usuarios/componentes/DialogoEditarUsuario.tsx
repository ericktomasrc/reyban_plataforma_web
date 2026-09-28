import { useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { usuariosServicio } from '../servicios/usuariosServicio'
import type { UsuarioEditado, UsuarioEnLista } from '../tipos'

interface Props {
  usuario: UsuarioEnLista
  onCerrar: () => void
  onGuardado: (resultado: UsuarioEditado) => void
}

/**
 * Corregir el nombre y el correo de alguien.
 *
 * ESTE DIÁLOGO EXISTE POR UN MOTIVO MUY PEQUEÑO Y MUY REAL: hasta ahora, un
 * correo mal escrito al dar de alta obligaba a entrar a la base de datos a
 * corregirlo a mano.
 *
 * NO TOCA LA CONTRASEÑA, NI LOS ROLES, NI EL SEGUNDO FACTOR. Cada una de esas
 * cosas tiene su propio botón y su propio permiso. Meterlo todo en un
 * formulario de «editar usuario» haría que cualquier corrección de una letra
 * tuviera pinta de operación delicada.
 */
export function DialogoEditarUsuario({ usuario, onCerrar, onGuardado }: Props) {
  const [nombre, setNombre] = useState(usuario.nombre)
  const [correo, setCorreo] = useState(usuario.correo)
  const [error, setError]   = useState<string>()
  const [guardando, setGuardando] = useState(false)

  // Si se cierra y se abre con otra persona, los campos tienen que seguirla.
  // Sin esto, el estado inicial se quedaría con el del primero que se abrió.
  useEffect(() => {
    setNombre(usuario.nombre)
    setCorreo(usuario.correo)
    setError(undefined)
  }, [usuario])

  /**
   * Sin distinguir mayúsculas, igual que el índice único de la base y que el
   * ingreso: de «Ana@x.pe» a «ana@x.pe» no es un cambio de correo.
   */
  const cambiaCorreo =
    correo.trim().toLowerCase() !== usuario.correo.toLowerCase()

  const sinCambios =
    nombre.trim() === usuario.nombre && !cambiaCorreo

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!nombre.trim()) {
      setError('El nombre no puede quedar vacío.')
      return
    }
    if (!correo.trim()) {
      setError('El correo no puede quedar vacío: es con lo que entra.')
      return
    }

    setGuardando(true)
    try {
      const r = await usuariosServicio.editar(usuario.id, correo.trim(), nombre.trim())
      onGuardado(r)
    } catch (err) {
      // El 409 es un correo que ya tiene otra persona. Puede estar en otra
      // empresa —el correo es único en toda la plataforma— y la API no dice de
      // quién es, a propósito: diría quién es cliente tuyo.
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar.')
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
          <Boton
            type="submit"
            form="editar-usuario"
            ocupado={guardando}
            textoOcupado="Guardando…"
          >
            Guardar
          </Boton>
        </>
      }
    >
      <form id="editar-usuario" onSubmit={enviar}>
        {error && <Aviso>{error}</Aviso>}

        <Campo
          etiqueta="Nombre"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          autoFocus
        />

        <Campo
          etiqueta="Correo"
          type="email"
          value={correo}
          onChange={e => setCorreo(e.target.value)}
          pista="Es con lo que entra. Único en toda la plataforma."
        />

        {/* EL AVISO SOLO APARECE SI EL CORREO CAMBIA DE VERDAD.
            Enseñarlo siempre lo convertiría en parte del decorado, y entonces
            nadie lo lee el día que importa. */}
        {cambiaCorreo && (
          <Aviso tono="ojo">
            A partir de ahora entrará con <strong>{correo.trim()}</strong>. Su
            contraseña y su segundo factor no cambian, y sus sesiones abiertas
            siguen valiendo.
            <br />
            Se avisará a <strong>{usuario.correo}</strong> de que el correo
            cambió, para que se entere quien esté detrás de esa dirección.
          </Aviso>
        )}

        {sinCambios && (
          <p className="nota">Todavía no has cambiado nada.</p>
        )}
      </form>
    </Dialogo>
  )
}
