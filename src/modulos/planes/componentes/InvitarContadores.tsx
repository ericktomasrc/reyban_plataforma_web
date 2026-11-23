import { useEffect, useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { codigoInvitacionGuardado, olvidarCodigoInvitacion } from '../invitar'
import { planesServicio, type MiInvitar } from '../servicios/planesServicio'

/**
 * e281 (096) — INVITA A OTROS CONTADORES (Cuenta Profesional). Su enlace, a
 * quién trajo y cuánto le falta a cada uno para el premio. Y, en su primer
 * mes, «¿te invitó alguien?».
 */
export function InvitarContadores({ puede }: { puede: boolean }) {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [d, setD] = useState<MiInvitar>()
  const [codigo, setCodigo] = useState(codigoInvitacionGuardado)
  const [recargar, setRecargar] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let vivo = true
    planesServicio.invitar().then(x => { if (vivo) setD(x) }).catch(() => { if (vivo) setD(undefined) })
    return () => { vivo = false }
  }, [recargar])

  if (!d || (!d.activo && !d.puedeAnotar)) return null
  const enlace = d.codigo ? `${window.location.origin}/registro?tipo=profesional&invita=${encodeURIComponent(d.codigo)}` : null

  async function copiar() {
    if (!enlace) return
    try { await navigator.clipboard.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
    catch { mensaje.ojo('No se pudo copiar: selecciona el enlace y cópialo a mano.') }
  }

  async function anotar() {
    const c = codigo.trim()
    if (!await pedir({
      titulo: '¿Te invitó este contador?',
      confirmar: 'Sí, anotar',
      mensaje: <p>Se anota el código <strong>{c}</strong> como quien te invitó. Solo se puede anotar una vez. A ti no te cambia nada de lo que pagas.</p>,
    })) return
    setOcupado(true)
    try {
      mensaje.bien((await planesServicio.anotarInvitacion(c)).mensaje)
      olvidarCodigoInvitacion()
      setRecargar(n => n + 1)
    } catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo anotar.') }
    finally { setOcupado(false) }
  }

  return (
    <section className="bloque inv-caja">
      {dialogo}
      {d.activo && enlace && (
        <>
          <h2>Invita a otros contadores y gana meses gratis</h2>
          <p className="secundario">
            Por cada contador que se registre con tu enlace y pague <strong>{d.mesesPagados} meses</strong>, te regalamos{' '}
            <strong>{d.premioMeses} mes{d.premioMeses === 1 ? '' : 'es'} gratis</strong> de tu Plan Cartera (hasta {d.empresasMax} empresas).
            Hasta {d.topeAnual} meses de premio al año{d.ganadosAnio > 0 ? `: ya ganaste ${d.ganadosAnio}` : ''}.
          </p>
          <div className="inv-enlace">
            <input readOnly className="sin-mayusculas" value={enlace} aria-label="Tu enlace para invitar" onFocus={e => e.target.select()} />
            <Boton estilo="secundario" onClick={() => void copiar()}>{copiado ? 'Copiado ✓' : 'Copiar enlace'}</Boton>
          </div>
          <p className="nota">También pueden escribir tu código <strong className="mono">{d.codigo}</strong> en su Plan Cartera durante su primer mes.</p>
          {d.invitados.length > 0 && (
            <table className="tabla compacta inv-tabla">
              <thead><tr><th>Contador</th><th>Desde</th><th>Avance</th></tr></thead>
              <tbody>
                {d.invitados.map((x, i) => (
                  <tr key={i}>
                    <td>{x.nombre}</td>
                    <td className="secundario">{x.desde ? fecha(x.desde) : '—'}</td>
                    <td>{x.premio
                      ? <span className="ddu-estado bien">Premio: {x.premio.meses} mes{x.premio.meses === 1 ? '' : 'es'} gratis, hasta el {fecha(x.premio.hasta)}</span>
                      : <span className="secundario">Pagó {x.pagados} de {d.mesesPagados} meses</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      {d.invitadoPor && <p className="nota">Te invitó: <strong>{d.invitadoPor}</strong>.</p>}
      {d.puedeAnotar && puede && (
        <div className="inv-anotar">
          <span>¿Te invitó otro contador? Escribe su código:</span>
          <input className="sin-mayusculas" value={codigo} maxLength={40} placeholder="Ej.: anagarcia" aria-label="Código de invitación" onChange={e => setCodigo(e.target.value)} />
          <Boton estilo="secundario" disabled={codigo.trim().length < 3} ocupado={ocupado} onClick={() => void anotar()}>Anotar</Boton>
        </div>
      )}
    </section>
  )
}