import { useNavigate } from 'react-router-dom'
import { BuscadorComprobante } from '../componentes/BuscadorComprobante'
import { notaCreditoServicio } from '../servicios/facturacionServicio'

/**
 * 24 OCT — «NUEVA NOTA DE CRÉDITO» / «NUEVA NOTA DE DÉBITO» desde el menú.
 *
 * Como en SOL: se elige la serie, se escribe el número y «Ver comprobante»
 * (o se busca por el cliente). Lleva a la MISMA pantalla de nota que se abre
 * desde el comprobante: no es otra forma de emitir, es otra puerta.
 * (En rutas.tsx lleva `key`: al pasar de una nota a la otra, empieza de cero.)
 */
export function NuevaNota({ tipo }: { tipo: 'credito' | 'debito' }) {
  const navegar = useNavigate()
  const nombre = tipo === 'credito' ? 'nota de crédito' : 'nota de débito'

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Nueva {nombre}</h1>
      </div>

      <div className="bloque">
        <h2 className="subtitulo">¿De qué comprobante?</h2>
        <p className="secundario">Elige la serie y escribe el número de la factura o boleta, o búscala por el cliente.</p>
        <BuscadorComprobante buscar={notaCreditoServicio.buscar} series={notaCreditoServicio.series}
                             onElegir={id => navegar(`/facturacion/comprobantes/${id}/nota-${tipo}`)} />
        <p className="nota se-aplica">
          Se aplica: solo facturas y boletas emitidas. La nota sale con el cliente, la moneda y los productos del comprobante.
        </p>
      </div>
    </>
  )
}