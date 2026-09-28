import { useState } from 'react'
import { ErrorApi } from '../nucleo/api/errores'
import { fechaYHora } from '../nucleo/formato/fechas'
import { useSesion, useYo } from '../nucleo/sesion/SesionContexto'
import { suplantacionServicio } from '../modulos/administracion/servicios/suplantacionServicio'

/**
 * La barra que avisa de que no estás en tu propia cuenta.
 *
 * ES LA PIEZA MÁS IMPORTANTE DE TODA LA SUPLANTACIÓN, aunque sea la más
 * pequeña. El resto del sistema hace que ver la cuenta de otro sea seguro;
 * esto es lo único que hace que sea EVIDENTE.
 *
 * Sin ella, el super administrador ve la plataforma de su cliente sin ninguna
 * señal de que no es la suya —el front pinta exactamente lo que pintaría para
 * el cliente, que es justo el objetivo— y basta con recargar la página o mirar
 * el móvil un minuto para perder el hilo de con qué cuenta está trabajando.
 *
 * TRES DECISIONES DE ASPECTO, Y NINGUNA ES DECORACIÓN:
 *
 *   1. NARANJA, no gris. Tiene que competir con la atención, no acompañarla.
 *   2. ARRIBA DE TODO, empujando la página hacia abajo, no flotando encima.
 *      Una barra flotante se confunde con un aviso que se va a ir solo.
 *   3. EL BOTÓN DE VOLVER, DENTRO. En la barra que te dice que estás fuera de
 *      tu cuenta está la forma de volver, sin buscarla en ningún menú.
 */
export function BarraSuplantacion() {
  const { refrescar } = useSesion()
  const { suplantacion } = useYo()

  const [saliendo, setSaliendo] = useState(false)
  const [error, setError] = useState<string>()

  if (!suplantacion) return null

  async function volver() {
    setError(undefined)
    setSaliendo(true)
    try {
      await suplantacionServicio.terminar()

      // Refrescar vuelve a pedir /api/yo, que ya responde con la identidad de
      // verdad: la cabecera, el menú y los permisos vuelven solos. No hace
      // falta recargar la página ni navegar a ningún sitio.
      await refrescar()
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo volver. Cierra sesión y vuelve a entrar.')
      setSaliendo(false)
    }
  }

  return (
    <div className="barra-suplantacion" role="status">
      <div className="texto">
        <strong>Estás viendo como {suplantacion.suplantado}</strong>
        <span className="detalle">
          {' '}· solo lectura · desde {fechaYHora(suplantacion.desde)}
        </span>
        {error && <div className="fallo">{error}</div>}
      </div>

      <button type="button" onClick={() => void volver()} disabled={saliendo}>
        {saliendo ? 'Volviendo…' : `Volver a ser ${suplantacion.suplantador}`}
      </button>
    </div>
  )
}
