import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { Si } from '../../../nucleo/autorizacion/Protegido'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { InventarioApagado } from '../componentes/InventarioApagado'
import { ListaOperaciones } from '../componentes/ListaOperaciones'
import { useEstadoInventario } from '../componentes/usoInventario'
import '../inventario.css'
import '../../facturacion/comprobantes-lista.css'

/** 052 — INGRESOS POR COMPRA: la lista, con lo más nuevo arriba. */
export function Ingresos() {
  const navegar = useNavigate()
  const { estado, error } = useEstadoInventario()
  if (error) return <Aviso>{error}</Aviso>
  if (!estado) return <Cargando />
  if (!estado.encendido) return <InventarioApagado titulo="Ingresos por compra" />

  return (
    <div className="inv-pagina">
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">Ingresos por compra</h1>
          <p className="bajada-pagina">Cuando te llega mercadería de un proveedor, la anotas aquí y el stock sube. Ejemplo: llegaron 24 gaseosas → un ingreso de 24. Solo se anota la factura del proveedor: no se envía nada a SUNAT.</p>
        </div>
        <Si puede={Permisos.Inventario.Ingresar}>
          <Boton onClick={() => navegar('/inventario/ingresos/nuevo')}>+ Nuevo ingreso</Boton>
        </Si>
      </div>
      <ListaOperaciones tipo="ingreso" />
    </div>
  )
}