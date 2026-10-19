import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Captcha } from '../../../componentes/Captcha'
import { ErrorApi } from '../../../nucleo/api/errores'
import { registroServicio } from '../../acceso/servicios/registroServicio'
import type { ConfigRegistro } from '../../acceso/servicios/registroServicio'
import { recuperacionServicio } from '../servicios/recuperacionServicio'

const TOKEN_DE_PRUEBA = 'XXXX.DUMMY.TOKEN.XXXX'

/**
 * «¿TU EMPRESA ESTÁ EN PAUSA? RECUPÉRALA» (lienzo «Fase 4», pantalla 4).
 *
 * Solo se escribe el RUC. El enlace va al correo del titular que se guardó al
 * dar de alta la empresa, nunca a otro. La respuesta es la misma exista o no
 * el RUC, para que nadie pueda averiguar qué empresas usan la plataforma.
 */
export function PedirRecuperacion() {
  const [config, setConfig] = useState<ConfigRegistro>()
  const [ruc, setRuc] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [vuelta, setVuelta] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [hecho, setHecho] = useState<{ mensaje: string; enlaceDePrueba: string | null }>()

  useEffect(() => {
    registroServicio.config()
      .then(c => { setConfig(c); if (c.captchaDePrueba) setCaptcha(TOKEN_DE_PRUEBA) })
      .catch(() => setConfig(undefined))
  }, [])

  const conCaptcha = !!config?.captchaSitio && !config.captchaDePrueba

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const limpio = ruc.replace(/\D/g, '')
    if (limpio.length !== 11) { setError('El RUC tiene 11 dígitos.'); return }
    if (conCaptcha && !captcha) { setError('Espera a que termine la comprobación anti-robot.'); return }

    setOcupado(true)
    try {
      setHecho(await recuperacionServicio.pedir(limpio, captcha))
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo enviar. Inténtalo de nuevo.')
      setCaptcha(config?.captchaDePrueba ? TOKEN_DE_PRUEBA : '')
      setVuelta(v => v + 1)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="pantalla-centrada">
      <div className="tarjeta-acceso">
        <Link to="/" className="volver-arriba">← Volver a ingresar</Link>
        <p className="marca">Reyban Consulting</p>
        <h1>Recupera tu empresa</h1>

        {hecho ? (
          <>
            <div className="aviso bien">{hecho.mensaje}</div>
            {hecho.enlaceDePrueba && (
              <p className="nota">Solo en desarrollo: <a href={hecho.enlaceDePrueba}>abrir el enlace</a>.</p>
            )}
            <p className="nota">
              ¿No te llega, o ese correo ya no es tuyo? <Link to="/recuperar/documentos">Reclámala con tus documentos</Link>.
            </p>
            <Link to="/" className="boton">Volver a ingresar</Link>
          </>
        ) : (
          <form onSubmit={enviar}>
            <p className="texto-paso">
              Si tu contador dejó de gestionarla, está en pausa y a salvo. Te mandamos un enlace al
              <strong> correo del titular</strong> para que la pases a tu cuenta.
            </p>

            <Campo etiqueta="RUC de tu empresa" className="mono" inputMode="numeric" maxLength={11}
                   value={ruc} onChange={e => setRuc(e.target.value)} placeholder="20512345678" />

            {conCaptcha && (
              <div className="campo">
                <Captcha key={vuelta} sitio={config!.captchaSitio!} onToken={setCaptcha} />
              </div>
            )}

            {error && <Aviso>{error}</Aviso>}

            <Boton type="submit" ancho ocupado={ocupado} textoOcupado="Enviando…">Enviar el enlace</Boton>

            <p className="nota">
              Respondemos lo mismo exista o no el RUC, y el enlace va <strong>solo</strong> al correo
              del titular que tenemos registrado.
            </p>

            <p className="nota">
              ¿Ya no usas ese correo, o tu empresa la tiene otra cuenta?{' '}
              <Link to="/recuperar/documentos">Reclámala con tus documentos →</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}