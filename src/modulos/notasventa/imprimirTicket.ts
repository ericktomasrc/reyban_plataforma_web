/** e282 (097): imprimir el ticket de 80 mm en un marco aparte (sale solo el ticket). */
const ESTILO_TICKET = `
  @page { size: 80mm auto; margin: 3mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .nv-ticket { width: 72mm; font: 11.5px/1.35 "Courier New", ui-monospace, monospace; color: #000; }
  .nv-ticket hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .t-centro { text-align: center; }
  .t-fila { display: flex; justify-content: space-between; gap: 8px; }
  .t-fila span:first-child { overflow-wrap: anywhere; }
  .t-fila span:last-child { white-space: nowrap; }
  .t-sub { padding-left: 12px; font-size: 10.5px; }
  .t-total { font-weight: 700; font-size: 13px; }
  .t-nota { margin-top: 4px; font-style: italic; }
  .t-anulada { font-weight: 700; margin-top: 6px; }
  .t-pie { font-size: 10.5px; }
`

export function imprimirTicket(nodo: HTMLElement, titulo: string) {
  const marco = document.createElement('iframe')
  marco.setAttribute('aria-hidden', 'true')
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(marco)
  const doc = marco.contentDocument
  const ventana = marco.contentWindow
  if (!doc || !ventana) { marco.remove(); return }
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo.replace(/[<>&]/g, '')}</title><style>${ESTILO_TICKET}</style></head><body>${nodo.outerHTML}</body></html>`)
  doc.close()
  const quitar = () => setTimeout(() => marco.remove(), 1000)
  ventana.addEventListener('afterprint', quitar, { once: true })
  setTimeout(() => {
    try { ventana.focus(); ventana.print() } catch { /* el navegador no dejó: queda en pantalla para imprimir a mano */ }
    setTimeout(() => marco.remove(), 60_000)
  }, 150)
}