import { useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { CamposFicha, fichaDe, paraEnviar, problemaFicha } from '../../usuarios/componentes/CamposFicha'
import type { DatosFicha } from '../../usuarios/componentes/CamposFicha'
import { perfilServicio } from '../servicios/perfilServicio'
import type { MiFicha } from '../tipos'

/**
 * 048 — MIS DATOS: la misma ficha que el personal, llenada por uno mismo.
 *
 * Se usa en tres sitios: el paso «Tus datos» al entrar por primera vez, la
 * ventana «Completa tus datos» (al emitir con la ficha incompleta) y la
 * pestaña «Mis datos» de Mi cuenta.
 *
 * El cargo y la fecha de ingreso no se editan aquí: los pone quien da el
 * trabajo. Se enseñan debajo, de solo lectura, si los hay.
 *
 * El formulario no trae botones: quien lo usa pone el suyo con form={id}.
 */
export function FormularioMiFicha({ id, onGuardado, onCargada, onOcupado }: {
  id: string
  /** Mientras se guarda (para el «Guardando…» del botón de quien lo usa). */
  onOcupado?: (ocupado: boolean) => void
  onGuardado: (mensaje: string) => void
  /** Al leerla: ¿ya estaba completa? (para decir «revisa» en vez de «completa»). */
  onCargada?: (completa: boolean) => void
}) {
  const { refrescar } = useSesion()
  const mensaje = useMensaje()

  const [original, setOriginal] = useState<MiFicha>()
  const [valor, setValor] = useState<DatosFicha>()
  const [campoMal, setCampoMal] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string>()

  useEffect(() => {
    let vivo = true
    perfilServicio.ficha()
      .then(f => {
        if (!vivo) return
        setOriginal(f)
        const datos = fichaDe(f)
        setValor(datos)
        onCargada?.(problemaFicha(datos) === null)
      })
      .catch(err => { if (vivo) setFallo(err instanceof ErrorApi ? err.message : 'No se pudieron leer tus datos.') })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!valor) return

    const problema = problemaFicha(valor)
    if (problema) {
      setCampoMal(problema[1])
      mensaje.error(problema[0].replace('sus nombres', 'tus nombres').replace('su apellido', 'tu apellido'))
      return
    }

    onOcupado?.(true)
    try {
      const r = await perfilServicio.guardarFicha(paraEnviar(valor))
      setCampoMal(null)
      // La cabecera enseña el nombre y la franja de «completa tus datos»:
      // salen de /api/yo.
      await refrescar()
      onGuardado(r.mensaje)
    } catch (err) {
      if (err instanceof ErrorApi) {
        setCampoMal(err.campo ?? null)
        mensaje.error(err.message)
      } else {
        mensaje.error('No se pudieron guardar tus datos.')
      }
    } finally {
      onOcupado?.(false)
    }
  }

  if (fallo) return <Aviso>{fallo}</Aviso>
  if (!valor || !original) return <Cargando texto="Leyendo tus datos…" />

  return (
    <form id={id} onSubmit={e => void guardar(e)} className="ficha-propia">
      <section className="ficha-seccion">
        <CamposFicha valor={valor} onCambio={setValor} campoMal={campoMal} sinTrabajo />
      </section>

      {(original.cargo || original.fechaIngreso) && (
        <p className="nota">
          {original.cargo && <>Cargo: <strong>{original.cargo}</strong></>}
          {original.cargo && original.fechaIngreso && ' · '}
          {original.fechaIngreso && <>Ingresó el {fecha(original.fechaIngreso)}</>}
          {' '}— los pone tu administrador.
        </p>
      )}

      <p className="nota">
        Tus datos los ven tú y los administradores de tu empresa (Ley 29733). Cada comprobante que emitas queda
        a tu nombre.
      </p>
    </form>
  )
}