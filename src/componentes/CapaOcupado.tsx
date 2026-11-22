/**
 * VELO DE ESPERA (e273).
 *
 * Para lo que tarda más de un par de segundos y no se debe repetir: emitir a
 * SUNAT, cobrar, importar un Excel, revisar un certificado. Tapa la pantalla,
 * dice qué pasa y pide no cerrar. Lo rápido (guardar un dato) sigue con el
 * botón «ocupado», sin velo.
 */
export function CapaOcupado({ texto, detalle = 'No cierres ni recargues esta ventana.' }: { texto: string; detalle?: string }) {
  return (
    <div className="capa-ocupado" role="status" aria-live="assertive" aria-busy="true">
      <div className="capa-ocupado-caja">
        <div className="girador" aria-hidden="true" />
        <p className="texto">{texto}</p>
        <p className="detalle">{detalle}</p>
      </div>
    </div>
  )
}