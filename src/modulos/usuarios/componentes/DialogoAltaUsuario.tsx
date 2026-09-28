import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { usuariosServicio } from '../servicios/usuariosServicio'
import type { RolDisponible, UsuarioInvitado } from '../tipos'

interface Props {
  abierto: boolean
  roles: RolDisponible[]
  onCerrar: () => void
  onCreado: (resultado: UsuarioInvitado) => void
}

/**
 * Crear un usuario dentro de la empresa.
 *
 * SE PIDEN LOS ROLES AQUÍ, no después. Un usuario sin rol entra y no puede
 * hacer absolutamente nada: ve el menú vacío y no entiende por qué. Es el
 * momento de decidirlo, mientras se sabe para qué se está creando la cuenta.
 */
export function DialogoAltaUsuario({ abierto, roles, onCerrar, onCreado }: Props) {
  const [correo, setCorreo] = useState('')
  const [nombre, setNombre] = useState('')
  const [elegidos, setElegidos] = useState<string[]>([])
  const [error, setError] = useState<string>()
  const [enviando, setEnviando] = useState(false)

  const limpiar = () => {
    setCorreo('')
    setNombre('')
    setElegidos([])
    setError(undefined)
  }

  const cerrar = () => { limpiar(); onCerrar() }

  const alternar = (id: string) =>
    setElegidos(v => v.includes(id) ? v.filter(r => r !== id) : [...v, id])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!correo.trim()) {
      setError('Falta el correo: es con lo que entra.')
      return
    }
    if (elegidos.length === 0) {
      setError('Elige al menos un rol, o la cuenta no podrá hacer nada.')
      return
    }

    setEnviando(true)
    try {
      const resultado = await usuariosServicio.crear(
        correo.trim(),
        nombre.trim() || correo.trim(),
        elegidos,
      )
      limpiar()
      onCreado(resultado)
    } catch (err) {
      // El 409 aquí casi siempre es un correo repetido. Puede estar en otra
      // empresa —el correo es único en toda la plataforma— y la API no dice
      // de quién es, a propósito: diría quién es cliente tuyo.
      setError(err instanceof ErrorApi ? err.message : 'No se pudo crear el usuario.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo
      titulo="Crear un usuario"
      abierto={abierto}
      onCerrar={cerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={cerrar}>Cancelar</Boton>
          <Boton
            type="submit"
            form="alta-usuario"
            ocupado={enviando}
            textoOcupado="Creando…"
          >
            Crear usuario
          </Boton>
        </>
      }
    >
      <form id="alta-usuario" onSubmit={enviar}>
        {error && <Aviso>{error}</Aviso>}

        <Campo
          etiqueta="Correo"
          type="email"
          value={correo}
          onChange={e => setCorreo(e.target.value)}
          pista="Con este correo entra. Es único en toda la plataforma."
          autoFocus
        />

        <Campo
          etiqueta="Nombre"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          pista="Opcional. Si lo dejas vacío se usa el correo."
        />

        <h3 className="subtitulo">Roles</h3>

        {roles.length === 0 ? (
          <p className="vacio">No hay roles disponibles.</p>
        ) : (
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
                </span>
              </label>
            ))}
          </div>
        )}

        <p className="nota">
          Le llegará un correo con un enlace para elegir su contraseña. Tú no
          la verás nunca, y así es como tiene que ser.
        </p>
      </form>
    </Dialogo>
  )
}
