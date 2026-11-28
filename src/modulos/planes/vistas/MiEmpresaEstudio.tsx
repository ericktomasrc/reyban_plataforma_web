import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { NOMBRE_PLAN, diasQueFaltan, soles } from '../../../nucleo/planes/planes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { avisosServicio } from '../../avisos/avisosServicio'
import { carteraServicio } from '../../cartera/servicios/carteraServicio'
import { useCambioPlan } from '../componentes/CambioPlan'
import { etiquetaPlan, extraHoy, planesServicio, type CodigoPlan, type MiPlan } from '../servicios/planesServicio'
import '../../facturacion/comprobantes-lista.css'
import '../planes.css'

/**
 * e280 (095) — MI EMPRESA (Cuenta Profesional): la empresa del propio estudio,
 * la que factura sus honorarios. No es de la cartera: Básico gratis (con 2 o
 * más empresas en la cartera) y, si la sube a Pro o Max, paga solo la
 * diferencia, en el mismo cobro del Plan Cartera.
 */
export function MiEmpresaEstudio() {
  const mensaje = useMensaje()
  const navegar = useNavigate()
  const { refrescar } = useSesion()
  const { pedir, dialogo } = useConfirmar()
  const [datos, setDatos] = useState<MiPlan>()
  const [error, setError] = useState<string>()
  const [elegida, setElegida] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)

  const [recargar, setRecargar] = useState(0)
  // e285: el aviso del certificado de tu empresa.
  const [certificado, setCertificado] = useState<{ nivel: string; titulo: string; detalle: string | null } | null>(null)
  useEffect(() => {
    let vivo = true
    avisosServicio.listar().then(a => { if (vivo) setCertificado(a.miEmpresa ?? null) }).catch(() => { /* sin aviso */ })
    return () => { vivo = false }
  }, [])
  useEffect(() => {
    let vivo = true
    planesServicio.mio()
      .then(d => { if (vivo) { setDatos(d); setError(undefined) } })
      .catch(e => { if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar tu empresa.') })
    return () => { vivo = false }
  }, [recargar])
  const hecho = async (m: string) => { if (m) mensaje.bien(m); setRecargar(n => n + 1); await refrescar() }
  const cambio = useCambioPlan(hecho)

  if (error) return <Aviso>{error}</Aviso>
  if (!datos) return <Cargando />
  const { catalogo, cuenta, puedeCambiar: puede } = datos
  if (!cuenta || cuenta.tipo !== 'profesional')
    return <Aviso tono="info">«Mi empresa» es de la Cuenta Profesional. Tu empresa está en el menú de siempre.</Aviso>

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  const oferta = catalogo.enOferta || (!!cuenta.lanzamientoHasta && cuenta.lanzamientoHasta >= hoy)
  const estudio = cuenta.empresas.find(e => e.esDelEstudio) ?? null
  const otras = cuenta.empresas.filter(e => !e.esDelEstudio && !e.pausada)
  const orden = (c: CodigoPlan) => catalogo.planes.find(p => p.codigo === c)?.orden ?? 0

  async function entrar() {
    if (!estudio) return
    setOcupado('entrar')
    try { await carteraServicio.abrir(estudio.id); await refrescar(); navegar('/') }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo abrir tu empresa.') }
    finally { setOcupado(null) }
  }

  async function cambiarA(plan: CodigoPlan) {
    if (!estudio) return
    const p = catalogo.planes.find(x => x.codigo === plan)!
    const sube = orden(plan) > orden(estudio.plan)
    if (!await pedir({
      titulo: sube ? `¿Subir tu empresa a ${p.nombre}?` : `¿Bajar tu empresa a ${p.nombre}?`,
      confirmar: sube ? `Sí, subir a ${p.nombre}` : `Sí, bajar a ${p.nombre}`,
      mensaje: sube
        ? <p>Se suma <strong>+{soles(extraHoy(p, oferta))} al mes</strong> a tu Plan Cartera (la diferencia con Básico, que es gratis). Si ya pagaste
            el mes, te diremos la diferencia por los días que quedan.</p>
        : plan === 'basico'
          ? <p>Vuelve a <strong>Básico gratis</strong>. Si ya pagaste el mes, sigues con {NOMBRE_PLAN[estudio.plan]} hasta el final del periodo. Tus datos se guardan.</p>
          : <p>Pasa a {p.nombre} (+{soles(extraHoy(p, oferta))} al mes) desde tu próximo cobro. Tus datos se guardan.</p>,
    })) return
    await cambio.abrir(estudio.id, plan)
  }

  async function marcar(id: string | null) {
    const e = cuenta!.empresas.find(x => x.id === id)
    if (!await pedir({
      titulo: id ? `¿${e?.nombre} es tu empresa?` : '¿Ya no es tu empresa?',
      confirmar: id ? 'Sí, es mi empresa' : 'Sí, quitar',
      tono: id ? 'normal' : 'peligro',
      mensaje: id
        ? <p>Sale de tu cartera y pasa a «Mi empresa»: en Básico es <strong>gratis</strong> y no se cuenta en tus empresas. Solo puede haber una.</p>
        : <p><strong>{estudio?.nombre}</strong> vuelve a tu cartera y se cuenta como una empresa más (se paga). No se borra nada.</p>,
    })) return
    setOcupado('marcar')
    try { await hecho((await planesServicio.estudio(id)).mensaje); setElegida('') }
    catch (err) { mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo guardar.') }
    finally { setOcupado(null) }
  }

  const dias = estudio ? diasQueFaltan(estudio.pruebaHasta) : null
  // 098: con menos del mínimo en la cartera, Mi empresa queda con candado.
  const est = cuenta.estudio ?? null
  const candado = est?.estado === 'sin_activar'
  const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { timeZone: 'America/Lima', weekday: 'long', day: 'numeric', month: 'long' })
  const mensajeCandado = est
    ? `Tu empresa todavía no puede emitir: se activa cuando tengas al menos ${est.minimo} empresas en tu cartera. Hoy tienes ${est.tiene}. Agrégalas en «Mi cartera».`
    : ''

  return (
    <div className="pln-pagina mie-pagina">
      {dialogo}
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">Mi empresa</h1>
          <p className="bajada-pagina">La empresa de tu estudio, para facturar tus honorarios. En Básico es gratis
            {(catalogo.reglas.miEmpresaMesesGratis ?? 0) > 0 ? ` por ${catalogo.reglas.miEmpresaMesesGratis} meses` : ''} mientras tengas {catalogo.reglas.carteraMinimo} o más
            empresas en tu cartera.</p>
        </div>
        {estudio && <Boton ocupado={ocupado === 'entrar'} textoOcupado="Abriendo…" className={candado ? 'con-candado' : undefined}
          onClick={() => candado ? mensaje.ojo(mensajeCandado) : void entrar()}>{candado ? '🔒 Entrar a emitir' : est?.estado === 'no_emite' ? 'Entrar (solo ver)' : 'Entrar a emitir'}</Boton>}
      </div>

      {/* e285: el certificado de tu empresa (el de los clientes va en Mi cartera). */}
      {certificado && (
        <div className={`aviso ${certificado.nivel === 'rojo' ? 'error' : 'ojo'} mie-estado`}>
          <div><strong>{certificado.titulo}.</strong> {certificado.detalle}</div>
          {estudio && !candado && <Boton estilo="secundario" ocupado={ocupado === 'entrar'} onClick={() => void entrar()}>Entrar a mi empresa</Boton>}
        </div>
      )}
      {/* 098: el estado de Mi empresa según las empresas de la cartera. */}
      {est && candado && (
        <div className="aviso ojo mie-estado">
          <div>
            <strong>Tu empresa todavía no puede emitir.</strong> Para emitir con tu empresa y tenerla en <strong>Básico gratis</strong>, registra al
            menos <strong>{est.minimo} empresas</strong> en tu cartera.
            <div className="mie-progreso" role="progressbar" aria-valuemin={0} aria-valuemax={est.minimo} aria-valuenow={est.tiene}>
              <i style={{ width: `${Math.min(100, (est.tiene / Math.max(est.minimo, 1)) * 100)}%` }} />
            </div>
            <small>Tienes {est.tiene} de {est.minimo}.</small>
          </div>
          {puede && <Link className="boton" to="/configurar?nueva=1">Agregar empresa a mi cartera</Link>}
        </div>
      )}
      {est?.estado === 'aviso' && est.hasta && (
        <div className="aviso ojo mie-estado">
          <div><strong>Tu cartera bajó a {est.tiene} empresa{est.tiene === 1 ? '' : 's'}.</strong> Tu empresa puede emitir hasta el <strong>{fechaLarga(est.hasta)}</strong>.
            Después podrás ver y descargar todo, pero no emitir, hasta que vuelvas a tener {est.minimo} empresas. No se borra nada.</div>
          {puede && <Link className="boton secundario" to="/configurar?nueva=1">Agregar empresa</Link>}
        </div>
      )}
      {est?.estado === 'no_emite' && (
        <div className="aviso error mie-estado">
          <div><strong>Tu empresa no puede emitir:</strong> tu cartera tiene menos de {est.minimo} empresas (hoy {est.tiene}). Puedes entrar a ver y
            descargar todo. Agrega una empresa en «Mi cartera» y se reactiva sola.</div>
          {puede && <Link className="boton secundario" to="/configurar?nueva=1">Agregar empresa</Link>}
        </div>
      )}
      {est?.estado === 'activa' && est.gratisHasta && (
        <div className="franja-plan">Básico gratis hasta el <strong>{fecha(est.gratisHasta.slice(0, 10))}</strong>. Después se cobra como una empresa más de tu cartera.</div>
      )}

      {cuenta.descuento && (
        <div className="franja-plan">Beneficio activo: <strong>{cuenta.descuento.motivo}</strong>, {cuenta.descuento.porcentaje} % en tu Plan Cartera
          {cuenta.descuento.empresasMax ? ` (hasta ${cuenta.descuento.empresasMax} empresas)` : ''} hasta el {fecha(cuenta.descuento.hasta)}.</div>
      )}

      {estudio ? (
        <section className="bloque mie-empresa">
          <h2>{estudio.nombre}{candado && <span className="mie-candado"> 🔒 con candado</span>}</h2>
          <p className="secundario">{estudio.ruc ? `RUC ${estudio.ruc}` : 'Sin RUC'}
            {/* e285: con candado no se habla del mes gratis (no puede usarlo). */}
            {candado && est ? ` · se activa con ${est.minimo} empresas en tu cartera (tienes ${est.tiene})`
              : dias !== null && ` · mes gratis: ${dias} día${dias === 1 ? '' : 's'} (hoy ve todo lo del ${NOMBRE_PLAN[estudio.efectivo === 'todo' ? 'max' : estudio.efectivo]})`}</p>
          {estudio.planProgramado && estudio.planProgramadoDesde && (
            <p className="franja-programado"><span>El {fecha(estudio.planProgramadoDesde)} pasa a {NOMBRE_PLAN[estudio.planProgramado]}. Hasta entonces sigue en {NOMBRE_PLAN[estudio.plan]}.</span></p>
          )}
          <div className="mie-planes">
            {catalogo.planes.map((p, i) => {
              const actual = estudio.plan === p.codigo
              return (
                <div key={p.codigo} className={`mie-plan${actual ? ' actual' : ''}`}>
                  <div>
                    <strong>{p.nombre}</strong>
                    <small className="secundario">{etiquetaPlan(catalogo.planes, i)}</small>
                  </div>
                  <div className="mie-precio">
                    {p.codigo === 'basico' ? <strong className="gratis">Gratis</strong> : <strong>+{soles(extraHoy(p, oferta))} al mes</strong>}
                    {actual ? <small>tu plan ahora</small>
                      : puede && !candado && <button type="button" className="enlace" disabled={!!cambio.cargando} onClick={() => void cambiarA(p.codigo)}>
                          {orden(p.codigo) > orden(estudio.plan) ? `Subir a ${p.nombre}` : `Bajar a ${p.nombre}`}</button>}
                  </div>
                </div>
              )
            })}
          </div>
          {candado && (
            <div className="mie-bloqueados" aria-label="Lo que se activa con tu cartera">
              <div><strong>🔒 Comprobantes</strong><span>Facturas, boletas y notas</span></div>
              <div><strong>🔒 Clientes y productos</strong><span>Con consulta RUC y DNI</span></div>
              <div><strong>🔒 Guías y reportes</strong><span>Reportes esenciales</span></div>
            </div>
          )}
          <p className="nota">Si la subes a mitad de mes, pagas la diferencia solo por los días que faltan. Va en el mismo comprobante de tu
            <Link to="/mi-plan"> Plan Cartera</Link>.</p>
          {puede && <p className="nota">¿Te equivocaste de empresa? <button type="button" className="enlace" disabled={ocupado === 'marcar'} onClick={() => void marcar(null)}>Ya no es mi empresa</button>.</p>}
        </section>
      ) : (
        <div className="mie-dos">
          <section className="bloque">
            <h2>Registra tu empresa</h2>
            <p className="secundario">Agrégala con el RUC de tu estudio (sirve tu RUC 10 de persona natural). Traemos los datos de SUNAT.
              Cuando esté lista, vuelve aquí y márcala como tuya.</p>
            {puede && <Link className="boton" to="/configurar?nueva=1">Agregar mi empresa</Link>}
            <p className="nota">¿Solo tienes DNI? Para emitir comprobantes electrónicos SUNAT pide RUC. Sácalo gratis en SUNAT y vuelve aquí.</p>
          </section>
          <section className="bloque">
            <h2>¿Ya está en tu cartera?</h2>
            <p className="secundario">Si ya la agregaste, elígela: sale de tu cartera y queda como «Mi empresa», gratis en Básico.</p>
            {otras.length === 0 ? <p className="secundario">Todavía no tienes empresas.</p> : (
              <div className="mie-marcar">
                <select value={elegida} disabled={!puede} aria-label="Tu empresa" onChange={e => setElegida(e.target.value)}>
                  <option value="">Elige tu empresa…</option>
                  {otras.map(e => <option key={e.id} value={e.id}>{e.nombre}{e.ruc ? ` · ${e.ruc}` : ''}</option>)}
                </select>
                <Boton estilo="secundario" disabled={!puede || !elegida} ocupado={ocupado === 'marcar'} onClick={() => void marcar(elegida)}>Es mi empresa</Boton>
              </div>
            )}
          </section>
        </div>
      )}
      {cambio.dialogo}
    </div>
  )
}