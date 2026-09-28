import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * Dibuja un código de barras cuadrado a partir de una dirección.
 *
 * SE GENERA EN EL NAVEGADOR, no en el servidor. Así el secreto del segundo
 * factor no tiene que viajar dos veces —una para el QR y otra para el texto—
 * ni queda una imagen suya en ningún registro de servidor intermedio.
 *
 * `toDataURL` devuelve la imagen como texto dentro del propio `src`, así que
 * no hay ninguna petición de red por medio.
 */
export function CodigoQr({ contenido, lado = 220 }: { contenido: string; lado?: number }) {
  const [imagen, setImagen] = useState<string>()
  const [fallo, setFallo]   = useState(false)

  useEffect(() => {
    let vivo = true

    QRCode.toDataURL(contenido, {
      width: lado,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#16202a', light: '#ffffff' },
    })
      .then(url => { if (vivo) setImagen(url) })
      .catch(() => { if (vivo) setFallo(true) })

    return () => { vivo = false }
  }, [contenido, lado])

  if (fallo) {
    return (
      <p className="vacio">
        No se pudo dibujar el código. Usa la clave de abajo escribiéndola a mano.
      </p>
    )
  }

  return (
    <div className="qr" style={{ minHeight: lado }}>
      {imagen && (
        <img
          src={imagen}
          width={lado}
          height={lado}
          // El QR no se puede describir con palabras útiles, y quien use un
          // lector de pantalla necesita la clave de texto, no la imagen.
          alt=""
        />
      )}
    </div>
  )
}
