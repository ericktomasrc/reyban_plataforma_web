import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Captcha } from '../../../componentes/Captcha'
import { ErrorApi } from '../../../nucleo/api/errores'
import { registroServicio, type ConfigRegistro } from '../../acceso/servicios/registroServicio'
import { reclamosServicio, type HojaReclamo } from '../servicios/vitrinaServicio'
import { useVitrina } from './Vitrina'

const TOKEN_DE_PRUEBA = 'XXXX.DUMMY.TOKEN.XXXX'

const VACIA: HojaReclamo = {
  tipo: 'reclamo', bien: 'servicio', nombre: '', docTipo: 'DNI', docNumero: '', domicilio: '', telefono: '',
  correo: '', apoderado: '', monto: '', descripcion: '', detalle: '', pedido: '', captcha: '',
}

/**
 * 078 — EL LIBRO DE RECLAMACIONES VIRTUAL, dentro de la página pública (lo
 * pide Indecopi y lo pide Culqi: nada de formularios ni enlaces de afuera).
 *
 * La hoja la numera la base (2026-000001). Al enviarla, el cliente ve su
 * número y le llega la copia al correo; a Reyban le llega el aviso.
 */
export function LibroReclamaciones() {
  const v = useVitrina()
  const e = v?.empresa
  const [h, setH] = useState<HojaReclamo>(VACIA)
  const [config, setConfig] = useState<ConfigRegistro>()
  const [vuelta, setVuelta] = useState(0)
  const [error, setError] = useState<{ texto: string; campo?: string }>()
  const [ocupado, setOcupado] = useState(false)
  const [hecho, setHecho] = useState<{ hoja: string; mensaje: string }>()

  useEffect(() => {
    registroServicio.config()
      .then(c => { setConfig(c); if (c.captchaDePrueba) setH(x => ({ ...x, captcha: TOKEN_DE_PRUEBA })) })
      .catch(() => setConfig(undefined))
  }, [])
  const conCaptcha = !!config?.captchaSitio && !config.captchaDePrueba
  const cambiar = <K extends keyof HojaReclamo>(k: K, valor: HojaReclamo[K]) => setH(x => ({ ...x, [k]: valor }))
  const mal = (campo: string) => error?.campo === campo

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    setError(undefined)
    if (conCaptcha && !h.captcha) { setError({ texto: 'Espera a que termine la comprobación anti-robot.', campo: 'captcha' }); return }
    setOcupado(true)
    try {
      const r = await reclamosServicio.registrar(h)
      setHecho(r)
      window.scrollTo(0, 0)
    } catch (x) {
      setError(x instanceof ErrorApi ? { texto: x.message, campo: x.campo } : { texto: 'No se pudo enviar. Revisa tu conexión y vuelve a intentarlo.' })
      setVuelta(n => n + 1)
      setH(x => ({ ...x, captcha: config?.captchaDePrueba ? TOKEN_DE_PRUEBA : '' }))
    } finally { setOcupado(false) }
  }

  const hoy = new Date().toLocaleDateString('es-PE', { timeZone: 'America/Lima' })
  const Proveedor = () => (
    <div className="libro-proveedor">
      <strong>{e?.razonSocial ?? 'Reyban'}</strong>
      {e?.ruc && <span>RUC {e.ruc}</span>}
      {e?.direccion && <span>{e.direccion}</span>}
      <span>Fecha: {hoy}</span>
    </div>
  )

  if (hecho) return (
    <section className="pub-seccion">
      <div className="pub-ancho libro">
        <div className="libro-hecho">
          <span className="libro-check" aria-hidden="true">✓</span>
          <h1>Hoja N.° {hecho.hoja}</h1>
          <p>{hecho.mensaje}</p>
          <p className="pub-nota">Guarda este número. Si no ves el correo, revisa tu carpeta de spam.</p>
          <Link to="/conoce" className="pub-boton">Volver al inicio</Link>
        </div>
      </div>
    </section>
  )

  return (
    <section className="pub-seccion">
      <form className="pub-ancho libro" onSubmit={enviar} noValidate>
        <div className="libro-cabeza">
          <div>
            <h1><span aria-hidden="true">📕</span> Libro de Reclamaciones</h1>
            <p className="pub-nota">Conforme al Código de Protección y Defensa del Consumidor (Ley N.° 29571). El número de hoja se asigna al enviar.</p>
          </div>
          <Proveedor />
        </div>

        <h2 className="libro-seccion">1. Tus datos</h2>
        <div className="libro-rejilla">
          <Campo t="Nombre completo *" mal={mal('nombre')}><input value={h.nombre} onChange={x => cambiar('nombre', x.target.value)} maxLength={200} autoComplete="name" /></Campo>
          <Campo t="Documento *" mal={mal('docTipo') || mal('docNumero')}>
            <div className="libro-doc">
              <select value={h.docTipo} onChange={x => cambiar('docTipo', x.target.value as HojaReclamo['docTipo'])}>
                <option value="DNI">DNI</option><option value="CE">Carné de extranjería</option><option value="RUC">RUC</option><option value="PASAPORTE">Pasaporte</option>
              </select>
              <input value={h.docNumero} onChange={x => cambiar('docNumero', x.target.value.trim())} maxLength={15} inputMode={h.docTipo === 'DNI' || h.docTipo === 'RUC' ? 'numeric' : 'text'} />
            </div>
          </Campo>
          <Campo t="Domicilio *" mal={mal('domicilio')}><input value={h.domicilio} onChange={x => cambiar('domicilio', x.target.value)} maxLength={300} autoComplete="street-address" /></Campo>
          <Campo t="Teléfono *" mal={mal('telefono')}><input value={h.telefono} onChange={x => cambiar('telefono', x.target.value)} maxLength={20} inputMode="tel" autoComplete="tel" /></Campo>
          <Campo t="Correo * (aquí te llega la copia)" mal={mal('correo')}><input type="email" value={h.correo} onChange={x => cambiar('correo', x.target.value)} maxLength={254} autoComplete="email" /></Campo>
          <Campo t="Si eres menor de edad: nombre de tu padre, madre o apoderado"><input value={h.apoderado} onChange={x => cambiar('apoderado', x.target.value)} maxLength={200} /></Campo>
        </div>

        <h2 className="libro-seccion">2. Lo que contrataste</h2>
        <div className="libro-opciones">
          <Opcion activa={h.bien === 'servicio'} onClick={() => cambiar('bien', 'servicio')}>Servicio</Opcion>
          <Opcion activa={h.bien === 'producto'} onClick={() => cambiar('bien', 'producto')}>Producto</Opcion>
        </div>
        <div className="libro-rejilla">
          <Campo t="Monto reclamado (S/)" mal={mal('monto')}><input value={h.monto} onChange={x => cambiar('monto', x.target.value)} inputMode="decimal" maxLength={12} placeholder="0.00" /></Campo>
          <Campo t="Descripción *" mal={mal('descripcion')}><input value={h.descripcion} onChange={x => cambiar('descripcion', x.target.value)} maxLength={300} placeholder="Por ejemplo: Plan Pro mensual" /></Campo>
        </div>

        <h2 className="libro-seccion">3. Tu reclamo o queja</h2>
        <div className="libro-opciones">
          <Opcion activa={h.tipo === 'reclamo'} onClick={() => cambiar('tipo', 'reclamo')}>Reclamo</Opcion>
          <Opcion activa={h.tipo === 'queja'} onClick={() => cambiar('tipo', 'queja')}>Queja</Opcion>
        </div>
        <p className="pub-nota"><strong>Reclamo:</strong> no estás conforme con el producto o servicio. <strong>Queja:</strong> tu malestar no es por el producto o servicio, sino por la atención.</p>
        <Campo t="Detalle * (qué pasó)" mal={mal('detalle')}><textarea value={h.detalle} onChange={x => cambiar('detalle', x.target.value)} maxLength={3000} rows={4} /></Campo>
        <Campo t="Pedido * (qué solicitas)" mal={mal('pedido')}><textarea value={h.pedido} onChange={x => cambiar('pedido', x.target.value)} maxLength={2000} rows={3} /></Campo>

        {conCaptcha && <div className="libro-captcha"><Captcha key={vuelta} sitio={config!.captchaSitio!} onToken={t => cambiar('captcha', t)} /></div>}

        {error && <div className="libro-error" role="alert">{error.texto}</div>}

        <div className="libro-acciones">
          <button type="submit" className="pub-boton" disabled={ocupado}>{ocupado ? 'Enviando…' : 'Enviar'}</button>
          <span className="pub-nota">Te enviaremos una copia con tu número de hoja.</span>
        </div>
        <p className="pub-nota libro-legal">
          El proveedor responderá en un plazo máximo de 15 días hábiles. La formulación del reclamo no impide acudir a otras
          vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.
        </p>
      </form>
    </section>
  )
}

function Campo({ t, mal, children }: { t: string; mal?: boolean; children: React.ReactNode }) {
  return <label className={'libro-campo' + (mal ? ' mal' : '')}><span>{t}</span>{children}</label>
}

function Opcion({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={'libro-opcion' + (activa ? ' activa' : '')} aria-pressed={activa} onClick={onClick}>{children}</button>
}