import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Captcha } from '../../../componentes/Captcha'
import { ErrorApi } from '../../../nucleo/api/errores'
import { registroServicio } from '../../acceso/servicios/registroServicio'
import type { ConfigRegistro } from '../../acceso/servicios/registroServicio'
import { traspasosServicio } from '../../administracion/servicios/traspasosServicio'

const TOKEN_DE_PRUEBA = 'XXXX.DUMMY.TOKEN.XXXX'

type TipoDoc = 'ficha_ruc' | 'dni' | 'vigencia_poder' | 'certificado'

/**
 * RECLAMA TU EMPRESA (lienzo «Fase 4», pantalla 5; camino C).
 *
 * Para cuando el correo del titular ya no es de quien reclama, o la empresa
 * la tiene otra cuenta. Lo revisa una persona (el super administrador). Los
 * archivos viajan en el mismo envío y el back los guarda cifrados.
 */
export function ReclamarConDocumentos() {
  const [config, setConfig] = useState<ConfigRegistro>()
  const [captcha, setCaptcha] = useState('')
  const [vuelta, setVuelta] = useState(0)

  const [ruc, setRuc] = useState('')
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
  const [relacion, setRelacion] = useState('representante')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [explicacion, setExplicacion] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [archivos, setArchivos] = useState<Partial<Record<TipoDoc, File>>>({})

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [hecho, setHecho] = useState<string>()

  useEffect(() => {
    registroServicio.config()
      .then(c => { setConfig(c); if (c.captchaDePrueba) setCaptcha(TOKEN_DE_PRUEBA) })
      .catch(() => setConfig(undefined))
  }, [])

  const conCaptcha = !!config?.captchaSitio && !config.captchaDePrueba
  const juridica = ruc.replace(/\D/g, '').startsWith('20')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErrores({}); setGeneral(null)

    const f = new FormData()
    f.append('ruc', ruc); f.append('nombre', nombre); f.append('dni', dni)
    f.append('relacion', relacion); f.append('correo', correo.trim()); f.append('telefono', telefono)
    f.append('explicacion', explicacion); f.append('aceptaTerminos', acepta ? 'true' : 'false')
    f.append('captcha', captcha)
    for (const [tipo, archivo] of Object.entries(archivos)) if (archivo) f.append(tipo, archivo)

    setOcupado(true)
    try {
      setHecho((await traspasosServicio.reclamar(f)).mensaje)
    } catch (err) {
      const texto = err instanceof ErrorApi ? err.message : 'No se pudo enviar la solicitud.'
      const campo = err instanceof ErrorApi && err.codigo?.startsWith('campo_') ? err.codigo.slice(6) : undefined
      if (campo) setErrores({ [campo]: texto }); else setGeneral(texto)
      setCaptcha(config?.captchaDePrueba ? TOKEN_DE_PRUEBA : '')
      setVuelta(v => v + 1)
    } finally {
      setOcupado(false)
    }
  }

  if (hecho) {
    return (
      <Marco>
        <div className="aviso bien">{hecho}</div>
        <p className="nota">Avisamos a la cuenta que hoy tiene la empresa: tiene 5 días para responder.</p>
        <Link to="/" className="boton">Volver al ingreso</Link>
      </Marco>
    )
  }

  const mal = (c: string) => errores[c] ? { mal: true, pista: errores[c] } : {}

  return (
    <Marco>
      <p className="texto-paso">
        Para cuando el correo del titular ya no es tuyo, o la empresa la tiene otra cuenta. Lo revisa una
        persona, a mano.
      </p>

      <form onSubmit={enviar} className="reclamo">
        <section className="bloque formulario-panel">
          <h2>La empresa y tú</h2>
          <Campo etiqueta="RUC" className="mono" inputMode="numeric" maxLength={11}
                 value={ruc} onChange={e => setRuc(e.target.value)} {...mal('ruc')} />
          <Campo etiqueta="Tu nombre completo" value={nombre} onChange={e => setNombre(e.target.value)} {...mal('nombre')} />
          <Campo etiqueta="Tu DNI" className="mono" inputMode="numeric" maxLength={8}
                 value={dni} onChange={e => setDni(e.target.value)} {...mal('dni')} />
          <div className="campo">
            <label htmlFor="relacion">Tu relación con la empresa</label>
            <select id="relacion" value={relacion} onChange={e => setRelacion(e.target.value)}>
              <option value="representante">Gerente general / representante legal</option>
              <option value="titular">Titular (persona natural con negocio)</option>
              <option value="apoderado">Apoderado</option>
            </select>
          </div>
          <Campo etiqueta="Correo nuevo del titular" type="email" value={correo} onChange={e => setCorreo(e.target.value)}
                 {...(errores.correo ? { mal: true, pista: errores.correo }
                                     : { pista: 'Si aprobamos, este pasa a ser el correo del titular y te escribimos ahí.' })} />
          <Campo etiqueta="Teléfono (opcional)" value={telefono} onChange={e => setTelefono(e.target.value)} {...mal('telefono')} />
          <div className="campo">
            <label htmlFor="explicacion">Qué pasó</label>
            <textarea id="explicacion" rows={3} maxLength={1000} value={explicacion}
                      onChange={e => setExplicacion(e.target.value)}
                      placeholder="El correo antiguo era de mi ex contador y no tengo acceso." />
            {errores.explicacion && <span className="pista mal">{errores.explicacion}</span>}
          </div>
        </section>

        <section className="bloque formulario-panel">
          <h2>Documentos</h2>
          <Archivo tipo="ficha_ruc" titulo="Ficha RUC" detalle="De SUNAT, de este mes."
                   archivos={archivos} setArchivos={setArchivos} error={errores.ficha_ruc} />
          <Archivo tipo="dni" titulo="DNI" detalle="Ambas caras, en un PDF o una foto."
                   archivos={archivos} setArchivos={setArchivos} error={errores.dni_archivo} />
          <Archivo tipo="vigencia_poder" titulo={juridica ? 'Vigencia de poder' : 'Vigencia de poder (solo empresas)'}
                   detalle="De SUNARP, con no más de 30 días." opcional={!juridica}
                   archivos={archivos} setArchivos={setArchivos} error={errores.vigencia_poder} />
          <Archivo tipo="certificado" titulo="Certificado digital de este RUC" detalle="El .pfx. Es la prueba más fuerte."
                   opcional archivos={archivos} setArchivos={setArchivos} error={errores.certificado} acepta=".pfx,.p12" />

          <div className="aviso ojo">Avisaremos a la cuenta que hoy tiene la empresa y le daremos <strong>5 días</strong> para responder.</div>

          <label className="casilla-terminos">
            <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} />
            Acepto los términos de uso y la política de privacidad.
          </label>
          {errores.aceptaTerminos && <span className="pista mal">{errores.aceptaTerminos}</span>}

          {conCaptcha && (
            <div className="campo">
              <Captcha key={vuelta} sitio={config!.captchaSitio!} onToken={setCaptcha} />
              {errores.captcha && <span className="pista mal">{errores.captcha}</span>}
            </div>
          )}

          {general && <Aviso>{general}</Aviso>}

          <Boton type="submit" ancho ocupado={ocupado} textoOcupado="Enviando…">Enviar la solicitud</Boton>
          <p className="nota">Te respondemos en 3 días hábiles. Los documentos se guardan cifrados y solo los ve quien revisa.</p>
        </section>
      </form>
    </Marco>
  )
}


