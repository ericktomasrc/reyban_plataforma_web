import { useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando, Vacio } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { planesServicio, type InvitarAdmin, type ReglasInvitar } from '../servicios/planesServicio'
import { FilaRegla, GrupoRegla } from './Reglas'

/**
 * e281 (096) — PLANES Y COBROS › PREMIOS POR INVITAR (super admin). Las reglas
 * del premio y quién trajo a quién. El premio lo da solo el ciclo de cobros
 * cuando el invitado ya pagó los meses pedidos (nunca antes de cobrar).
 */
export function PremiosInvitar({ puede }: { puede: boolean }) {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [d, setD] = useState<InvitarAdmin>()
  const [r, setR] = useState<ReglasInvitar>()
  const [fallo, setFallo] = useState<string>()
  const [recargar, setRecargar] = useState(0)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    planesServicio.invitarAdmin()
      .then(x => { if (vivo) { setD(x); setR(x.reglas); setFallo(undefined) } })
      .catch(e => { if (vivo) setFallo(e instanceof ErrorApi ? e.message : 'No se pudieron leer los premios.') })
    return () => { vivo = false }
  }, [recargar])

  if (fallo) return <Aviso>{fallo}</Aviso>
  if (!d || !r) return <Cargando />
  const regla = <K extends keyof ReglasInvitar>(k: K, v: ReglasInvitar[K]) => setR(x => x && ({ ...x, [k]: v }))
  const premios = d.filas.filter(f => f.premio)

  async function guardar() {
    if (!r) return
    if (!await pedir({
      titulo: '¿Guardar las reglas del premio?',
      confirmar: 'Sí, guardar',
      mensaje: r.activo
        ? <p>Encendido: cada contador que traen y paga <strong>{r.mesesPagados} meses</strong> le da <strong>{r.premioMeses} mes{r.premioMeses === 1 ? '' : 'es'} gratis</strong> a
            quien lo invitó (hasta {r.empresasMax} empresas, máximo {r.topeAnual} meses al año). Los premios ya dados no cambian.</p>
        : <p>Apagado: los enlaces siguen anotando quién invitó, pero <strong>no se dan premios</strong>. Los premios ya dados no cambian.</p>,
    })) return
    setOcupado(true)
    try { mensaje.bien((await planesServicio.reglasInvitar(r)).mensaje); setRecargar(n => n + 1) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.') }
    finally { setOcupado(false) }
  }

  return (
    <>
      {dialogo}
      <div className="bloque reglas-planes">
        <p className="secundario">
          Cada estudio contable tiene su enlace para invitar a otros contadores. <strong>El premio llega solo después de que el contador nuevo
          pagó</strong> los meses que pongas: así nunca regalas antes de cobrar. Se da como un descuento de 100 % con fecha de fin y aparece en
          Cuentas › Ajustar de quien invitó.
        </p>
        <GrupoRegla titulo="Premio por traer contadores" texto="Vale para todas las Cuentas Profesionales.">
          <FilaRegla etiqueta="Encendido" ayuda="Apagado: se anota quién invitó a quién, pero no se dan premios.">
            <label className="interruptor-chico"><input type="checkbox" disabled={!puede} checked={r.activo}
              onChange={e => regla('activo', e.target.checked)} /><span>{r.activo ? 'Sí' : 'No'}</span></label>
          </FilaRegla>
          <FilaRegla etiqueta="Premio por cada contador que trae" ayuda="Meses gratis de su Plan Cartera, desde su próximo cobro.">
            <span className="con-unidad"><input type="number" min={1} max={12} disabled={!puede} value={r.premioMeses}
              onChange={e => regla('premioMeses', Number(e.target.value))} /><em>meses gratis</em></span>
          </FilaRegla>
          <FilaRegla etiqueta="Se gana cuando el nuevo pagó" ayuda="Meses pagados por el contador invitado (sin contar su mes gratis).">
            <span className="con-unidad"><input type="number" min={1} max={24} disabled={!puede} value={r.mesesPagados}
              onChange={e => regla('mesesPagados', Number(e.target.value))} /><em>meses</em></span>
          </FilaRegla>
          <FilaRegla etiqueta="Tope de premios al año" ayuda="Máximo de meses gratis que una cuenta puede ganar invitando en 12 meses. 0 = sin premios.">
            <span className="con-unidad"><input type="number" min={0} max={24} disabled={!puede} value={r.topeAnual}
              onChange={e => regla('topeAnual', Number(e.target.value))} /><em>meses</em></span>
          </FilaRegla>
          <FilaRegla etiqueta="El mes gratis cubre hasta" ayuda="Si su cartera tiene más empresas, las demás pagan precio normal ese mes.">
            <span className="con-unidad"><input type="number" min={1} disabled={!puede} value={r.empresasMax}
              onChange={e => regla('empresasMax', Number(e.target.value))} /><em>empresas</em></span>
          </FilaRegla>
        </GrupoRegla>
        <div className="aviso ojo">
          Ejemplo: un contador nuevo con 10 empresas Básico paga {r.mesesPagados} meses antes del premio. El mes que regalas a quien lo invitó vale
          lo de su cartera (hasta {r.empresasMax} empresas).
        </div>
        {puede && <div className="acciones-bloque"><Boton ocupado={ocupado} onClick={() => void guardar()}>Guardar reglas</Boton></div>}
      </div>

      <div className="bloque sin-relleno">
        <div className="crt-cab-tabla">
          <h2>Quién trajo a quién</h2>
          <p className="secundario">{d.filas.length} invitado{d.filas.length === 1 ? '' : 's'} · {premios.length} premio{premios.length === 1 ? '' : 's'} dado{premios.length === 1 ? '' : 's'}.</p>
        </div>
        {d.filas.length === 0 ? <div className="relleno"><Vacio>Todavía nadie se registró con un enlace de invitación.</Vacio></div> : (
          <table className="tabla">
            <thead><tr><th>Invitó</th><th>Contador nuevo</th><th>Desde</th><th>Meses pagados</th><th>Premio</th></tr></thead>
            <tbody>
              {d.filas.map(f => (
                <tr key={f.invitadoId}>
                  <td>{f.invitador}</td>
                  <td>{f.invitado}</td>
                  <td className="secundario">{f.desde ? fecha(f.desde) : '—'}</td>
                  <td>{f.pagados} de {r.mesesPagados}</td>
                  <td>{f.premio
                    ? <span className="ddu-estado bien">{f.premio.meses} mes{f.premio.meses === 1 ? '' : 'es'} gratis, hasta el {fecha(f.premio.hasta)}</span>
                    : <span className="secundario">{f.pagados >= r.mesesPagados ? (r.activo ? 'Se da en la próxima hora' : 'Premio apagado') : 'Esperando que pague'}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}