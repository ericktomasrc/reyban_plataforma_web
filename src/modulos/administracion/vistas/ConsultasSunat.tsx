import { useCallback, useEffect, useRef, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { consultasSunatServicio } from '../servicios/consultasSunatServicio'
import type { EstadoConsultas, ModoConsultas } from '../servicios/consultasSunatServicio'

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

  const cargar = useCallback(async () => {
    try {
      setEstado(await consultasSunatServicio.estado())
      setFallo(null)
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo cargar.')
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  // Mientras una carga está en curso, se refresca sola cada 15 segundos.
  useEffect(() => {
    if (!estado?.padron.enCurso) return
    const t = setInterval(() => void cargar(), 15000)
    return () => clearInterval(t)
  }, [estado?.padron.enCurso, cargar])

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
      const r = await consultasSunatServicio.descargar()
      mensaje.bien(r.mensaje)
      setTimeout(() => void cargar(), 3000)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo empezar la descarga.')
    } finally {
      setOcupado(null)
    }
  }

  async function subir(archivo: File | undefined) {
    if (!archivo) return
    setOcupado('subir')
    try {
      const r = await consultasSunatServicio.subir(archivo)
      mensaje.bien(r.mensaje)
      setTimeout(() => void cargar(), 3000)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo subir el archivo.')
      await cargar()
    } finally {
      setOcupado(null)
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
                       disabled={ocupado !== null || p.enCurso} onClick={() => void descargar()}>
                  Descargar ahora
                </Boton>
                <Boton estilo="secundario" ocupado={ocupado === 'subir'} textoOcupado="Subiendo…"
                       disabled={ocupado !== null || p.enCurso} onClick={() => elegir.current?.click()}>
                  Subir archivo…
                </Boton>
                <input ref={elegir} type="file" accept=".zip,.txt" hidden
                       onChange={e => void subir(e.target.files?.[0])} />
              </div>
            </div>

            {p.enCurso ? (
              <Aviso tono="ojo">Se está cargando el padrón. Tarda varios minutos; esta pantalla se actualiza sola.</Aviso>
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