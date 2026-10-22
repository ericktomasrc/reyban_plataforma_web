import { useCallback, useEffect, useRef, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { consultasSunatServicio } from '../servicios/consultasSunatServicio'
import type { AvancePadron, EstadoConsultas, ModoConsultas } from '../servicios/consultasSunatServicio'

const n = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString('es-PE')

/**
 * 042 — PLATAFORMA › CONSULTAS SUNAT.
 *
 * Arriba, de dónde salen el RUC, el DNI y el tipo de cambio: SUNAT (sin costo)
 * o Decolecta (membresía). Abajo, el padrón de RUC de SUNAT: cuándo se cargó,
 * «Descargar ahora», «Subir archivo», y la vigilancia de las cargas con el
 * motivo cuando algo falla.
 */
export function ConsultasSunatPagina() {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [estado, setEstado] = useState<EstadoConsultas | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<'modo' | 'descargar' | 'subir' | null>(null)
  const elegir = useRef<HTMLInputElement>(null)
  // 22 oct: la barra. `subida` = lo que va del archivo hacia el servidor.
  const [subida, setSubida] = useState<{ enviados: number; total: number } | null>(null)
  const estabaActivo = useRef(false)

  const cargar = useCallback(async () => {
    try {
      setEstado(await consultasSunatServicio.estado())
      setFallo(null)
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo cargar.')
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  // Mientras hay una carga en marcha, se refresca sola cada 2 segundos (la barra).
  const enMarcha = !!estado && (estado.avance !== null || estado.padron.enCurso)
  useEffect(() => {
    if (!enMarcha) return
    const t = setInterval(() => void cargar(), 2000)
    return () => clearInterval(t)
  }, [enMarcha, cargar])

  // Cuando termina, se dice cómo salió (una sola vez).
  useEffect(() => {
    if (!estado) return
    if (enMarcha) { estabaActivo.current = true; return }
    if (!estabaActivo.current) return
    estabaActivo.current = false
    const u = estado.padron.cargas[0]
    if (u?.estado === 'ok') mensaje.bien(`Padrón de SUNAT cargado: ${n(u.filas)} RUC. Ya se usa en las consultas.`)
    else if (u?.estado === 'error') mensaje.error('No se pudo cargar el padrón.', u.motivo)
  }, [estado, enMarcha, mensaje])

  async function cambiarModo(modo: ModoConsultas) {
    if (!estado || estado.padron.modo === modo) return
    const seguro = await pedir({
      titulo: modo === 'sunat' ? 'Pasar a modo SUNAT (sin costo)' : 'Pasar a modo Decolecta',
      confirmar: 'Cambiar',
      mensaje: modo === 'sunat' ? (
        <>
          <p>El RUC sale del padrón de SUNAT y el tipo de cambio, de la SBS. <strong>Sin costo.</strong></p>
          <p>El DNI ya no se consulta: al crear un cliente con DNI, el nombre se escribe a mano.</p>
        </>
      ) : (
        <>
          <p>RUC, DNI y tipo de cambio automáticos. El RUC se busca primero en el padrón (gratis) y solo
            si no está se pregunta a Decolecta.</p>
          <p><strong>Cada consulta a Decolecta cuenta en tu plan</strong> ({n(estado.decolecta.usadas)} de{' '}
            {n(estado.decolecta.limite)} este mes).</p>
        </>
      ),
    })
    if (!seguro) return
    setOcupado('modo')
    try {
      const r = await consultasSunatServicio.cambiarModo(modo)
      mensaje.bien(r.mensaje)
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el modo.')
    } finally {
      setOcupado(null)
    }
  }

  async function descargar() {
    setOcupado('descargar')
    try {
      // Sin cartel: el avance se ve en la barra al instante.
      await consultasSunatServicio.descargar()
      estabaActivo.current = true
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo empezar la descarga.')
    } finally {
      setOcupado(null)
    }
  }

  async function subir(archivo: File | undefined) {
    if (!archivo) return
    setOcupado('subir')
    setSubida({ enviados: 0, total: archivo.size })
    try {
      await consultasSunatServicio.subir(archivo, (enviados, total) => setSubida({ enviados, total }))
      estabaActivo.current = true
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo subir el archivo.')
      await cargar()
    } finally {
      setOcupado(null)
      setSubida(null)
      if (elegir.current) elegir.current.value = ''
    }
  }

  if (!estado && !fallo) return <Cargando />

  const p = estado?.padron
  const ultima = p?.cargas[0]

  return (
    <>
      <h1 className="titulo-pagina">Consultas SUNAT</h1>
      <p className="texto-paso">
        De dónde salen los datos de RUC, DNI y tipo de cambio al crear clientes, dar de alta empresas y facturar en dólares.
      </p>

      {fallo && <Aviso>{fallo}</Aviso>}

      {estado && p && (
        <>
          {/* --- El modo -------------------------------------------------- */}
          <div className="bloque">
            <h2 className="subtitulo">Modo de consultas</h2>
            <div className="modos-consulta">
              <button type="button" className={p.modo === 'sunat' ? 'modo elegido' : 'modo'}
                      disabled={ocupado !== null} onClick={() => void cambiarModo('sunat')}>
                <strong>SUNAT</strong>
                <span className="etiqueta acento">Sin costo</span>
                <span>RUC: padrón de SUNAT · Tipo de cambio: SBS · DNI: a mano</span>
              </button>
              <button type="button" className={p.modo === 'decolecta' ? 'modo elegido' : 'modo'}
                      disabled={ocupado !== null} onClick={() => void cambiarModo('decolecta')}>
                <strong>Decolecta</strong>
                <span className="etiqueta aviso">Membresía</span>
                <span>RUC (padrón primero), DNI y tipo de cambio automáticos ·{' '}
                  {estado.decolecta.configurado
                    ? `${n(estado.decolecta.usadas)} de ${n(estado.decolecta.limite)} consultas este mes`
                    : 'falta DECOLECTA_TOKEN en el .env'}</span>
              </button>
            </div>
          </div>

          {/* --- El padrón ------------------------------------------------- */}
          <div className="bloque">
            <div className="encabezado-pagina">
              <h2 className="subtitulo">Padrón de RUC de SUNAT</h2>
              <div className="botonera">
                <Boton estilo="secundario" ocupado={ocupado === 'descargar'} textoOcupado="Empezando…"
                       disabled={ocupado !== null || enMarcha} onClick={() => void descargar()}>
                  Descargar ahora
                </Boton>
                <Boton estilo="secundario" ocupado={ocupado === 'subir'} textoOcupado="Subiendo…"
                       disabled={ocupado !== null || enMarcha} onClick={() => elegir.current?.click()}>
                  Subir archivo…
                </Boton>
                <input ref={elegir} type="file" accept=".zip,.txt" hidden
                       onChange={e => void subir(e.target.files?.[0])} />
              </div>
            </div>

            {subida ? (
              <ProgresoPadron subida={subida} avance={null} />
            ) : enMarcha ? (
              <ProgresoPadron subida={null} avance={estado.avance} />
            ) : ultima?.estado === 'error' ? (
              <Aviso>
                <strong>La última carga falló</strong> ({fechaYHora(ultima.iniciadaEn)}): {ultima.motivo}
                {p.enUso && <> Se sigue usando el padrón anterior, del {fechaYHora(p.enUso.cargadoEn)}.</>}
              </Aviso>
            ) : p.enUso ? (
              <Aviso tono="bien">
                Al día: <strong>{n(p.enUso.filas)} RUC</strong>, cargado el {fechaYHora(p.enUso.cargadoEn)}
                {p.enUso.origen === 'automatica' ? ' (descarga automática)' : ' (a mano)'}.
              </Aviso>
            ) : (
              <Aviso tono="ojo">Todavía no hay padrón cargado: las consultas de RUC piden escribir los datos a mano.</Aviso>
            )}

            <p className="nota">
              {estado.automatico.activo
                ? <>Se baja solo cada día desde las {String(estado.automatico.hora).padStart(2, '0')}:00 (hora de Lima);
                    si falla, se reintenta dos veces más ese día.</>
                : <>La descarga automática está apagada (PADRON_SUNAT_AUTOMATICO=false).</>}
              {' '}Para subirlo a mano: abre{' '}
              <a href="https://www2.sunat.gob.pe/padron_reducido_ruc.zip" target="_blank" rel="noopener noreferrer">
                padron_reducido_ruc.zip</a>{' '}
              en tu navegador (pegando el enlace en la barra de direcciones) y súbelo aquí. El de «locales anexos» no sirve.
            </p>
          </div>

          {/* --- La vigilancia ----------------------------------------------- */}
          <div className="bloque sin-relleno">
            <table className="tabla">
              <thead>
                <tr><th>Cuándo</th><th>Cómo</th><th>Resultado</th><th className="derecha">RUC</th><th>Motivo</th></tr>
              </thead>
              <tbody>
                {p.cargas.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="principal">{fechaYHora(c.iniciadaEn)}</div>
                      {c.terminadaEn && <div className="secundario">terminó {fechaYHora(c.terminadaEn)}</div>}
                    </td>
                    <td>
                      {c.origen === 'automatica' ? 'Automática' : 'Manual'}
                      {c.usuario && <div className="secundario">{c.usuario}</div>}
                      {c.archivo && <div className="secundario">{c.archivo}</div>}
                    </td>
                    <td>
                      {c.estado === 'ok' ? <span className="estado bueno">Bien</span>
                        : c.estado === 'error' ? <span className="estado malo">Falló</span>
                        : <span className="estado aviso">En curso</span>}
                    </td>
                    <td className="derecha mono">
                      {n(c.filas)}
                      {!!c.descartadas && <div className="secundario">{n(c.descartadas)} líneas descartadas</div>}
                    </td>
                    <td>{c.motivo}</td>
                  </tr>
                ))}
                {p.cargas.length === 0 && (
                  <tr><td colSpan={5} className="vacio">Todavía no hubo ninguna carga.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {dialogo}
    </>
  )
}

// =============================================================================
// 22 oct — LA BARRA: en qué paso va la carga del padrón y cuánto le falta.
// =============================================================================

const MB = (b: number) => (b / 1_048_576).toLocaleString('es-PE', { maximumFractionDigits: 0 })

function transcurrido(desde: string | undefined, ahora: number) {
  if (!desde) return ''
  const s = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

type Paso = { titulo: string; estado: 'hecho' | 'ahora' | 'falta' }

function ProgresoPadron({ subida, avance }: {
  subida: { enviados: number; total: number } | null
  avance: AvancePadron | null
}) {
  // Un reloj para el «lleva 1:23» (la pantalla pide el estado cada 2 s).
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const etapa = subida ? 'subiendo' : avance?.etapa ?? 'cargando'
  const primero = subida || avance?.subido ? 'Subir el archivo' : 'Bajar el archivo de SUNAT'
  const orden = ['en_cola', 'bajando', 'subiendo', 'cargando', 'activando']
  const i = orden.indexOf(etapa)
  const estadoDe = (desde: number, hasta: number): Paso['estado'] => i > hasta ? 'hecho' : i >= desde ? 'ahora' : 'falta'
  const pasos: Paso[] = [
    { titulo: primero, estado: estadoDe(0, 2) },
    { titulo: 'Cargar los RUC', estado: estadoDe(3, 3) },
    { titulo: 'Ordenar y activar', estado: estadoDe(4, 4) },
  ]

  let pct: number | null = null
  let texto: string
  let detalle = ''
  if (subida) {
    pct = subida.total > 0 ? Math.min(100, Math.floor(subida.enviados * 100 / subida.total)) : null
    texto = pct === 100 ? 'Archivo subido. El servidor lo está revisando…' : 'Subiendo tu archivo al servidor…'
    detalle = `${MB(subida.enviados)} de ${MB(subida.total)} MB`
  } else if (!avance || avance.etapa === 'en_cola') {
    texto = avance?.subido ? 'Archivo recibido. Empezando la carga…' : 'Preparando la descarga…'
  } else if (avance.etapa === 'bajando') {
    pct = avance.porcentaje
    texto = 'Bajando el padrón de SUNAT…'
    detalle = avance.total ? `${MB(avance.hecho)} de ${MB(avance.total)} MB` : `${MB(avance.hecho)} MB bajados`
  } else if (avance.etapa === 'cargando') {
    pct = avance.porcentaje
    texto = 'Cargando los RUC en la base de datos…'
    detalle = `${n(avance.filas)} RUC`
  } else {
    texto = 'Ordenando e indexando para que las búsquedas sean rápidas. Es el último paso…'
    detalle = `${n(avance.filas)} RUC`
  }

  return (
    <div className="progreso-padron" role="status" aria-live="polite">
      <ol className="pasos-padron">
        {pasos.map((x, k) => (
          <li key={k} className={x.estado}>
            <span className="marca">{x.estado === 'hecho' ? '✓' : k + 1}</span>{x.titulo}
          </li>
        ))}
      </ol>
      <div className="linea-padron">
        <strong>{texto}</strong>
        <span className="mono">
          {detalle}{pct != null && <> · {pct} %</>}
          {!subida && avance && <> · lleva {transcurrido(avance.desde, ahora)}</>}
        </span>
      </div>
      <div className={pct == null ? 'pista-padron indeterminada' : 'pista-padron'}
           role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
        <span style={pct == null ? undefined : { width: `${pct}%` }} />
      </div>
      <p className="nota">
        {subida ? 'No cierres esta pestaña hasta que termine de subir.'
          : 'Puedes salir de esta pantalla: la carga sigue en el servidor. El padrón anterior se sigue usando hasta que termine.'}
      </p>
    </div>
  )
}