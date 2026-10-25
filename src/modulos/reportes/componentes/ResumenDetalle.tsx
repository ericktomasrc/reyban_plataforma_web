import type { ReactNode } from 'react'
import { Pestanas } from '../../../componentes/Pestanas'
import { usePestana } from '../../../nucleo/hooks/usePestana'

/**
 * e176 — LOS REPORTES EN DOS PESTAÑAS: «Resumen» (cifras grandes y el gráfico
 * de los 10 primeros + «Otros») y «Detalle» (la tabla de 20 en 20, con orden).
 * Antes iban uno encima del otro y con 100 clientes la página no acababa.
 *
 * AL IMPRIMIR (o «PDF») salen las dos, una detrás de otra.
 */
export function ResumenDetalle({ resumen, detalle, filas }: {
  resumen: ReactNode
  detalle: ReactNode
  /** Cuántas filas tiene el detalle (sale en la pestaña). */
  filas?: number
}) {
  const [ver, setVer] = usePestana(['resumen', 'detalle'] as const, 'vista')
  return (
    <>
      <div className="solo-pantalla">
        <Pestanas etiqueta="Vista del reporte" valor={ver} onCambio={setVer} opciones={[
          { valor: 'resumen', texto: 'Resumen' },
          { valor: 'detalle', texto: 'Detalle', cuenta: filas },
        ]} />
      </div>
      <div className={ver === 'resumen' ? undefined : 'rd-oculta'}>{resumen}</div>
      <div className={ver === 'detalle' ? undefined : 'rd-oculta'}>{detalle}</div>
    </>
  )
}