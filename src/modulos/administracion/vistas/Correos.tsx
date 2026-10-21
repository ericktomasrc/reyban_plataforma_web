import { useCallback, useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { correosServicio } from '../servicios/correosServicio'
import type { CorreoFallido, EstadoCorreo } from '../servicios/correosServicio'

const QUE_ERA: Record<CorreoFallido['tipo'], string> = {
  confirmar_registro: 'Confirmar registro',
  invitacion: 'Invitación o enlace de acceso',
  restablecer_clave: 'Cambiar contraseña',
}

/**
 * 038 — CORREOS QUE NO SALIERON (maqueta 6). Solo el super administrador.
 *
 * Arriba, el estado del correo (si Gmail rechaza el usuario o la contraseña,
 * aquí se ve). Abajo, los correos de acceso que fallaron, con «Reenviar»: un
 * enlace nuevo, que anula el anterior.
 */
export function CorreosPagina() {
  const mensaje = useMensaje()
  const [estado, setEstado] = useState<EstadoCorreo | null>(null)
  const [fallidos, setFallidos] = useState<CorreoFallido[] | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [probando, setProbando] = useState(false)
  const [reenviando, setReenviando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await correosServicio.leer()
      setEstado(r.estado)
      setFallidos(r.fallidos)
      setFallo(null)
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo cargar.')
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  async function probar() {
    setProbando(true)
    try {
      const r = await correosServicio.probar()
      setEstado(r.estado)
      if (r.enviado) mensaje.bien(r.motivo ?? 'El correo funciona: Gmail aceptó el usuario y la contraseña.')
      else mensaje.error(r.motivo ?? 'El correo no funciona.')
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo probar el correo.')
    } finally {
      setProbando(false)
    }
  }

  async function reenviar(f: CorreoFallido) {
    setReenviando(f.id)
    try {
      const r = await correosServicio.reenviar(f.id)
      mensaje.bien(r.mensaje)
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo reenviar.')
      await cargar()
    } finally {
      setReenviando(null)
    }
  }

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">Correos que no salieron</h1>
        <Boton estilo="secundario" ocupado={probando} textoOcupado="Probando…" onClick={() => void probar()}>
          Probar el correo ahora
        </Boton>
      </div>
      <p className="texto-paso">
        Los correos de acceso (registro, invitaciones y cambio de contraseña) que no llegaron a salir.
      </p>

      {estado && !estado.habilitado && (
        <Aviso tono="ojo">
          <strong>El correo está apagado</strong> (MAIL_ENABLED=false): no sale nada, se escribe en el log.
        </Aviso>
      )}
      {estado && estado.habilitado && !estado.ok && (
        <Aviso>
          <strong>{estado.motivo ?? 'El correo no funciona'}.</strong>{' '}
          {estado.fallaDesde && <>Desde el {fechaYHora(estado.fallaDesde)} no sale ningún correo. </>}
          Revisa <code>MAIL_USERNAME</code> y <code>MAIL_PASSWORD</code>: la contraseña de aplicación tiene que ser de
          esa misma cuenta ({estado.cuenta || 'sin cuenta'}).
        </Aviso>
      )}
      {estado && estado.habilitado && estado.ok && estado.ultimaVez && (
        <Aviso tono="bien">
          El correo funciona ({estado.cuenta}). Última comprobación: {fechaYHora(estado.ultimaVez)}.
        </Aviso>
      )}

      {fallo && <Aviso>{fallo}</Aviso>}
      {!fallidos && !fallo && <Cargando />}
      {fallidos && (
        <table className="tabla">
          <thead>
            <tr><th>Fecha</th><th>Para</th><th>Qué era</th><th>Motivo</th><th><span className="solo-lector">Acción</span></th></tr>
          </thead>
          <tbody>
            {fallidos.map(f => (
              <tr key={f.id}>
                <td>{fechaYHora(f.ultimoEn)}</td>
                <td>
                  <div className="principal">{f.destino}</div>
                  {f.nombre && <div className="secundario">{f.nombre}</div>}
                </td>
                <td>{QUE_ERA[f.tipo]}{f.intentos > 1 && <div className="secundario">{f.intentos} intentos</div>}</td>
                <td>{f.motivo}</td>
                <td className="derecha">
                  <Boton estilo="secundario" ocupado={reenviando === f.id} textoOcupado="Enviando…"
                         disabled={reenviando !== null} onClick={() => void reenviar(f)}>
                    Reenviar
                  </Boton>
                </td>
              </tr>
            ))}
            {fallidos.length === 0 && (
              <tr><td colSpan={5} className="vacio">No hay correos pendientes. Todo lo que se mandó, salió.</td></tr>
            )}
          </tbody>
        </table>
      )}
      <p className="nota">«Reenviar» genera un enlace nuevo; el anterior deja de servir. Cuando un correo sale bien, desaparece de esta lista.</p>
    </>
  )
}