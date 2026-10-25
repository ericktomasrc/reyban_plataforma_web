import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { BotonGoogle } from '../../../componentes/BotonGoogle'
import { Campo } from '../../../componentes/Campo'
import { Captcha } from '../../../componentes/Captcha'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { registroServicio } from '../servicios/registroServicio'
import type {
  ConfigRegistro, Registrado, TipoCuenta, TipoTitular,
} from '../servicios/registroServicio'

/**
 * CREAR UNA CUENTA (migración 016, fase 1 de cartera-diseno.md).
 *
 * Dos cuentas:
 *   Negocio       «Facturo para mi negocio»: una empresa, la suya.
 *   Profesional   «Facturo para mis clientes»: contadores, estudios, asesores.
 *
 * PERSONA NATURAL O JURÍDICA ES SOLO PARA LA CUENTA: quién es su dueño. Lo que
 * se emite sale siempre con el RUC de la empresa que factura, que se agrega
 * después.
 *
 * SIN ALIAS QUE ESCRIBIR: sale solo del correo (lo de antes de la @) y se
 * enseña al terminar. Decisión del 11 de octubre.
 *
 * AQUÍ NO SE ELIGE CONTRASEÑA. Se elige al abrir el enlace del correo, en la
 * misma pantalla que una invitación (con el segundo factor). Así la cuenta no
 * existe para entrar hasta que se demuestra que el correo es de quien se
 * registra.
 */
