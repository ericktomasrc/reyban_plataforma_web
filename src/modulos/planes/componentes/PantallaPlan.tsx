import { Link } from 'react-router-dom'
import { NOMBRE_PLAN } from '../../../nucleo/planes/planes'

/**
 * 069: la pantalla que sale en lugar de una que el plan no trae (si alguien
 * llega por un enlace o escribe la URL). La API, además, responde 402.
 */
export function PantallaPlan({ minimo, puedeCambiar }: { minimo: string; puedeCambiar: boolean }) {
  return (
    <div className="pantalla-plan">
      <span className="candado-plan" aria-hidden="true">🔒</span>
      <h1>{minimo === 'sin' ? 'Esto todavía no está disponible' : `Esto viene en el plan ${NOMBRE_PLAN[minimo] ?? minimo}`}</h1>
      <p className="secundario">
        {minimo === 'sin'
          ? 'Lo estamos preparando. Te avisaremos cuando esté listo.'
          : puedeCambiar
            ? 'Sube de plan para usarlo. Tus datos no se pierden: todo lo que ya tienes sigue ahí.'
            : 'Pídele al dueño de la cuenta que suba de plan para usarlo.'}
      </p>
      {minimo !== 'sin' && puedeCambiar && <Link className="boton" to="/mi-plan">Ver los planes</Link>}
      <Link to="/" className="enlace volver-plan">Volver al inicio</Link>
    </div>
  )
}