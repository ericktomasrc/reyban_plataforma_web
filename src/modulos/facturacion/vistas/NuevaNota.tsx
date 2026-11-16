import { Link, useNavigate } from 'react-router-dom'
import { BuscadorComprobante } from '../componentes/BuscadorComprobante'
import { notaCreditoServicio } from '../servicios/facturacionServicio'
import '../comprobantes-lista.css'

/**
 * 24 OCT — «NUEVA NOTA DE CRÉDITO» / «NUEVA NOTA DE DÉBITO» desde el menú.
 *
 * Como en SOL: se elige la serie, se escribe el número y «Ver comprobante»
 * (o se busca por el cliente). Lleva a la MISMA pantalla de nota que se abre
 * desde el comprobante: no es otra forma de emitir, es otra puerta.
 * (En rutas.tsx lleva `key`: al pasar de una nota a la otra, empieza de cero.)
 *
 * Diseño 15 nov: arriba se pasa de una nota a la otra, y una línea dice qué
 * hace cada una. La búsqueda es la misma.
 */
export function NuevaNota({ tipo }: { tipo: 'credito' | 'debito' }) {
  const navegar = useNavigate()
  const nombre = tipo === 'credito' ? 'nota de crédito' : 'nota de débito'

  return (
    <>
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">Nueva {nombre}</h1>
          <p className="bajada-pagina">Busca la factura o boleta que quieres modificar. La nota sale con su cliente, moneda y productos.</p>
        </div>
        <nav className="nt-cambio" aria-label="Tipo de nota">
          <Link to="/facturacion/notas/nueva-credito" className={tipo === 'credito' ? 'elegido' : undefined}
                aria-current={tipo === 'credito' ? 'page' : undefined}>Nota de crédito</Link>
          <Link to="/facturacion/notas/nueva-debito" className={tipo === 'debito' ? 'elegido' : undefined}
                aria-current={tipo === 'debito' ? 'page' : undefined}>Nota de débito</Link>
        </nav>
      </div>

      <div className="nt-explica">
        <Link to="/facturacion/notas/nueva-credito" className={tipo === 'credito' ? 'elegido' : undefined}>
          <span className="cmp-sigla t01" aria-hidden="true">NC</span>
          <span><strong>Nota de crédito: baja lo cobrado</strong>Devolución, descuento después de la venta, anulación o un error en el comprobante.</span>
        </Link>
        <Link to="/facturacion/notas/nueva-debito" className={tipo === 'debito' ? 'elegido' : undefined}>
          <span className="cmp-sigla t03" aria-hidden="true">ND</span>
          <span><strong>Nota de débito: sube lo cobrado</strong>Intereses por pago tardío, una penalidad o un aumento en el valor.</span>
        </Link>
      </div>

      <div className="bloque">
        <h2 className="subtitulo nt-subtitulo">¿De qué comprobante?</h2>
        <BuscadorComprobante buscar={notaCreditoServicio.buscar} series={notaCreditoServicio.series}
                             accion={tipo === 'credito' ? 'Hacer nota de crédito' : 'Hacer nota de débito'}
                             onElegir={id => navegar(`/facturacion/comprobantes/${id}/nota-${tipo}`,
                                                     { state: { volverA: `/facturacion/notas/nueva-${tipo}` } })} />
      </div>
    </>
  )
}