function Archivo({ tipo, titulo, detalle, opcional, archivos, setArchivos, error, acepta }: {
  tipo: TipoDoc
  titulo: string
  detalle: string
  opcional?: boolean
  archivos: Partial<Record<TipoDoc, File>>
  setArchivos: (f: (a: Partial<Record<TipoDoc, File>>) => Partial<Record<TipoDoc, File>>) => void
  error?: string
  acepta?: string
}) {
  const elegido = archivos[tipo]
  return (
    <div className="fila-archivo">
      <div>
        <strong>{titulo}</strong>{opcional && <span className="secundario"> (opcional)</span>}
        <span className="secundario">{detalle}</span>
        {error && <span className="pista mal">{error}</span>}
      </div>
      <label className="boton secundario">
        {elegido ? `✓ ${elegido.name}` : 'Subir PDF o foto'}
        <input type="file" hidden accept={acepta ?? '.pdf,.jpg,.jpeg,.png'}
               onChange={e => { const f = e.target.files?.[0]; setArchivos(a => ({ ...a, [tipo]: f })) }} />
      </label>
    </div>
  )
}


function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="pantalla-centrada">
      <div className="tarjeta-acceso registro">
        <Link to="/recuperar" className="volver-arriba">← Volver</Link>
        <p className="marca">Camino con documentos</p>
        <h1>Reclama tu empresa</h1>
        {children}
      </div>
    </div>
  )
}