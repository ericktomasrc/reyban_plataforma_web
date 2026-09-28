import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { accesoServicio } from '../servicios/accesoServicio'

const LARGO_MINIMO = 8

/**
 * El cambio obligatorio de contraseña.
 *
 * Sale sola cuando /api/yo dice `debeCambiarClave`, y no hay forma de
 * esquivarla: el back devuelve 403 en todo lo demás mientras siga pendiente.
 * La contraseña con la que entró la escribió otra persona y viajó por correo.
 */
export function CambiarClave() {
  const { refrescar, salir } = useSesion()

  const [actual, setActual]     = useState('')
  const [nueva, setNueva]       = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Se comprueba aquí para avisar antes de enviar, no para confiar en ello:
  // el back vuelve a comprobarlo todo.
  const bastante  = nueva.length >= LARGO_MINIMO
  const coinciden = nueva.length > 0 && nueva === repetida
  const listo     = actual.length > 0 && bastante && coinciden

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    try {
      await accesoServicio.cambiarClave(actual, nueva)
      await refrescar()
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cambiar.')
      setEnviando(false)
    }
  }

  return (
    <div className="pantalla-centrada">
      <form className="tarjeta-acceso" onSubmit={enviar}>
        <p className="marca">Reyban Consulting</p>
        <h1>Cambia tu contraseña</h1>
        <p className="bajada">
          La que usaste para entrar es temporal. Elige una tuya antes de seguir.
        </p>

        {error && <Aviso>{error}</Aviso>}

        <Campo
          etiqueta="Contraseña actual"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          value={actual}
          onChange={e => setActual(e.target.value)}
        />

        <Campo
          etiqueta="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          required
          value={nueva}
          onChange={e => setNueva(e.target.value)}
          pista={
            nueva.length === 0
              ? `Al menos ${LARGO_MINIMO} caracteres. Una frase larga vale más que símbolos raros.`
              : bastante ? 'Bien.' : `Faltan ${LARGO_MINIMO - nueva.length}.`
          }
          mal={nueva.length > 0 && !bastante}
        />

        <Campo
          etiqueta="Repítela"
          type="password"
          autoComplete="new-password"
          required
          value={repetida}
          onChange={e => setRepetida(e.target.value)}
          pista={repetida.length > 0 && !coinciden ? 'No coinciden.' : undefined}
          mal={repetida.length > 0 && !coinciden}
        />

        <Aviso tono="ojo">
          Al cambiarla se cerrarán tus otras sesiones abiertas.
        </Aviso>

        <Boton type="submit" ancho disabled={!listo} ocupado={enviando} textoOcupado="Guardando…">
          Cambiar contraseña
        </Boton>

        <Boton estilo="plano" ancho onClick={() => void salir()} style={{ marginTop: 8 }}>
          Salir
        </Boton>
      </form>
    </div>
  )
}
