import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { accesoServicio } from '../servicios/accesoServicio'

export function Ingreso() {
  const { refrescar } = useSesion()

  const [correo, setCorreo] = useState('')
  const [clave, setClave]   = useState('')
  const mensaje = useMensaje()
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
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
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo entrar.')
      setEnviando(false)
    }
  }

  return (
    <div className="acceso-dividido">
      {/* EL PANEL DE MARCA, a la izquierda (mockup de la fase 1). En pantalla
          estrecha se queda arriba y más bajo: lo que importa es el formulario. */}
      <aside className="acceso-marca">
        <div className="acceso-logo">
          <span className="acceso-logo-icono" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 13h6M10 17h6" />
            </svg>
          </span>
          Reyban · Facturación
        </div>

        <div className="acceso-mensaje">
          <h1>Factura electrónica sin complicarte.</h1>
          <p>
            Para tu negocio o para todas las empresas que llevas. Pruébalo en
            beta gratis; pasa a SUNAT real cuando tengas tu certificado.
          </p>
        </div>

        {/* El texto de presentación de verdad llega con el módulo de
            presentación. */}
        <p className="acceso-pie">Reyban Consulting</p>
      </aside>

      <main className="acceso-principal">
        <div className="acceso-columna">
          <form className="tarjeta-acceso" onSubmit={enviar}>
            <h2>Ingresar</h2>

            <Campo
              etiqueta="Correo"
              type="email"
              autoComplete="username"
              required
              autoFocus
              placeholder="tucorreo@gmail.com"
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
              Ingresar
            </Boton>

            {/* 038: un solo enlace para los dos casos; el back decide qué mandar. */}
            <p className="enlace-olvido">
              <Link to="/recuperar-acceso">¿Olvidaste tu contraseña o no te llegó el correo?</Link>
            </p>
          </form>

          {/* EL REGISTRO LIBRE (016). Dos puertas, una por cuenta: quien llega
              sabe si factura para su negocio o para sus clientes, y elegirlo
              aquí le ahorra un paso en el formulario. */}
          <p className="separador"><span>¿Aún no tienes cuenta?</span></p>

          <Link to="/registro?tipo=negocio" className="opcion-registro">
            <span className="opcion-icono negocio" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 10l2-6h14l2 6" /><path d="M4 10v10h16V10" /><path d="M9 20v-6h6v6" />
              </svg>
            </span>
            <span className="opcion-texto">
              <strong>Facturo para mi negocio</strong>
              <span>Cuenta Negocio · una empresa, la tuya</span>
            </span>
            <Flecha />
          </Link>

          <Link to="/registro?tipo=profesional" className="opcion-registro">
            <span className="opcion-icono profesional" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 13h18" />
              </svg>
            </span>
            <span className="opcion-texto">
              <strong>Facturo para mis clientes</strong>
              <span>Cuenta Profesional · contadores, estudios y asesores</span>
            </span>
            <Flecha />
          </Link>

          {/* FASE 4: la empresa que un contador dejó en pausa. */}
          <p className="enlace-recuperar">
            <Link to="/recuperar">¿Tu empresa está en pausa? Recupérala</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

function Flecha() {
  return (
    <svg className="opcion-flecha" width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}