import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { recuperarAccesoServicio } from '../servicios/recuperarAccesoServicio'

/**
 * 038 — «¿OLVIDASTE TU CONTRASEÑA O NO TE LLEGÓ EL CORREO?» (maquetas 4 y 5).
 *
 * Un solo formulario para los dos casos: el back decide qué mandar. La
 * respuesta es SIEMPRE la misma, exista o no el correo.
 */
export function RecuperarAcceso() {
  const mensaje = useMensaje()
  const [correo, setCorreo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviadoA, setEnviadoA] = useState<string | null>(null)
  const [enlace, setEnlace] = useState<string | null>(null)
  const [espera, setEspera] = useState(0)

  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  async function pedir(destino: string) {
    setEnviando(true)
    try {
      const r = await recuperarAccesoServicio.pedir(destino)
      setEnviadoA(destino)
      setEnlace(r.enlaceDePrueba)
      setEspera(60)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo pedir el enlace. Prueba en un momento.')
    } finally {
      setEnviando(false)
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    void pedir(correo.trim())
  }

  return (
    <div className="acceso-dividido">
      <aside className="acceso-marca">
        <div className="acceso-logo">
          <span className="acceso-logo-icono" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
          Reyban
        </div>
        <div className="acceso-mensaje">
          {enviadoA
            ? <h1>Revisa tu correo.</h1>
            : <h1>Te mandamos un enlace a tu correo.</h1>}
          <p>
            {enviadoA
              ? 'El enlace sirve una sola vez. Si pides otro, el anterior deja de funcionar.'
              : 'Solo tú lo recibes, en tu propia bandeja. Nadie más ve tu contraseña: ni tu administrador ni nosotros.'}
          </p>
        </div>
        <p className="acceso-pie">Reyban Consulting</p>
      </aside>

      <main className="acceso-principal">
        <div className="acceso-columna">
          {!enviadoA ? (
            <form className="tarjeta-acceso" onSubmit={enviar}>
              <h2>Recuperar el acceso</h2>
              <p className="bajada">Escribe el correo con el que te registraste. Te enviaremos lo que necesites:</p>
              <ul className="lista-recuperar">
                <li><strong>Olvidé mi contraseña:</strong> un enlace para crear una nueva.</li>
                <li><strong>Nunca me llegó el correo para activar mi cuenta:</strong> te lo reenviamos.</li>
              </ul>
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
              <Boton type="submit" ancho ocupado={enviando} textoOcupado="Enviando…">
                Enviarme el enlace
              </Boton>
              <p className="nota">
                Tu segundo factor no cambia. Si perdiste también tu celular, pide ayuda al administrador de tu empresa.
              </p>
            </form>
          ) : (
            <div className="tarjeta-acceso">
              <h2>Si el correo está registrado, ya te llegó el enlace</h2>
              <p className="bajada">
                Lo enviamos a <strong>{enviadoA}</strong>. Puede tardar uno o dos minutos.
              </p>
              <ul className="lista-nota">
                <li>Revisa también «Spam» y «Promociones».</li>
                <li>Para cambiar la contraseña, el enlace vence en 1 hora; para activar tu cuenta, en 24 horas.</li>
                <li>
                  ¿Escribiste mal el correo?{' '}
                  <button type="button" className="enlace" onClick={() => { setEnviadoA(null); setEnlace(null) }}>
                    Corrígelo aquí
                  </button>.
                </li>
              </ul>
              <Boton estilo="secundario" ancho disabled={espera > 0} ocupado={enviando}
                     textoOcupado="Enviando…" onClick={() => void pedir(enviadoA)}>
                {espera > 0 ? `Reenviar enlace (en ${espera} s)` : 'Reenviar enlace'}
              </Boton>
              {enlace && (
                <Aviso tono="ojo">
                  Desarrollo, con el correo apagado: <a href={enlace}>abrir el enlace</a>.
                </Aviso>
              )}
            </div>
          )}
          <p className="enlace-recuperar"><Link to="/">Volver a ingresar</Link></p>
        </div>
      </main>
    </div>
  )
}