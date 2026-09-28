import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Cargando } from './componentes/Cargando'
import { CambiarClave } from './modulos/acceso/vistas/CambiarClave'
import { Ingreso } from './modulos/acceso/vistas/Ingreso'
import { Invitacion } from './modulos/acceso/vistas/Invitacion'
import { SegundoFactor } from './modulos/acceso/vistas/SegundoFactor'
import { ProveedorSesion, useSesion } from './nucleo/sesion/SesionContexto'
import { Rutas } from './rutas/rutas'

/**
 * EL ROUTER ENVUELVE TODO, también lo que se ve sin sesión.
 *
 * Antes empezaba más adentro, después de decidir si había sesión. Dejó de
 * valer al aparecer la pantalla de invitación: esa dirección tiene que
 * funcionar precisamente cuando NO hay sesión, porque quien la abre todavía no
 * tiene contraseña.
 */
export default function App() {
  return (
    <ProveedorSesion>
      <BrowserRouter>
        <Routes>
          {/* Fuera de la puerta, a propósito. */}
          <Route path="/invitacion/:token" element={<Invitacion />} />

          <Route path="*" element={<Puerta />} />
        </Routes>
      </BrowserRouter>
    </ProveedorSesion>
  )
}

/**
 * Decide qué se pinta, y lo decide en un solo sitio.
 *
 * LOS ESTADOS SE MIRAN EN ORDEN, y el orden importa:
 *
 *   1. ¿Todavía no se sabe?       → cargando
 *   2. ¿Hay sesión?               → si no, ingreso
 *   3. ¿Falta el segundo factor?  → esa pantalla, y solo esa
 *   4. ¿Debe cambiar la clave?    → esa pantalla, y solo esa
 *   5. Todo lo demás
 *
 * EL 3 VA ANTES QUE EL 4 a propósito: el segundo factor es lo que demuestra
 * que quien está al otro lado es quien dice ser. Dejarle cambiar la contraseña
 * antes de eso sería permitir que alguien con la contraseña robada se quede
 * con la cuenta cambiándola, sin haber superado el factor.
 *
 * Y si el 3 fuera después del 5, alguien a medias vería el menú completo un
 * instante antes de que lo echaran — con el back respondiéndole 401 a todo,
 * con aspecto de que la aplicación está rota.
 *
 * Todo esto es comodidad: la obligación la impone el back, que no responde a
 * ningún otro endpoint mientras la sesión esté a medias.
 */
function Puerta() {
  const { estado } = useSesion()

  if (estado.fase === 'cargando') return <Cargando />
  if (estado.fase === 'fuera')    return <Ingreso />

  if (estado.yo.segundoFactorPendiente) {
    return <SegundoFactor debeConfigurar={estado.yo.debeConfigurarSegundoFactor} />
  }

  if (estado.yo.debeCambiarClave) return <CambiarClave />

  return <Rutas />
}