export function Registro() {
  const [parametros] = useSearchParams()
  const mensaje = useMensaje()

  const [config, setConfig] = useState<ConfigRegistro>()
  const [falloConfig, setFalloConfig] = useState<string>()

  const [tipo, setTipo] = useState<TipoCuenta>(
    parametros.get('tipo') === 'profesional' ? 'profesional' : 'negocio')
  // Si ya eligió en la pantalla anterior, solo se ve su tarjeta:
  // ?tipo=negocio → Cuenta Negocio; ?tipo=profesional → Cuenta Profesional.
  const soloNegocio = parametros.get('tipo') === 'negocio'
  const soloProfesional = parametros.get('tipo') === 'profesional'
  const [titularTipo, setTitularTipo] = useState<TipoTitular>('natural')
  const [documento, setDocumento] = useState('')
  const [titular, setTitular]     = useState('')
  const [nombre, setNombre]       = useState('')
  const [correo, setCorreo]       = useState('')
  const [acepta, setAcepta]       = useState(false)
  const [captcha, setCaptcha]     = useState('')
  const [vueltaCaptcha, setVueltaCaptcha] = useState(0)

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [hecho, setHecho] = useState<Registrado>()

  useEffect(() => {
    registroServicio.config()
      .then(c => {
        setConfig(c)
        // CON LAS CLAVES DE PRUEBA (solo desarrollo) no se pinta el widget —
        // enseña un aviso rojo de «solo para pruebas»—: se manda el token de
        // prueba de Cloudflare, el único que la clave secreta de prueba acepta.
        if (c.captchaDePrueba) setCaptcha(TOKEN_DE_PRUEBA)
      })
      .catch(e => setFalloConfig(e instanceof ErrorApi ? e.message : 'No se pudo abrir el registro.'))
  }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErrores({})

    if (!captcha) {
      setErrores({ captcha: 'Espera a que termine la comprobación anti-robot.' })
      return
    }

    setEnviando(true)
    try {
      const r = await registroServicio.registrar({
        tipo, titularTipo,
        titularDocumento: documento,
        titularNombre: titular,
        nombre: titularTipo === 'natural' ? '' : nombre,
        correo: correo.trim(),
        aceptaTerminos: acepta,
        captcha,
      })
      setHecho(r)
    } catch (err) {
      const texto = err instanceof ErrorApi ? err.message : 'No se pudo crear la cuenta.'
      const campo = err instanceof ErrorApi && err.codigo?.startsWith('campo_')
        ? err.codigo.slice('campo_'.length) : undefined

      if (campo) setErrores({ [campo]: texto })
      else mensaje.error(texto)

      // El token del captcha ya se gastó: hace falta otro (salvo el de prueba).
      if (!config?.captchaDePrueba) {
        setCaptcha('')
        setVueltaCaptcha(v => v + 1)
      }
    } finally {
      setEnviando(false)
    }
  }

  // -------------------------------------------------------------------------
  if (falloConfig) {
    return (
      <Marco titulo="Crear una cuenta">
        <Aviso>{falloConfig}</Aviso>
        <Link to="/" className="boton secundario ancho">Volver a ingresar</Link>
      </Marco>
    )
  }

  if (!config) return <Cargando />

  if (!config.abierto) {
    return (
      <Marco titulo="Crear una cuenta">
        <Aviso tono="ojo">El registro no está disponible en este momento. Vuelve a intentarlo más tarde.</Aviso>
        <Link to="/" className="boton secundario ancho">Volver a ingresar</Link>
      </Marco>
    )
  }

  if (hecho) return <RevisaTuCorreo registro={hecho} />

  const natural = titularTipo === 'natural'

  return (
    <Marco titulo="Crea tu cuenta" ancha>
      <p className="bajada">
        Gratis mientras dure el periodo de prueba. Te mandamos un correo para
        confirmar que es tuyo.
      </p>

      {/* 049: en un paso, sin contraseña ni correo de confirmación. */}
      <BotonGoogle texto="Crear mi cuenta con Google" despues="o con tu correo" />

      <form className="sin-mayusculas" onSubmit={enviar} noValidate>
        <fieldset className="grupo-registro">
          <legend>¿Para quién vas a facturar?</legend>
          <div className="opciones-cuenta">
            {!soloProfesional && (
            <button type="button" aria-pressed={tipo === 'negocio'}
                    className={tipo === 'negocio' ? 'opcion-cuenta elegida' : 'opcion-cuenta'}
                    onClick={() => setTipo('negocio')}>
              <strong>Cuenta Negocio</strong>
              <span>Facturo para mi negocio. Una empresa, la mía.</span>
            </button>
            )}
            {!soloNegocio && (
            <button type="button" aria-pressed={tipo === 'profesional'}
                    className={tipo === 'profesional' ? 'opcion-cuenta elegida' : 'opcion-cuenta'}
                    onClick={() => setTipo('profesional')}>
              <strong>Cuenta Profesional</strong>
              <span>Facturo para mis clientes. Varias empresas y colaboradores.</span>
            </button>
            )}
          </div>
        </fieldset>

        <fieldset className="grupo-registro">
          <legend>Titular de la cuenta</legend>
          <p className="nota">
            Solo para saber quién es el dueño de la cuenta. Los comprobantes
            salen siempre con el RUC de la empresa que factura.
          </p>

          <div className="segmentado" role="group" aria-label="Tipo de persona">
            <button type="button" aria-pressed={natural}
                    className={natural ? 'elegido' : ''}
                    onClick={() => { setTitularTipo('natural'); setDocumento('') }}>
              Persona natural
            </button>
            <button type="button" aria-pressed={!natural}
                    className={!natural ? 'elegido' : ''}
                    onClick={() => { setTitularTipo('juridica'); setDocumento('') }}>
              Persona jurídica
            </button>
          </div>

          <div className="pareja documento">
            <Campo
              etiqueta={natural ? 'DNI' : 'RUC'}
              obligatorio
              inputMode="numeric"
              maxLength={natural ? 8 : 11}
              placeholder={natural ? '8 dígitos' : '11 dígitos'}
              value={documento}
              onChange={e => setDocumento(e.target.value.replace(/\D/g, ''))}
              mal={!!errores.titularDocumento}
              pista={errores.titularDocumento}
            />
            <Campo
              etiqueta={natural ? 'Nombres y apellidos' : 'Razón social'}
              obligatorio
              placeholder={natural ? 'Ana García Torres' : 'Estudio García SAC'}
              value={titular}
              onChange={e => setTitular(e.target.value)}
              mal={!!errores.titularNombre}
              pista={errores.titularNombre}
            />
          </div>

          {!natural && (
            <Campo
              etiqueta="Tu nombre"
              obligatorio
              placeholder="La persona que va a entrar"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              mal={!!errores.nombre}
              pista={errores.nombre}
            />
          )}
        </fieldset>

        <fieldset className="grupo-registro">
          <legend>Tu acceso</legend>

          <Campo
            etiqueta="Correo"
            obligatorio
            type="email"
            autoComplete="email"
            value={correo}
            onChange={e => setCorreo(e.target.value)}
            mal={!!errores.correo}
            pista={errores.correo ?? 'Con este correo entrarás. No puede tenerlo otra cuenta.'}
          />
        </fieldset>

        <Aviso tono="bien">
          {tipo === 'negocio'
            ? 'El RUC de tu empresa lo registras después, en el asistente de configuración. Primero creamos tu acceso.'
            : 'Después agregas tus empresas en «Mis empresas» (hasta 50 por día) e invitas a tus colaboradores.'}
        </Aviso>

        {config.captchaDePrueba ? (
          <p className="nota">Desarrollo: captcha de prueba, sin widget. En producción aparece el de Cloudflare.</p>
        ) : (
          <div className="campo">
            <Captcha key={vueltaCaptcha} sitio={config.captchaSitio!} onToken={setCaptcha} />
            {errores.captcha && <span className="pista mal">{errores.captcha}</span>}
          </div>
        )}

        <label className="casilla-terminos">
          <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} />
          <span>
            Acepto los términos de uso y la política de privacidad.
            {/* Los textos llegan en la fase 5; el registro ya guarda cuándo se aceptaron. */}
          </span>
        </label>
        {errores.aceptaTerminos && <p className="pista mal">{errores.aceptaTerminos}</p>}

        <Boton type="submit" ancho ocupado={enviando} textoOcupado="Creando tu cuenta…"
               disabled={!acepta}>
          Crear cuenta
        </Boton>

        {/* ATRÁS, también abajo: quien llegó al final del formulario y se
            arrepiente no tiene que volver a subir para salir. */}
        <Link to="/" className="boton secundario ancho boton-atras">
          ← Atrás
        </Link>
      </form>
    </Marco>
  )
}


