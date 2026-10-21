import { useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { CodigoQr } from '../../../componentes/CodigoQr'
import { CodigosDeRescate } from '../../../componentes/CodigosDeRescate'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import type { QrSegundoFactor } from '../../../nucleo/sesion/tipos'
import { accesoServicio } from '../servicios/accesoServicio'
import { recuperacion2faServicio } from '../servicios/recuperacion2faServicio'
import type { MiRecuperacion } from '../servicios/recuperacion2faServicio'
import { PedirRecuperacion, RecuperacionEnCurso } from './RecuperacionConEspera'

/**
 * El segundo factor, con la sesión a medias.
 *
 * DOS SITUACIONES EN UNA PANTALLA, y las decide el servidor:
 *
 *   · `debeConfigurar` → nunca lo tuvo: se le enseña el QR.
 *   · si no            → ya lo tiene: se le piden seis dígitos.
 *
 * La segunda ofrece además la puerta de atrás: un código de recuperación,
 * para quien perdió el teléfono.
 *
 * Esto no es la seguridad: la sesión está a medias en el servidor y ningún
 * endpoint responde hasta que se supere. Aquí solo se pinta lo que toca.
 */
export function SegundoFactor({ debeConfigurar }: { debeConfigurar: boolean }) {
  return debeConfigurar ? <Configurar /> : <PedirCodigo />
}


// =============================================================================
// PRIMERA VEZ: escanear el QR
// =============================================================================

function Configurar() {
  const { refrescar, salir } = useSesion()
  const mensaje = useMensaje()

  const [qr, setQr]         = useState<QrSegundoFactor>()
  const [fallo, setFallo]   = useState<string>()
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [rescate, setRescate]   = useState<string[]>()

  useEffect(() => {
    let vivo = true

    void (async () => {
      try {
        const datos = await accesoServicio.prepararSegundoFactor()
        if (vivo) setQr(datos)
      } catch (e) {
        if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudo preparar el código.')
      }
    })()

    return () => { vivo = false }
  }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)

    try {
      const r = await accesoServicio.confirmarSegundoFactor(codigo)
      setRescate(r.codigosRecuperacion)
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo confirmar.')
      setEnviando(false)
    }
  }

  // Los códigos de rescate se enseñan ANTES de dejar pasar. Después de esta
  // pantalla ya no existen en ningún sitio legible.
  if (rescate) {
    return (
      <div className="pantalla-centrada">
        <div className="tarjeta-acceso ancha">
          <p className="marca">Reyban Consulting</p>
          <h1>Tus códigos de recuperación</h1>
          <CodigosDeRescate codigos={rescate} onSeguir={() => void refrescar()} />
        </div>
      </div>
    )
  }

  if (fallo) {
    return (
      <div className="pantalla-centrada">
        <div className="tarjeta-acceso">
          <p className="marca">Reyban Consulting</p>
          <h1>Algo falló</h1>
          <Aviso>{fallo}</Aviso>
          <Boton estilo="secundario" ancho onClick={() => void salir()}>Salir</Boton>
        </div>
      </div>
    )
  }

  if (!qr) return <Cargando texto="Preparando tu código…" />

  return (
    <div className="pantalla-centrada">
      <form className="tarjeta-acceso ancha" onSubmit={enviar}>
        <p className="marca">Reyban Consulting</p>
        <h1>Configura tu segundo factor</h1>
        <p className="bajada">
          Hace falta para entrar. Necesitas una aplicación de códigos en el
          teléfono: Google Authenticator o Microsoft Authenticator sirven, y
          son gratis.
        </p>
        <ol className="pasos">
          <li>Abre la aplicación y pulsa «Añadir cuenta» o el signo +.</li>
          <li>Escanea este código:</li>
        </ol>

        <CodigoQr contenido={qr.direccionQr} />

        <p className="nota centrado">
          ¿No puedes escanearlo? Escribe esta clave a mano:<br />
          <code className="clave-manual">{qr.secretoLegible}</code>
        </p>

        <ol className="pasos" start={3}>
          <li>Escribe aquí los seis dígitos que te muestre:</li>
        </ol>

        <Campo
          etiqueta="Código de seis dígitos"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          autoFocus
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
        />

        <Boton
          type="submit"
          ancho
          disabled={codigo.replace(/\D/g, '').length !== 6}
          ocupado={enviando}
          textoOcupado="Comprobando…"
        >
          Activar
        </Boton>

        <Boton estilo="plano" ancho onClick={() => void salir()} style={{ marginTop: 8 }}>
          Salir
        </Boton>
      </form>
    </div>
  )
}


// =============================================================================
// YA LO TIENE: pedir el código
// =============================================================================

function PedirCodigo() {
  const { refrescar, salir } = useSesion()
  const mensaje = useMensaje()

  const [codigo, setCodigo]     = useState('')
  const [enviando, setEnviando] = useState(false)
  const [rescatando, setRescatando] = useState(false)

  // 039: perdió el teléfono Y los códigos → recuperación con espera.
  const [sinNada, setSinNada] = useState(false)
  const [recuperacion, setRecuperacion] = useState<MiRecuperacion | null>(null)

  useEffect(() => {
    let vivo = true
    recuperacion2faServicio.mia()
      .then(r => { if (vivo) setRecuperacion(r.recuperacion) })
      .catch(() => { /* sin esto la pantalla sigue sirviendo */ })
    return () => { vivo = false }
  }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)

    try {
      if (rescatando) await accesoServicio.usarCodigoRecuperacion(codigo)
      else            await accesoServicio.validarSegundoFactor(codigo)

      await refrescar()
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo comprobar.')
      setEnviando(false)
    }
  }

  if (sinNada) {
    return (
      <div className="pantalla-centrada">
        <div className="tarjeta-acceso">
          <p className="marca">Reyban Consulting</p>
          <PedirRecuperacion
            onVolver={() => setSinNada(false)}
            onPedida={r => { setRecuperacion(r); setSinNada(false) }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pantalla-centrada">
      <form className="tarjeta-acceso" onSubmit={enviar}>
        <p className="marca">Reyban Consulting</p>

        {recuperacion && <RecuperacionEnCurso r={recuperacion} />}

        <h1>{rescatando ? 'Código de recuperación' : 'Código de seguridad'}</h1>

        <p className="bajada">
          {rescatando
            ? 'Escribe uno de los ocho códigos que guardaste al configurar tu cuenta. Cada uno sirve una sola vez.'
            : 'Abre tu aplicación de códigos y escribe los seis dígitos que te muestre.'}
        </p>
        <Campo
          etiqueta={rescatando ? 'Código de recuperación' : 'Código de seis dígitos'}
          inputMode={rescatando ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          required
          autoFocus
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          placeholder={rescatando ? 'ABCDE-FGHJK' : undefined}
        />

        <Boton type="submit" ancho ocupado={enviando} textoOcupado="Comprobando…">
          Entrar
        </Boton>

        <Boton
          estilo="plano"
          ancho
          style={{ marginTop: 8 }}
          onClick={() => { setRescatando(!rescatando); setCodigo('') }}
        >
          {rescatando ? 'Volver al código del teléfono' : 'Perdí mi teléfono'}
        </Boton>

        {/* 039: sin teléfono y sin códigos. */}
        {rescatando && !recuperacion && (
          <Boton estilo="plano" ancho onClick={() => setSinNada(true)}>
            Tampoco tengo mis códigos
          </Boton>
        )}

        <Boton estilo="plano" ancho onClick={() => void salir()}>Salir</Boton>
      </form>
    </div>
  )
}