import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { accesoServicio } from '../../acceso/servicios/accesoServicio'

interface Props {
  onCerrar: () => void
  onCambiada: (mensaje: string) => void
}

/**
 * Cambiar mi contraseña sin que nadie me obligue.
 *
 * USA EL MISMO ENDPOINT QUE EL CAMBIO OBLIGATORIO del primer ingreso —
 * `POST /api/clave`, en `accesoServicio`— y por eso no hay servicio nuevo. Son
 * la misma operación: pedir la actual, guardar la nueva y cortar las demás
 * sesiones. Tener dos endpoints para eso sería tener dos sitios donde se puede
 * olvidar lo de cortar sesiones.
 *
 * Lo único que cambia es el marco: allí es una pantalla entera de la que no se
 * puede salir, y aquí un diálogo que se cierra cuando uno quiera.
 */
export function DialogoClave({ onCerrar, onCambiada }: Props) {
  const [actual, setActual]   = useState('')
  const [nueva, setNueva]     = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError]     = useState<string>()
  const [guardando, setGuardando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (nueva.length < 8) {
      setError('La contraseña nueva necesita al menos 8 caracteres.')
      return
    }
    // Se comprueba aquí y no solo en el back porque es un error de dedo, no un
    // ataque: el back no puede saber qué quiso escribir, y equivocarse en las
    // dos dejaría a alguien fuera de su propia cuenta.
    if (nueva !== repetida) {
      setError('Las dos contraseñas nuevas no coinciden.')
      return
    }
    if (nueva === actual) {
      setError('La contraseña nueva es igual a la que ya tienes.')
      return
    }

    setGuardando(true)
    try {
      const r = await accesoServicio.cambiarClave(actual, nueva)
      onCambiada(r.mensaje)
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar la contraseña.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      titulo="Cambiar mi contraseña"
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" form="mi-clave" ocupado={guardando} textoOcupado="Cambiando…">
            Cambiar contraseña
          </Boton>
        </>
      }
    >
      <form id="mi-clave" onSubmit={enviar}>
        {error && <Aviso>{error}</Aviso>}

        {/* El campo oculto con el correo es lo que hace que el gestor de
            contraseñas sepa a qué cuenta asociar lo que guarde. Sin él, algunos
            navegadores guardan la contraseña sin usuario y no la ofrecen nunca. */}
        <Campo
          etiqueta="Contraseña actual"
          type="password"
          value={actual}
          onChange={e => setActual(e.target.value)}
          autoComplete="current-password"
          pista="Se pide aunque ya estés dentro: es lo que impide que alguien que encuentre tu sesión abierta se quede con la cuenta."
          autoFocus
        />

        <Campo
          etiqueta="Contraseña nueva"
          type="password"
          value={nueva}
          onChange={e => setNueva(e.target.value)}
          autoComplete="new-password"
          pista="Mínimo 8 caracteres. Una frase larga es mejor que una palabra con símbolos."
        />

        <Campo
          etiqueta="Repite la nueva"
          type="password"
          value={repetida}
          onChange={e => setRepetida(e.target.value)}
          autoComplete="new-password"
          mal={repetida.length > 0 && repetida !== nueva}
        />

        <p className="nota">
          Al cambiarla se cerrarán tus demás sesiones. Esta se queda abierta.
        </p>
      </form>
    </Dialogo>
  )
}
