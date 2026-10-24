import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Cargando } from './componentes/Cargando'
import { CambiarClave } from './modulos/acceso/vistas/CambiarClave'
import { Ingreso } from './modulos/acceso/vistas/Ingreso'
import { Invitacion } from './modulos/acceso/vistas/Invitacion'
import { Registro } from './modulos/acceso/vistas/Registro'
import { RecuperarAcceso } from './modulos/acceso/vistas/RecuperarAcceso'
import { Restablecer } from './modulos/acceso/vistas/Restablecer'
import { RecuperarSegundoFactor } from './modulos/acceso/vistas/RecuperarSegundoFactor'
import { PedirRecuperacion } from './modulos/recuperacion/vistas/PedirRecuperacion'
import { RecuperarEmpresa } from './modulos/recuperacion/vistas/RecuperarEmpresa'
import { ReclamarConDocumentos } from './modulos/recuperacion/vistas/ReclamarConDocumentos'
import { ResponderPedido } from './modulos/recuperacion/vistas/ResponderPedido'
import { SegundoFactor } from './modulos/acceso/vistas/SegundoFactor'
import { CLAVE_TUS_DATOS_LUEGO, TusDatos } from './modulos/acceso/vistas/TusDatos'
import { ConfirmarCorreo } from './modulos/perfil/vistas/ConfirmarCorreo'
import { ProveedorMensajes } from './nucleo/mensajes/ProveedorMensajes'
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
      {/* POR FUERA DEL ROUTER Y DE TODO LO DEMÁS: la ventana de mensaje se
          monta al final del documento, que es lo que hace que quede por encima
          de cualquier diálogo abierto. Dentro de una pantalla quedaría dentro
          de su diálogo, y el navegador la pintaría detrás. */}
      <ProveedorMensajes>
        <BrowserRouter>
          <Routes>
            {/* Fuera de la puerta, a propósito. */}
            <Route path="/invitacion/:token" element={<Invitacion />} />

            {/* El registro libre (016), también sin sesión. */}
            <Route path="/registro" element={<Registro />} />

            {/* 038: recuperar el acceso por correo, también sin sesión. */}
            <Route path="/recuperar-acceso" element={<RecuperarAcceso />} />
            <Route path="/restablecer/:token" element={<Restablecer />} />
            {/* 039: el enlace para confirmar la recuperación del segundo factor. */}
            <Route path="/recuperar-segundo-factor/:token" element={<RecuperarSegundoFactor />} />

            {/* Recuperar la empresa en pausa (021): con sesión o sin ella. */}
            <Route path="/recuperar" element={<PedirRecuperacion />} />
            <Route path="/recuperar/empresa/:token" element={<RecuperarEmpresa />} />
            <Route path="/recuperar/documentos" element={<ReclamarConDocumentos />} />
            {/* 024: el titular responde el pedido de una cuenta (camino B). Sin sesión. */}
            <Route path="/pedido/:token" element={<ResponderPedido />} />
            {/* 048: el enlace que llega al correo nuevo. Sin sesión: puede abrirse en el teléfono. */}
            <Route path="/confirmar-correo/:token" element={<ConfirmarCorreo />} />

            <Route path="*" element={<Puerta />} />
          </Routes>
        </BrowserRouter>
      </ProveedorMensajes>
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
 *   5. ¿Lo invitaron y no revisó sus datos? → «Tus datos» (048; se puede dejar para después)
 *   6. Todo lo demás
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
  const [luego, setLuego] = useState(() => {
    try { return sessionStorage.getItem(CLAVE_TUS_DATOS_LUEGO) === '1' } catch { return false }
  })

  if (estado.fase === 'cargando') return <Cargando />
  if (estado.fase === 'fuera') {
    if (luego) setLuego(false)   // al volver a entrar, «Tus datos» se pregunta otra vez
    return <Ingreso />
  }

  if (estado.yo.segundoFactorPendiente) {
    return <SegundoFactor debeConfigurar={estado.yo.debeConfigurarSegundoFactor} />
  }

  if (estado.yo.debeCambiarClave) return <CambiarClave />

  if (estado.yo.ficha?.pedirAhora && !luego) return <TusDatos onListo={() => setLuego(true)} />

  return <Rutas />
}