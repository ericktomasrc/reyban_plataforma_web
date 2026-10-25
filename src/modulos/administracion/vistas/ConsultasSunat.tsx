import { useCallback, useEffect, useRef, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { consultasSunatServicio } from '../servicios/consultasSunatServicio'
import type {
  AvancePadron, EstadoConsultas, EstadoPadron, ModoConsultas, TipoPadron,
} from '../servicios/consultasSunatServicio'

const n = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString('es-PE')

/** 045: lo que cambia de un padrón al otro, en palabras. */
const TEXTOS: Record<TipoPadron, {
  titulo: string; unidad: string; archivo: string; enlace: string; sinCargar: string; listo: string; noSirve: string
}> = {
  ruc: {
    titulo: 'Padrón de RUC de SUNAT',
    unidad: 'RUC',
    archivo: 'padron_reducido_ruc.zip',
    enlace: 'https://www2.sunat.gob.pe/padron_reducido_ruc.zip',
    sinCargar: 'Todavía no hay padrón cargado: las consultas de RUC piden escribir los datos a mano.',
    listo: 'Ya se usa en las consultas de RUC.',
    noSirve: 'El de «locales anexos» no sirve aquí: va en el bloque de abajo.',
  },
  anexos: {
    titulo: 'Padrón de locales anexos de SUNAT',
    unidad: 'locales',
    archivo: 'padron_reducido_local_anexo.zip',
    enlace: 'https://www.sunat.gob.pe/descargaPRR/padron_reducido_local_anexo.zip',
    sinCargar: 'Todavía no hay padrón de locales anexos: al crear una sucursal, la dirección se escribe a mano.',
    listo: 'Ya se usa al crear sucursales.',
    noSirve: 'Es el que trae las direcciones de los locales de cada RUC (para Sucursales). El de RUC no sirve aquí.',
  },
}

/**
 * 042 — PLATAFORMA › CONSULTAS SUNAT.
 *
 * Arriba, de dónde salen el RUC, el DNI y el tipo de cambio: SUNAT (sin costo)
 * o Decolecta (membresía). Debajo, los DOS padrones de SUNAT que se cargan
 * (045): el de RUC y el de locales anexos (para Sucursales). Cada uno con
 * cuándo se cargó, «Descargar ahora», «Subir archivo», su barra de avance y
 * la vigilancia de sus cargas con el motivo cuando algo falla.
 */
export function ConsultasSunatPagina() {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [estado, setEstado] = useState<EstadoConsultas | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<'modo' | `descargar-${TipoPadron}` | `subir-${TipoPadron}` | null>(null)
  // 22 oct: la barra. `subida` = lo que va del archivo hacia el servidor.
  const [subida, setSubida] = useState<{ padron: TipoPadron; enviados: number; total: number } | null>(null)
  // 045: de qué padrón era la carga en marcha, para decir cómo salió al terminar.
  const activo = useRef<TipoPadron | null>(null)

  const cargar = useCallback(async () => {
    try {
      setEstado(await consultasSunatServicio.estado())
      setFallo(null)
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo cargar.')
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  // Mientras hay una carga en marcha (de cualquiera de los dos), se refresca
  // sola cada 2 segundos (la barra). Las cargas van de a una: es una sola cola.
  const enMarcha = !!estado && (estado.avance !== null || estado.padron.enCurso || !!estado.padron.anexos?.enCurso)
  useEffect(() => {
    if (!enMarcha) return
    const t = setInterval(() => void cargar(), 2000)
    return () => clearInterval(t)
  }, [enMarcha, cargar])

  // Cuando termina, se dice cómo salió (una sola vez).
  useEffect(() => {
    if (!estado) return
    if (enMarcha) {
      const deAvance = estado.avance?.padron === 'anexos' || estado.avance?.padron === 'ruc' ? estado.avance.padron : undefined
      activo.current = deAvance ?? activo.current ?? (estado.padron.anexos?.enCurso ? 'anexos' : 'ruc')
      return
    }
    const cual = activo.current
    if (!cual) return
    activo.current = null
    const u = (cual === 'anexos' ? estado.padron.anexos : estado.padron)?.cargas[0]
    const t = TEXTOS[cual]
    if (u?.estado === 'ok') mensaje.bien(`${t.titulo} cargado: ${n(u.filas)} ${t.unidad}. ${t.listo}`)
    else if (u?.estado === 'error') mensaje.error(`No se pudo cargar el ${t.titulo.toLowerCase()}.`, u.motivo)
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

  async function descargar(padron: TipoPadron) {
    setOcupado(`descargar-${padron}`)
    try {
      // Sin cartel: el avance se ve en la barra al instante.
      await consultasSunatServicio.descargar(padron)
      activo.current = padron
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo empezar la descarga.')
    } finally {
      setOcupado(null)
    }
  }

  async function subir(padron: TipoPadron, archivo: File | undefined) {
    if (!archivo) return
    setOcupado(`subir-${padron}`)
    setSubida({ padron, enviados: 0, total: archivo.size })
    try {
      await consultasSunatServicio.subir(archivo, padron, (enviados, total) => setSubida({ padron, enviados, total }))
      activo.current = padron
      await cargar()
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo subir el archivo.')
      await cargar()
    } finally {
      setOcupado(null)
      setSubida(null)
    }
  }

  if (!estado && !fallo) return <Cargando />

  const p = estado?.padron

  /** e163: ¿este padrón tiene una carga suya en marcha (o una subida)? */
  const corre = (cual: TipoPadron, datos: EstadoPadron) =>
    datos.enCurso || subida?.padron === cual || (!!estado?.avance && (estado.avance.padron ?? 'ruc') === cual)

  /** e163: soltar una carga que se quedó colgada. */
  async function destrabar() {
    try {
      const r = await consultasSunatServicio.destrabar()
      mensaje.bien(r.mensaje)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo destrabar.')
    }
    await cargar()
  }

  return (
    <>
      <h1 className="titulo-pagina">Consultas SUNAT</h1>
      <p className="texto-paso">
        De dónde salen los datos de RUC, DNI y tipo de cambio al crear clientes, dar de alta empresas y facturar en dólares,
        y las direcciones de los locales al crear sucursales.
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

          {/* --- Los dos padrones ------------------------------------------- */}
          <BloquePadron
            padron="ruc" datos={p} estado={estado} enMarcha={enMarcha} ocupado={ocupado} subida={subida}
            otroCorriendo={!!p.anexos && corre('anexos', p.anexos)} onDestrabar={() => void destrabar()}
            onDescargar={() => void descargar('ruc')} onSubir={a => void subir('ruc', a)} />

          {p.anexos ? (
            <BloquePadron
              padron="anexos" datos={p.anexos} estado={estado} enMarcha={enMarcha} ocupado={ocupado} subida={subida}
              otroCorriendo={corre('ruc', p)} onDestrabar={() => void destrabar()}
              onDescargar={() => void descargar('anexos')} onSubir={a => void subir('anexos', a)} />
          ) : (
            <div className="bloque">
              <h2 className="subtitulo">{TEXTOS.anexos.titulo}</h2>
              <Aviso tono="ojo">Falta la migración 045 en la base de datos (corre migrar.sh en el servidor de base).</Aviso>
            </div>
          )}
        </>
      )}
      {dialogo}
    </>
  )
}

// =============================================================================
// 045 — UN PADRÓN: su estado, sus botones, su barra y sus cargas.
// =============================================================================

function BloquePadron({ padron, datos, estado, enMarcha, ocupado, subida, onDescargar, onSubir, otroCorriendo, onDestrabar }: {
  padron: TipoPadron
  datos: EstadoPadron
  estado: EstadoConsultas
  enMarcha: boolean
  /** e163: el OTRO padrón tiene una carga en marcha (entonces este espera de verdad). */
  otroCorriendo: boolean
  onDestrabar: () => void
  ocupado: string | null
  subida: { padron: TipoPadron; enviados: number; total: number } | null
  onDescargar: () => void
  onSubir: (archivo: File | undefined) => void
}) {
  const elegir = useRef<HTMLInputElement>(null)
  const t = TEXTOS[padron]
  const ultima = datos.cargas[0]
  const avanceMio = estado.avance && (estado.avance.padron ?? 'ruc') === padron ? estado.avance : null
  const miSubida = subida?.padron === padron ? subida : null
  const corriendo = datos.enCurso || !!avanceMio
  const hora = String(estado.automatico.hora).padStart(2, '0')

  return (
    <>
      <div className="bloque">
        <div className="encabezado-pagina">
          <h2 className="subtitulo">{t.titulo}</h2>
          <div className="botonera">
            <Boton estilo="secundario" ocupado={ocupado === `descargar-${padron}`} textoOcupado="Empezando…"
                   disabled={ocupado !== null || (enMarcha && (corriendo || otroCorriendo))} onClick={onDescargar}>
              Descargar ahora
            </Boton>
            <Boton estilo="secundario" ocupado={ocupado === `subir-${padron}`} textoOcupado="Subiendo…"
                   disabled={ocupado !== null || (enMarcha && (corriendo || otroCorriendo))} onClick={() => elegir.current?.click()}>
              Subir archivo…
            </Boton>
            <input ref={elegir} type="file" accept=".zip,.txt" hidden
                   onChange={e => { onSubir(e.target.files?.[0]); e.target.value = '' }} />
          </div>
        </div>

        {miSubida ? (
          <ProgresoPadron padron={padron} subida={miSubida} avance={null} />
        ) : corriendo ? (
          <ProgresoPadron padron={padron} subida={null} avance={avanceMio} />
        ) : enMarcha && otroCorriendo ? (
          <Aviso tono="ojo">Esperando: se está cargando el otro padrón. Las cargas van de una en una.</Aviso>
        ) : enMarcha ? (
          // e163: se ve «en marcha» pero no hay ninguna carga detrás (la plataforma se
          // reinició a mitad, o el avance se quedó colgado). Antes los botones se
          // quedaban apagados para siempre; ahora se puede soltar.
          <Aviso tono="ojo">
            <strong>Hay una carga anotada como «en marcha», pero no se ve ninguna trabajando.</strong>{' '}
            Pasa si la plataforma se reinició a mitad de una carga.{' '}
            <button type="button" className="enlace" onClick={onDestrabar}>Destrabar</button>{' '}
            (si de verdad hay una trabajando, no la toca).
          </Aviso>
        ) : ultima?.estado === 'error' ? (
          <Aviso>
            <strong>La última carga falló</strong> ({fechaYHora(ultima.iniciadaEn)}): {ultima.motivo}
            {datos.enUso && <> Se sigue usando el anterior, del {fechaYHora(datos.enUso.cargadoEn)}.</>}
          </Aviso>
        ) : datos.enUso ? (
          <Aviso tono="bien">
            Al día: <strong>{n(datos.enUso.filas)} {t.unidad}</strong>, cargado el {fechaYHora(datos.enUso.cargadoEn)}
            {datos.enUso.origen === 'automatica' ? ' (descarga automática)' : ' (a mano)'}.
          </Aviso>
        ) : (
          <Aviso tono="ojo">{t.sinCargar}</Aviso>
        )}

        <p className="nota">
          {estado.automatico.activo
            ? <>Se baja solo cada día desde las {hora}:00 (hora de Lima){padron === 'anexos' ? ', después del de RUC' : ''};
                si falla, se reintenta dos veces más ese día.</>
            : <>La descarga automática está apagada (PADRON_SUNAT_AUTOMATICO=false).</>}
          {' '}Para subirlo a mano: abre{' '}
          <a href={t.enlace} target="_blank" rel="noopener noreferrer">{t.archivo}</a>{' '}
          en tu navegador (pegando el enlace en la barra de direcciones) y súbelo aquí. {t.noSirve}
        </p>
      </div>

      {/* --- La vigilancia ----------------------------------------------- */}
      <div className="bloque sin-relleno">
        <table className="tabla">
          <thead>
            <tr><th>Cuándo</th><th>Cómo</th><th>Resultado</th><th className="derecha">{padron === 'anexos' ? 'Locales' : 'RUC'}</th><th>Motivo</th></tr>
          </thead>
          <tbody>
            {datos.cargas.map(c => (
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
            {datos.cargas.length === 0 && (
              <tr><td colSpan={5} className="vacio">Todavía no hubo ninguna carga.</td></tr>
            )}
          </tbody>
        </table>
      </div>
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

function ProgresoPadron({ padron, subida, avance }: {
  padron: TipoPadron
  subida: { enviados: number; total: number } | null
  avance: AvancePadron | null
}) {
  // Un reloj para el «lleva 1:23» (la pantalla pide el estado cada 2 s).
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const unidad = TEXTOS[padron].unidad
  const etapa = subida ? 'subiendo' : avance?.etapa ?? 'cargando'
  const primero = subida || avance?.subido ? 'Subir el archivo' : 'Bajar el archivo de SUNAT'
  const orden = ['en_cola', 'bajando', 'subiendo', 'cargando', 'activando']
  const i = orden.indexOf(etapa)
  const estadoDe = (desde: number, hasta: number): Paso['estado'] => i > hasta ? 'hecho' : i >= desde ? 'ahora' : 'falta'
  const pasos: Paso[] = [
    { titulo: primero, estado: estadoDe(0, 2) },
    { titulo: `Cargar los ${unidad}`, estado: estadoDe(3, 3) },
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
    texto = `Bajando el ${TEXTOS[padron].titulo.replace('Padrón', 'padrón')}…`
    detalle = avance.total ? `${MB(avance.hecho)} de ${MB(avance.total)} MB` : `${MB(avance.hecho)} MB bajados`
  } else if (avance.etapa === 'cargando') {
    pct = avance.porcentaje
    texto = `Cargando los ${unidad} en la base de datos…`
    detalle = `${n(avance.filas)} ${unidad}`
  } else {
    texto = 'Ordenando e indexando para que las búsquedas sean rápidas. Es el último paso…'
    detalle = `${n(avance.filas)} ${unidad}`
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