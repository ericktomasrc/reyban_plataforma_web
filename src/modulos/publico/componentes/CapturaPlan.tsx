/**
 * e217: LA IMAGEN DE CADA SERVICIO en la página pública (Culqi pide una foto o
 * imagen por producto). Es una vista en miniatura de la plataforma, dibujada
 * con HTML y CSS: pesa nada, se ve nítida en cualquier pantalla y muestra lo
 * que trae cada plan (comprobantes, inventario, caja, reportes, cartera).
 */
import type { ReactNode } from 'react'

type Tipo = 'basico' | 'pro' | 'max' | 'anual' | 'profesional' | string

export function CapturaPlan({ tipo, cinta }: { tipo: Tipo; cinta?: string }) {
  return (
    <div className="pub-captura" role="img" aria-label={`Vista de la plataforma: ${TITULO[tipo] ?? 'facturación'}`}>
      {cinta && <span className="pub-captura-cinta">{cinta}</span>}
      <div className="pub-ventana">
        <div className="pub-ventana-barra"><i /><i /><i /><span>{TITULO[tipo] ?? 'Reyban Facturación'}</span></div>
        <div className="pub-ventana-cuerpo">
          <div className="pub-ventana-menu">{(MENU[tipo] ?? MENU.basico).map((m, i) => <b key={m} className={i === 0 ? 'on' : ''}>{m}</b>)}</div>
          <div className="pub-ventana-main">{CONTENIDO[tipo]?.() ?? CONTENIDO.basico()}</div>
        </div>
      </div>
    </div>
  )
}

const TITULO: Record<string, string> = {
  basico: 'Comprobantes', pro: 'Inventario', max: 'Punto de venta', anual: 'Reportes', profesional: 'Mi cartera',
}

const MENU: Record<string, string[]> = {
  basico: ['Comprobantes', 'Clientes', 'Productos', 'Guías'],
  pro: ['Inventario', 'Compras', 'Kardex', 'Ganancias'],
  max: ['Caja', 'Lotes', 'Series', 'Almacenes'],
  anual: ['Reportes', 'Ventas', 'IGV', 'Registro'],
  profesional: ['Cartera', 'Empresas', 'Equipo', 'Reportes'],
}

const Fila = ({ a, b, ok }: { a: string; b: string; ok?: boolean }) => (
  <div className="pub-vfila"><span>{a}</span><em className={ok === false ? 'mal' : ok ? 'ok' : ''}>{b}</em></div>
)

const CONTENIDO: Record<string, () => ReactNode> = {
  basico: () => <>
    <div className="pub-vtitulo">Factura F001-00000124</div>
    <Fila a="Cliente" b="Ferretería El Norte" />
    <Fila a="Total" b="S/ 1,180.00" />
    <Fila a="SUNAT" b="✓ Aceptada" ok />
    <div className="pub-vboton">Enviar por WhatsApp</div>
  </>,
  pro: () => <>
    <div className="pub-vtitulo">Stock por sucursal</div>
    <Fila a="Cemento Sol 42.5" b="128 bolsas" ok />
    <Fila a="Fierro 1/2″" b="64 varillas" ok />
    <Fila a="Pintura látex" b="3 galones" ok={false} />
    <div className="pub-vkpis"><span>Compras<br /><b>S/ 8,420</b></span><span>Ganancia<br /><b>S/ 2,315</b></span></div>
  </>,
  max: () => <>
    <div className="pub-vtitulo">Caja 1 · abierta</div>
    <Fila a="2 × Galletas" b="S/ 3.00" />
    <Fila a="1 × Leche 1L" b="S/ 4.50" />
    <div className="pub-vtotal">Total S/ 7.50</div>
    <div className="pub-vboton">Cobrar y emitir boleta</div>
  </>,
  anual: () => <>
    <div className="pub-vtitulo">Ventas del año</div>
    <div className="pub-vbarras">{[38, 52, 46, 61, 58, 72, 69, 80, 76, 88, 84, 95].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}</div>
    <Fila a="Total vendido" b="S/ 184,250" ok />
  </>,
  profesional: () => <>
    <div className="pub-vtitulo">12 empresas</div>
    <Fila a="Bodega Doña Rosa" b="✓ Al día" ok />
    <Fila a="Transportes Inca" b="✓ Al día" ok />
    <Fila a="Distribuidora Sur" b="2 por revisar" ok={false} />
    <Fila a="Ferretería El Norte" b="✓ Al día" ok />
  </>,
}