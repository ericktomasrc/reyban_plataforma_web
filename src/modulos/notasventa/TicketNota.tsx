import type { Ref } from 'react'
import { NOMBRE_MEDIO } from '../deudas/deudasServicio'
import type { NotaVenta } from './notasVentaServicio'

/**
 * e282 (097) — EL TICKET DE 80 MM de una nota de venta. Se ve en pantalla y,
 * con imprimirTicket, se manda a la impresora tal cual (en un marco aparte,
 * para que salga solo el ticket y no la página).
 */

const d2 = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const cant = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('es-PE', { maximumFractionDigits: 4 }))
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-PE', {
  timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const dia = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function TicketNota({ n, ref }: { n: NotaVenta; ref?: Ref<HTMLDivElement> }) {
  const e = n.emisor
  const forma = n.forma === 'contado' ? `CONTADO${n.medio ? ` · ${(NOMBRE_MEDIO[n.medio] ?? n.medio).toUpperCase()}` : ''}`
    : n.forma === 'fiado' ? 'FIADO' : 'PEDIDO'
  return (
    <div className="nv-ticket" ref={ref}>
      <div className="t-centro">
        <strong>{e?.nombre ?? ''}</strong>
        {e?.razonSocial && e.razonSocial !== e.nombre && <div>{e.razonSocial}</div>}
        {e?.ruc && <div>RUC {e.ruc}</div>}
        {e?.direccion && <div>{e.direccion}</div>}
        {e?.telefono && <div>Tel. {e.telefono}</div>}
      </div>
      <hr />
      <div className="t-centro"><strong>NOTA DE VENTA</strong><div>{n.numero}</div></div>
      <hr />
      <div>Fecha: {fechaHora(n.fecha)}</div>
      <div>Cliente: {n.clienteNombre}</div>
      {n.cliente?.numeroDocumento && <div>{n.cliente.tipoDocumento === '6' ? 'RUC' : n.cliente.tipoDocumento === '1' ? 'DNI' : 'Doc.'}: {n.cliente.numeroDocumento}</div>}
      <hr />
      {n.lineas.map(l => (
        <div key={l.numero} className="t-linea">
          <div className="t-fila"><span>{cant(l.cantidad)} {l.descripcion}</span><span>{d2(l.importe)}</span></div>
          {l.cantidad !== 1 && <div className="t-sub">{cant(l.cantidad)} x {d2(l.precio)}</div>}
        </div>
      ))}
      <hr />
      <div className="t-fila t-total"><span>TOTAL S/</span><span>{d2(n.total)}</span></div>
      <div className="t-fila"><span>Forma de pago</span><span>{forma}</span></div>
      {n.forma === 'fiado' && n.vence && <div className="t-fila"><span>Paga hasta</span><span>{dia(n.vence)}</span></div>}
      {n.forma === 'fiado' && n.pagado > 0 && <div className="t-fila"><span>Pagado / debe</span><span>{d2(n.pagado)} / {d2(n.saldo)}</span></div>}
      {n.forma === 'pedido' && n.entregaFecha && <div className="t-fila"><span>Entrega</span><span>{dia(n.entregaFecha)}</span></div>}
      {n.nota && <div className="t-nota">{n.nota}</div>}
      {n.estado === 'anulada' && <div className="t-centro t-anulada">ANULADA</div>}
      <hr />
      <div className="t-centro t-pie">Documento interno, sin valor tributario.<br />Pide tu boleta o factura.</div>
    </div>
  )
}