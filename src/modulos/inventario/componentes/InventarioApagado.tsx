import { Link } from 'react-router-dom'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'

/** 052 — Lo que se ve en una pantalla de inventario con el inventario apagado. */
export function InventarioApagado({ titulo }: { titulo: string }) {
  const { puede } = useSesion()
  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">{titulo}</h1>
      </div>
      <div className="bloque">
        <h2 className="subtitulo">Tu empresa todavía no lleva inventario</h2>
        <p className="parrafo">
          Con el inventario apagado, la facturación funciona como siempre: nada se cuenta ni se bloquea.
          Encendido, sabes cuánto hay de cada producto en cada sucursal, y nada se bloquea hasta que cargues
          el stock inicial y elijas «Empezar a controlar».
        </p>
        {puede(Permisos.Inventario.Configurar)
          ? <Link className="boton" to="/inventario/configuracion">Ir a encender el inventario</Link>
          : <p className="nota">Pídele al administrador de tu empresa que lo encienda (Inventario › Configuración).</p>}
      </div>
    </>
  )
}