import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { erroresServicio, type ErroresDelDia, type ResumenErrores } from '../servicios/erroresServicio'

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function deFecha(dia: string) { return new Date(`${dia}T12:00:00Z`) }

function diaLargo(dia: string) {
  const t = deFecha(dia).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * e225 — ERRORES DEL SISTEMA (super admin).
 *
 * Arriba, la tabla de los últimos 14 días por proceso: rojo = hubo errores
 * (con cuántos), amarillo = solo avisos, verde = nada. Un clic en una casilla
 * abre los errores de ese día, agrupados (el mismo error, una vez con sus
 * «veces»), con lo que significan y su descarga directa en .txt.
 *
 * Lo lee de los logs de cada día (038). No borra ni cambia nada.
 */
export function ErroresSistemaPagina() {
  const mensaje = useMensaje()
  const [params, setParams] = useSearchParams()
  const [resumen, setResumen] = useState<ResumenErrores>()
  const [error, setError] = useState<string>()
  const [detalle, setDetalle] = useState<ErroresDelDia>()
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  const [bajando, setBajando] = useState<string>()

  const dia = params.get('dia')
  const proceso = params.get('proceso')
  const avisos = params.get('ver') === 'avisos'

  const cargarResumen = useCallback(async () => {
    try { setResumen(await erroresServicio.resumen(14)); setError(undefined) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudieron leer los errores.') }
  }, [])
  useEffect(() => { void cargarResumen() }, [cargarResumen])

  useEffect(() => {
    if (!dia || !proceso) { setDetalle(undefined); return }
    let vivo = true
    setCargandoDetalle(true)
    erroresServicio.delDia(dia, proceso, avisos)
      .then(d => { if (vivo) { setDetalle(d); setAbiertos({}) } })
      .catch(e => { if (vivo) { setDetalle(undefined); mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudieron leer los errores de ese día.') } })
      .finally(() => { if (vivo) setCargandoDetalle(false) })
    return () => { vivo = false }
  }, [dia, proceso, avisos, mensaje])

  function elegir(d: string, p: string, verAvisos: boolean) {
    setParams({ dia: d, proceso: p, ...(verAvisos ? { ver: 'avisos' } : {}) })
  }

  async function bajar(clave: string, firma?: string) {
    if (!dia || !proceso) return
    setBajando(clave)
    try { await erroresServicio.descargar(dia, proceso, avisos, firma) }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo descargar.') }
    finally { setBajando(undefined) }
  }

  if (error) return <Aviso>{error}</Aviso>
  if (!resumen) return <Cargando />

  const sinCarpeta = resumen.procesos.filter(p => !p.carpeta)
  const nombreDe = (clave: string) => resumen.procesos.find(p => p.clave === clave)?.nombre ?? clave

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Errores del sistema</h1>
          <p className="secundario">Los últimos 14 días de los tres procesos. <strong>Rojo</strong> = hubo errores ese día: haz clic para verlos y descargarlos.</p>
        </div>
        <Boton estilo="secundario" onClick={() => void cargarResumen()}>Actualizar</Boton>
      </div>

      {resumen.ultimo && (
        <div className="errs-alerta">
          <span>
            <strong>Hoy: {resumen.ultimo.errores} {resumen.ultimo.errores === 1 ? 'error' : 'errores'} en {nombreDe(resumen.ultimo.proceso)}</strong>
            {' · '}último a las {resumen.ultimo.hora}: «{resumen.ultimo.titulo}»
          </span>
          <button type="button" className="enlace" onClick={() => elegir(resumen.hoy, resumen.ultimo!.proceso, false)}>Ver los de hoy →</button>
        </div>
      )}

      {sinCarpeta.length > 0 && (
        <Aviso tono="ojo">
          No encuentro los registros de: {sinCarpeta.map(p => p.nombre).join(', ')}.
          {' '}En QA hay que reconstruir con el docker nuevo; en local, el servicio de facturación tiene que estar en su carpeta de siempre (o indicar LOGS_SERVICIO_CARPETA).
        </Aviso>
      )}

      <div className="errs-tarjeta">
        <div className="errs-matriz-caja">
          <table className="errs-matriz">
            <thead>
              <tr>
                <th />
                {resumen.dias.map(d => {
                  const f = deFecha(d.dia)
                  return <th key={d.dia} className={d.dia === resumen.hoy ? 'hoy' : ''}>{DIAS[f.getUTCDay()]}<br />{f.getUTCDate()}</th>
                })}
              </tr>
            </thead>
            <tbody>
              {resumen.procesos.map(p => (
                <tr key={p.clave}>
                  <th className="errs-proceso">{p.nombre}</th>
                  {resumen.dias.map(d => {
                    const c = d.conteos[p.clave]
                    const sel = dia === d.dia && proceso === p.clave
                    if (!c?.existe) return <td key={d.dia} className={'errs-c vacio' + (sel ? ' sel' : '')} title="Sin registros ese día (el proceso no estuvo prendido)">·</td>
                    if (c.errores > 0) return (
                      <td key={d.dia} className={'errs-c rojo' + (sel ? ' sel' : '')}>
                        <button type="button" onClick={() => elegir(d.dia, p.clave, false)} title={`${c.errores} error(es) · ${c.avisos} aviso(s)`}>{c.errores}</button>
                      </td>
                    )
                    if (c.avisos > 0) return (
                      <td key={d.dia} className={'errs-c ambar' + (sel ? ' sel' : '')}>
                        <button type="button" onClick={() => elegir(d.dia, p.clave, true)} title={`${c.avisos} aviso(s), ningún error`}>{c.avisos} av.</button>
                      </td>
                    )
                    return <td key={d.dia} className={'errs-c verde' + (sel ? ' sel' : '')} title="Sin errores ni avisos">✓</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="errs-leyenda">
          <span><i className="rojo" />Número de errores (clic para verlos)</span>
          <span><i className="ambar" />Solo avisos</span>
          <span><i className="verde" />Sin problemas</span>
          <span><i className="vacio" />Sin registros</span>
        </div>
      </div>

      {dia && proceso && (
        <div className="errs-tarjeta">
          <div className="errs-cabeza">
            <h2>{diaLargo(dia)} · {nombreDe(proceso)}</h2>
            {detalle && detalle.grupos.length > 0 && (
              <Boton onClick={() => void bajar('todo')} disabled={bajando === 'todo'}>
                ⬇ {bajando === 'todo' ? 'Descargando…' : `Descargar los ${avisos ? 'avisos' : 'errores'} de este día`}
              </Boton>
            )}
          </div>

          <div className="errs-pestanas" role="tablist">
            <button type="button" role="tab" aria-selected={!avisos} className={!avisos ? 'activa' : ''} onClick={() => elegir(dia, proceso, false)}>
              Errores{detalle ? ` (${detalle.errores})` : ''}
            </button>
            <button type="button" role="tab" aria-selected={avisos} className={avisos ? 'activa' : ''} onClick={() => elegir(dia, proceso, true)}>
              Avisos{detalle ? ` (${detalle.avisos})` : ''}
            </button>
          </div>

          {cargandoDetalle && <Cargando />}
          {!cargandoDetalle && detalle && detalle.grupos.length === 0 && (
            <p className="secundario">{avisos ? 'Ningún aviso' : 'Ningún error'} ese día en este proceso. 🎉</p>
          )}
          {!cargandoDetalle && detalle?.grupos.map(g => {
            const abierto = abiertos[g.firma]
            const largo = g.ejemplo.split('\n').length > 4
            return (
              <div key={g.firma} className={'errs-grupo' + (avisos ? ' aviso' : '')}>
                <div className="errs-grupo-t">
                  <strong>{g.titulo}</strong>
                  <span className="errs-veces">{g.veces} {g.veces === 1 ? 'vez' : 'veces'}</span>
                </div>
                <div className="errs-meta">
                  {g.veces === 1 ? g.ultima : `Primera ${g.primera} · última ${g.ultima}`} · {g.categoria}
                </div>
                {g.significado && <div className="errs-significa">💡 Qué significa: {g.significado}</div>}
                <pre className={'errs-texto' + (abierto || !largo ? ' completo' : '')}>{g.ejemplo}</pre>
                <div className="errs-acciones">
                  <Boton estilo="secundario" onClick={() => void bajar(g.firma, g.firma)} disabled={bajando === g.firma}>
                    ⬇ {bajando === g.firma ? 'Descargando…' : `Descargar este ${avisos ? 'aviso' : 'error'}${g.veces > 1 ? ` (${g.veces} veces)` : ''}`}
                  </Boton>
                  {largo && (
                    <Boton estilo="plano" onClick={() => setAbiertos(a => ({ ...a, [g.firma]: !abierto }))}>
                      {abierto ? 'Ver menos' : 'Ver completo'}
                    </Boton>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="secundario errs-nota">Los registros se guardan 60 días y nunca llevan claves, contraseñas ni cookies. Hora de Lima.</p>
    </>
  )
}