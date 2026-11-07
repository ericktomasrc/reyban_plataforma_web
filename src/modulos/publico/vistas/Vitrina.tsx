import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { vitrinaServicio, type Vitrina } from '../servicios/vitrinaServicio'

/**
 * 074 — LA PÁGINA PÚBLICA (facturacion.reybanconsulting.com).
 *
 * Lo que se ve SIN iniciar sesión: inicio, precios, términos, privacidad,
 * devoluciones y contacto. La piden Culqi (para aprobar la cuenta) y Google
 * (para publicar «Entrar con Google»).
 *
 * Los precios salen de «Precios y reglas» y el contacto de «Página pública»:
 * si cambian allí, cambian aquí solos.
 */
const Contexto = createContext<Vitrina | null>(null)
export const useVitrina = () => useContext(Contexto)

export function MarcoPublico({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation()
  const [v, setV] = useState<Vitrina | null>(null)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    let vivo = true
    vitrinaServicio.leer().then(x => { if (vivo) setV(x) }).catch(() => { /* la página se ve igual, sin precios */ })
    return () => { vivo = false }
  }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  const e = v?.empresa
  const activo = ({ isActive }: { isActive: boolean }) => isActive ? 'activo' : undefined

  return (
    <Contexto.Provider value={v}>
      <div className="pub">
        <header className="pub-cabecera">
          <div className="pub-ancho pub-cabecera-fila">
            <Link to="/conoce" className="pub-marca" onClick={() => setMenu(false)}>
              <span className="pub-logo" aria-hidden="true">R</span>
              <span>Reyban <strong>Facturación</strong></span>
            </Link>
            <button type="button" className="pub-hamburguesa" aria-label="Menú" aria-expanded={menu} onClick={() => setMenu(m => !m)}>☰</button>
            <nav className={`pub-nav${menu ? ' abierto' : ''}`} onClick={() => setMenu(false)}>
              <NavLink to="/conoce" end className={activo}>Inicio</NavLink>
              <NavLink to="/precios" className={activo}>Precios</NavLink>
              <NavLink to="/contacto" className={activo}>Contacto</NavLink>
              <Link to="/entrar" className="pub-boton plano">Entrar</Link>
              <Link to="/registro?tipo=negocio" className="pub-boton">Prueba gratis</Link>
            </nav>
          </div>
        </header>

        <main className="pub-principal">{children ?? <Outlet />}</main>

        <footer className="pub-pie">
          <div className="pub-ancho pub-pie-rejilla">
            <div>
              <div className="pub-marca"><span className="pub-logo" aria-hidden="true">R</span><span>Reyban <strong>Facturación</strong></span></div>
              <p>Facturas, boletas, notas y guías de remisión electrónicas, enviadas a SUNAT desde tu navegador.</p>
            </div>
            <div>
              <h4>Servicios</h4>
              <Link to="/precios">Plan Básico</Link>
              <Link to="/precios">Plan Pro</Link>
              <Link to="/precios">Plan Max</Link>
              <Link to="/precios">Cuenta Profesional</Link>
              <Link to="/entrar">Entrar</Link>
            </div>
            <div>
              <h4>Legal</h4>
              <Link to="/terminos">Términos y condiciones</Link>
              <Link to="/privacidad">Política de privacidad</Link>
              <Link to="/devoluciones">Cambios, cancelaciones y devoluciones</Link>
              <Link to="/libro-reclamaciones">Libro de Reclamaciones</Link>
            </div>
            <div>
              <h4>Contacto</h4>
              {e?.whatsapp && <a href={`tel:+${numeroPeru(e.whatsapp)}`}>📞 {e.whatsapp}</a>}
              {e && <a href={`mailto:${e.correo}`}>✉ {e.correo}</a>}
              {e?.direccion && <span className="pub-pie-dato">📍 {e.direccion}</span>}
              {e?.whatsapp && <a href={`https://wa.me/${numeroPeru(e.whatsapp)}`} target="_blank" rel="noreferrer">WhatsApp</a>}
              <Link to="/contacto">Escríbenos</Link>
            </div>
            <div>
              <Link to="/libro-reclamaciones" className="pub-libro" aria-label="Libro de Reclamaciones">
                <span className="pub-libro-icono" aria-hidden="true" />
                <span>LIBRO DE<br />RECLAMACIONES</span>
              </Link>
            </div>
          </div>
          <div className="pub-ancho pub-pie-legal">
            © {new Date().getFullYear()} {e?.razonSocial ?? 'Reyban Consulting'}{e?.ruc ? ` · RUC ${e.ruc}` : ''}{e?.direccion ? ` · ${e.direccion}` : ''}
            {' · '}Pagos seguros con Culqi · Precios en soles, con IGV
          </div>
        </footer>
      </div>
    </Contexto.Provider>
  )
}

/** El marco de una página legal: título, fecha y texto. */
export function PaginaLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  const v = useVitrina()
  const fecha = v?.empresa.actualizado
    ? new Date(v.empresa.actualizado + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  return (
    <article className="pub-ancho pub-legal">
      <h1>{titulo}</h1>
      {fecha && <p className="pub-fecha">Última actualización: {fecha}</p>}
      {children}
    </article>
  )
}

/** Los datos de la empresa dentro de un texto legal. */
export function QuienesSomos() {
  const e = useVitrina()?.empresa
  return <>{e?.razonSocial ?? 'Reyban Consulting SAC'}{e?.ruc ? `, con RUC ${e.ruc}` : ''}{e?.direccion ? `, con domicilio en ${e.direccion}` : ''}</>
}

export function CorreoContacto() {
  const c = useVitrina()?.empresa.correo ?? 'reybanconsulting@gmail.com'
  return <a href={`mailto:${c}`}>{c}</a>
}

/** e221: el número con el código del Perú (51), como lo piden WhatsApp y el teléfono: 983138058 → 51983138058. */
export function numeroPeru(n: string) {
  const d = n.replace(/\D/g, '')
  return d.length === 9 ? '51' + d : d
}