/**
 * «Revisa tu correo», con el botón de reenviar (uno cada 60 s).
 */
function RevisaTuCorreo({ registro }: { registro: Registrado }) {
  const mensaje = useMensaje()
  const [espera, setEspera] = useState(60)
  const [enviando, setEnviando] = useState(false)
  const [enlace, setEnlace] = useState(registro.enlaceDePrueba)

  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  async function reenviar() {
    setEnviando(true)
    try {
      const r = await registroServicio.reenviar(registro.correo)
      mensaje.bien(r.mensaje)
      if (r.enlaceDePrueba) setEnlace(r.enlaceDePrueba)
      setEspera(60)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo reenviar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Marco titulo="Revisa tu correo">
      <p className="bajada">
        Te mandamos un enlace a <strong>{registro.correo}</strong>. Ábrelo para
        confirmar que el correo es tuyo y elegir tu contraseña.
      </p>

      <p className="bajada">
        En la plataforma te verán como <strong>@{registro.alias}</strong>.
      </p>

      {!registro.enviado && (
        <Aviso tono="ojo">
          El correo no salió esta vez. Pulsa «Reenviar enlace» en un minuto.
        </Aviso>
      )}

      <ul className="lista-nota">
        <li>El enlace dura {registro.horas} horas y sirve una sola vez.</li>
        <li>¿No llegó? Mira en «Spam» o «Promociones».</li>
      </ul>

      <Boton estilo="secundario" ancho disabled={espera > 0} ocupado={enviando}
             textoOcupado="Enviando…" onClick={() => void reenviar()}>
        {espera > 0 ? `Reenviar enlace (en ${espera} s)` : 'Reenviar enlace'}
      </Boton>

      {enlace && (
        <Aviso tono="ojo">
          Desarrollo, con el correo apagado: <a href={enlace}>abrir el enlace</a>.
        </Aviso>
      )}

      <p className="nota centrado"><Link to="/">Volver a ingresar</Link></p>
    </Marco>
  )
}


/** El único token que aceptan las claves de prueba de Cloudflare. */
const TOKEN_DE_PRUEBA = 'XXXX.DUMMY.TOKEN.XXXX'


function Marco({ titulo, ancha, children }: {
  titulo: string
  ancha?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="pantalla-centrada">
      <div className={ancha ? 'tarjeta-acceso registro' : 'tarjeta-acceso'}>
        <Link to="/" className="volver-arriba">← Volver a ingresar</Link>
        <p className="marca">Reyban Consulting</p>
        <h1>{titulo}</h1>
        {children}
      </div>
    </div>
  )
}