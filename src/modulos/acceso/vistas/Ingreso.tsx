import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { accesoServicio } from '../servicios/accesoServicio'

export function Ingreso() {
  const { refrescar } = useSesion()

  const [correo, setCorreo] = useState('')
  const [clave, setClave]   = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    try {
      await accesoServicio.ingresar(correo, clave)

      // NO SE USA LO QUE DEVUELVE EL INGRESO para decidir a dónde ir.
      //
      // Se vuelve a preguntar a /api/yo, que es la fuente de verdad, y App
      // decide con eso. Así hay un solo camino —el mismo que se recorre al
      // recargar la página— en vez de dos que pueden acabar divergiendo.
      await refrescar()

    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo entrar.')
      setEnviando(false)
    }
  }

  return (
    <div className="pantalla-centrada">
      <form className="tarjeta-acceso" onSubmit={enviar}>
        <p className="marca">Reyban Consulting</p>
        <h1>Entrar</h1>
        <p className="bajada">Accede con tu correo de trabajo.</p>

        {error && <Aviso>{error}</Aviso>}

        <Campo
          etiqueta="Correo"
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={correo}
          onChange={e => setCorreo(e.target.value)}
        />

        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={clave}
          onChange={e => setClave(e.target.value)}
        />

        <Boton type="submit" ancho ocupado={enviando} textoOcupado="Entrando…">
          Entrar
        </Boton>
      </form>
    </div>
  )
}
