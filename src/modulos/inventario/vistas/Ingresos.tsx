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

/** 052 — INGRESOS POR COMPRA: la lista, con lo más nuevo arriba. */
export function Ingresos() {
  const navegar = useNavigate()
  const { estado, error } = useEstadoInventario()
  if (error) return <Aviso>{error}</Aviso>
  if (!estado) return <Cargando />
  if (!estado.encendido) return <InventarioApagado titulo="Ingresos por compra" />

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Ingresos por compra</h1>
          <p className="secundario">La mercadería que llegó de un proveedor. Suma al físico de la sucursal. No es un comprobante electrónico: se anota la factura del proveedor.</p>
        </div>
        <Si puede={Permisos.Inventario.Ingresar}>
          <Boton onClick={() => navegar('/inventario/ingresos/nuevo')}>Nuevo ingreso</Boton>
        </Si>
      </div>
      <ListaOperaciones tipo="ingreso" />
    </>
  )
}