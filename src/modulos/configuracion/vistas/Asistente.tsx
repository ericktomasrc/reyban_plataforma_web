import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion, useYo } from '../../../nucleo/sesion/SesionContexto'
import {
  configuracionServicio, identificadorDesde, rucValido,
} from '../servicios/configuracionServicio'
import type { EstadoConfiguracion, FormatoPdf } from '../servicios/configuracionServicio'
import { pedidosServicio } from '../../cartera/servicios/pedidosServicio'
import { SelectorUbigeo, buscarUbigeo } from '../../../nucleo/ubigeo/SelectorUbigeo'
import { noActiva, noHabida, useFichaRuc } from '../../../nucleo/sunat/useFichaRuc'
import { useConexionSunat } from '../../../nucleo/sunat/conexionSunat'
import type { RevisionPedido } from '../../cartera/servicios/pedidosServicio'

/**
 * EL ASISTENTE «AGREGA TU EMPRESA» (fase 2).
 *
 * Seis pasos, del mockup «Fase 2 — Asistente de configuración»:
 *
 *   1 La empresa          crea la empresa aquí y su emisor en el servicio
 *   2 Certificado digital el .pfx, o uno de prueba en beta
 *   3 Series              F001, B001… con el último número usado
 *   4 Correo y marca      a dónde responden tus clientes, logo y color
 *   5 SUNAT               usuario SOL secundario (solo hace falta en producción)
 *   6 Lista para emitir   comprueba con el servicio y activa Facturación
 *
 * SE PUEDE SALIR Y VOLVER: cada paso se guarda al pulsar «Guardar y seguir», y
 * al volver el asistente abre en el primero que falta. Lo que está hecho lo
 * dice el servicio (GET /api/configuracion), no este componente.
 */
export function Asistente() {
  const [estado, setEstado] = useState<EstadoConfiguracion | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [paso, setPaso] = useState(1)

  // ?nueva=1 (fase 3): «Agregar empresa» con otra ya abierta. En cuanto se
  // crea, la nueva queda abierta y el asistente sigue con ella.
  const [parametros, setParametros] = useSearchParams()
  const nueva = useRef(parametros.get('nueva') === '1')

  const cargar = useCallback(async (irAlQueFalta: boolean) => {
    try {
      const e = await configuracionServicio.estado(nueva.current)
      setEstado(e)
      setFallo(null)
      if (irAlQueFalta) setPaso(primerPasoPendiente(e))
      return e
    } catch (err) {
      setFallo(err instanceof ErrorApi ? err.message : 'No se pudo abrir el asistente.')
      return null
    }
  }, [])

  useEffect(() => { void cargar(true) }, [cargar])

  // «+ Agregar empresa» estando ya en el asistente: misma pantalla, otra
  // dirección. Se vuelve a preguntar.
  const pideNueva = parametros.get('nueva') === '1'
  useEffect(() => {
    if (pideNueva !== nueva.current) {
      nueva.current = pideNueva
      void cargar(true)
    }
  }, [pideNueva, cargar])

  if (fallo) return <Aviso>{fallo}</Aviso>
  if (!estado) return <Cargando texto="Abriendo el asistente…" />

  // Sin empresa y sin poder agregarla: se dice por qué.
  if (!estado.empresa && !estado.puedeAgregar) {
    return (
      <>
        <h1 className="titulo-pagina titulo-serif">Agrega tu empresa</h1>
        <Aviso tono="ojo">{estado.motivo ?? 'No puedes agregar una empresa ahora.'}</Aviso>
        <Link to="/" className="boton secundario">← Volver al inicio</Link>
      </>
    )
  }

  const hechos = pasosHechos(estado)

  // El paso 2 en adelante solo existe con empresa.
  const irA = (n: number) => { if (estado.empresa || n === 1) setPaso(n) }

  const siguiente = async () => {
    await cargar(false)
    setPaso(p => Math.min(6, p + 1))
  }

  return (
    <>
      <div><Link to="/" className="volver-arriba">← Volver al inicio</Link></div>

      <div className="bienvenida-cabecera">
        <h1 className="titulo-pagina titulo-serif">
          {estado.empresa?.razonSocial ?? 'Agrega tu empresa'}
        </h1>
        <p className="bajada-pagina">
          {estado.empresa
            ? <>RUC <span className="mono">{estado.empresa.ruc}</span>{' '}
                <span className="etiqueta acento">{estado.empresa.ambiente ?? 'beta'}</span></>
            : 'Seis pasos. Puedes salir y volver: lo que guardes se queda.'}
        </p>
      </div>

      {estado.servicio && !estado.servicio.alcanzado && (
        <Aviso tono="ojo">{estado.servicio.error}</Aviso>
      )}

      <div className="asistente">
        <aside className="bloque asistente-pasos">
          <ol className="lista-pasos">
            {NOMBRES.map((nombre, i) => {
              const n = i + 1
              const clase = n === paso ? 'actual' : hechos[n] ? 'hecho' : undefined
              return (
                <li key={nombre} className={clase}>
                  <button type="button" className="paso-boton" onClick={() => irA(n)}
                          disabled={!estado.empresa && n !== 1}>
                    {nombre}
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        <section className="bloque asistente-paso">
          {paso === 1 && <PasoEmpresa estado={estado} alTerminar={async () => {
            nueva.current = false
            if (parametros.has('nueva')) setParametros(new URLSearchParams())
            await cargar(false)
            setPaso(2)
          }} />}
          {paso === 2 && <PasoCertificado estado={estado} atras={() => setPaso(1)} alTerminar={siguiente} />}
          {paso === 3 && <PasoSeries estado={estado} atras={() => setPaso(2)} alCambiar={() => cargar(false)} alTerminar={siguiente} />}
          {paso === 4 && <PasoCorreo estado={estado} atras={() => setPaso(3)} alTerminar={siguiente} />}
          {paso === 5 && <PasoSunat estado={estado} atras={() => setPaso(4)} alTerminar={siguiente} />}
          {paso === 6 && <PasoListo estado={estado} atras={() => setPaso(5)} irA={irA} recargar={() => cargar(false)} />}
        </section>
      </div>
    </>
  )
}

const NOMBRES = [
  'La empresa', 'Certificado digital', 'Series', 'Correo y marca',
  'SUNAT (para producción)', 'Lista para emitir',
]

function pasosHechos(e: EstadoConfiguracion): Record<number, boolean> {
  const p = e.pasos
  return {
    1: !!e.empresa,
    2: !!p?.certificado,
    3: !!p?.series,
    4: !!p?.correo,
    5: !!p?.sol,
    6: !!e.facturacionActiva,
  }
}

function primerPasoPendiente(e: EstadoConfiguracion): number {
  if (!e.empresa) return 1
  const p = e.pasos
  if (!p?.certificado) return 2
  if (!p?.series) return 3
  if (!p?.correo) return 4
  if (!e.facturacionActiva && !p?.sol) return 5
  return 6
}

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))

function textoDe(err: unknown, porDefecto: string): string {
  return err instanceof ErrorApi ? err.message : porDefecto
}

function campoDe(err: unknown): string | undefined {
  return err instanceof ErrorApi && err.codigo?.startsWith('campo_')
    ? err.codigo.slice('campo_'.length) : undefined
}

/** «← Atrás» y «Guardar y seguir», al pie de cada paso. */
function Pie({ atras, children }: { atras?: () => void; children: ReactNode }) {
  return (
    <div className="pie-asistente">
      {atras
        ? <Boton estilo="secundario" onClick={atras}>← Atrás</Boton>
        : <Link to="/" className="boton secundario">← Atrás</Link>}
      <div className="pie-asistente-derecha">{children}</div>
    </div>
  )
}


// =============================================================================
// PASO 1 — LA EMPRESA
// =============================================================================

function PasoEmpresa({ estado, alTerminar }: { estado: EstadoConfiguracion; alTerminar: () => Promise<void> }) {
  const { refrescar } = useSesion()
  const mensaje = useMensaje()

  const [d, setD] = useState({
    ruc: '', razonSocial: '', nombreComercial: '', direccion: '',
    ubigeo: '', distrito: '', provincia: '', departamento: '',
    // VACÍO A PROPÓSITO (13 oct): el titular es el dueño de la empresa, que
    // casi nunca es quien la da de alta (el contador). Si se llenara solo con
    // el correo de quien entra, la llave para recuperarla quedaría en manos
    // equivocadas sin que nadie lo note.
    correoTitular: '',
  })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  // FASE 4d (camino B): en cuanto el RUC está completo y es válido, se
  // pregunta si ya está en Reyban. Si está, en vez del resto del formulario
  // sale «pedírsela a su titular».
  const [revision, setRevision] = useState<RevisionPedido | null>(null)
  const rucEscrito = d.ruc.trim()
  const rucCompleto = !estado.empresa && rucEscrito.length === 11 && rucValido(rucEscrito)

  // 18 OCT: si el RUC está libre en Reyban, se trae su ficha de SUNAT. Va
  // DESPUÉS de revisar, para no gastar una consulta en una empresa que ya está.
  const [libre, setLibre] = useState<string | null>(null)

  useEffect(() => {
    if (!rucCompleto) { setRevision(null); setLibre(null); return }
    let vigente = true
    pedidosServicio.revisar(rucEscrito)
      .then(r => { if (vigente) { setRevision(r.resultado === 'libre' ? null : r); setLibre(r.resultado === 'libre' ? rucEscrito : null) } })
      .catch(() => { if (vigente) { setRevision(null); setLibre(rucEscrito) } })   // si falla, sigue el alta normal
    return () => { vigente = false }
  }, [rucCompleto, rucEscrito])

  const { ficha, buscando: buscandoSunat } = useFichaRuc(rucEscrito, rucCompleto && libre === rucEscrito)

  // Con la ficha se llenan razón social, dirección y las tres listas. Se
  // pueden corregir a mano; si el RUC cambia, se vuelven a llenar.
  useEffect(() => {
    if (!ficha) return
    const u = ficha.ubigeo ? buscarUbigeo(ficha.ubigeo) : null
    setD(v => ({
      ...v,
      razonSocial: ficha.razonSocial ?? v.razonSocial,
      direccion: ficha.direccion ?? v.direccion,
      ...(u ?? {}),
    }))
    setErrores({})
  }, [ficha])

  // YA CREADA: se enseña como quedó. El RUC no cambia; la dirección se
  // corrige escribiéndonos (sale en cada comprobante).
  if (estado.empresa) {
    const dir = estado.emisor?.direccion
    return (
      <>
        <h2>1 · La empresa</h2>
        <dl className="datos">
          <div className="fila"><dt>RUC</dt><dd className="mono">{estado.empresa.ruc}</dd></div>
          <div className="fila"><dt>Razón social</dt><dd>{estado.empresa.razonSocial}</dd></div>
          <div className="fila"><dt>Nombre</dt><dd>{estado.empresa.nombre}</dd></div>
          <div className="fila"><dt>Correo del titular</dt><dd>{estado.empresa.correoTitular ?? '—'}</dd></div>
          {estado.emisor?.portal?.correoRespuesta && (
            <div className="fila"><dt>Correo para respuestas</dt><dd>{estado.emisor.portal.correoRespuesta}</dd></div>
          )}
          {dir && (
            <div className="fila">
              <dt>Dirección fiscal</dt>
              <dd>{dir.direccion} — {dir.distrito}, {dir.provincia}, {dir.departamento} ({dir.ubigeo})</dd>
            </div>
          )}
        </dl>
        <p className="nota">El RUC ya no cambia. Si la dirección está mal, escríbenos y la corregimos.</p>
        <Pie><Boton onClick={() => void alTerminar()}>Seguir</Boton></Pie>
      </>
    )
  }

  const poner = (campo: keyof typeof d) => (e: { target: { value: string } }) => {
    setD(v => ({ ...v, [campo]: e.target.value }))
    setErrores(v => ({ ...v, [campo]: '' }))
  }

  const ruc = d.ruc.trim()
  const rucBien = ruc.length === 11 && rucValido(ruc)

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    setGeneral(null)

    if (!rucBien) { setErrores({ ruc: 'Revisa el RUC: son 11 dígitos y el último no cuadra.' }); return }
    if (noActiva(ficha)) {
      setErrores({ ruc: `SUNAT tiene este RUC ${ficha?.estado}: una empresa que no está activa no puede emitir comprobantes.` })
      return
    }
    if (!/^\d{6}$/.test(d.ubigeo)) {
      setErrores({ ubigeo: 'Elige el departamento, la provincia y el distrito, como en tu ficha RUC.' })
      return
    }

    setOcupado(true)
    try {
      const r = await configuracionServicio.crearEmpresa({ ...d, ruc })

      // OTRA PETICIÓN, ya con la empresa guardada: le dice al servicio que el
      // alta quedó. La de arriba termina de guardarse un instante DESPUÉS de
      // responder, así que se reintenta un par de veces; si aun así falla, se
      // confirma sola más tarde (al activar, o en la revisión diaria).
      for (let intento = 0; intento < 3; intento++) {
        try { await configuracionServicio.confirmar(); break }
        catch { await esperar(400) }
      }
      await refrescar()
      mensaje.bien(r.mensaje)
      await alTerminar()
    } catch (err) {
      // Ocupado entre que se escribió el RUC y se guardó: se ofrece pedirla.
      if (err instanceof ErrorApi && err.esConflicto && campoDe(err) === 'ruc') {
        try {
          const r = await pedidosServicio.revisar(ruc)
          if (r.resultado !== 'libre') { setRevision(r); return }
        } catch { /* se enseña el error de siempre */ }
      }
      const texto = textoDe(err, 'No se pudo agregar la empresa.')
      const campo = campoDe(err)
      if (campo) setErrores({ [campo]: texto })
      else setGeneral(texto)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <h2>1 · Los datos de la empresa</h2>

      {general && <Aviso>{general}</Aviso>}

      <div className="pareja ruc-razon">
        <Campo etiqueta="RUC" obligatorio inputMode="numeric" maxLength={11} className="mono"
               value={d.ruc} onChange={poner('ruc')} mal={!!errores.ruc}
               pista={errores.ruc || (buscandoSunat ? 'Buscando en SUNAT…'
                 : ficha && !noActiva(ficha) ? '✓ Datos traídos de SUNAT'
                 : rucBien ? '✓ RUC válido' : '11 dígitos.')} />
        {!revision && (
          <Campo etiqueta="Razón social" obligatorio value={d.razonSocial} onChange={poner('razonSocial')}
                 mal={!!errores.razonSocial} pista={errores.razonSocial || 'Tal cual la ficha RUC.'} />
        )}
      </div>

      {revision ? <EmpresaYaEnReyban ruc={ruc} revision={revision} /> : <>

      {noActiva(ficha) && (
        <Aviso>
          Según SUNAT este RUC está <strong>{ficha?.estado}</strong>. Una empresa que no está
          activa no puede emitir facturas ni boletas: SUNAT las rechaza. Revisa el número.
        </Aviso>
      )}
      {!noActiva(ficha) && noHabida(ficha) && (
        <Aviso tono="ojo">
          SUNAT la tiene como <strong>{ficha?.condicion}</strong>. Puedes darla de alta, pero
          SUNAT rechaza los comprobantes de un emisor no habido hasta que actualice su domicilio fiscal.
        </Aviso>
      )}

      <Campo etiqueta="Nombre comercial (opcional)" value={d.nombreComercial} onChange={poner('nombreComercial')}
             mal={!!errores.nombreComercial} pista={errores.nombreComercial || undefined} />

      <Aviso tono="ojo">
        La dirección fiscal sale en cada comprobante. <strong>Cópiala tal cual de tu ficha RUC.</strong>
      </Aviso>

      <Campo etiqueta="Dirección fiscal" obligatorio value={d.direccion} onChange={poner('direccion')}
             mal={!!errores.direccion} pista={errores.direccion || undefined} />

      {/* Departamento ▸ provincia ▸ distrito: el ubigeo se pone solo (17 oct). */}
      <SelectorUbigeo
        ubigeo={d.ubigeo}
        onCambio={u => {
          setD(v => ({ ...v, ...u }))
          setErrores(v => ({ ...v, ubigeo: '', distrito: '', provincia: '', departamento: '' }))
        }}
        error={errores.ubigeo || errores.distrito || errores.provincia || errores.departamento || undefined}
      />

      <Campo etiqueta="Correo del titular" obligatorio required type="email" autoComplete="off"
             placeholder="correo del dueño de la empresa" value={d.correoTitular}
             onChange={poner('correoTitular')} mal={!!errores.correoTitular}
             pista={errores.correoTitular ||
               'El del dueño de la empresa. Es la llave para recuperarla si algún día la gestiona otra persona.'} />

      <Pie>
        <Boton type="submit" ocupado={ocupado} textoOcupado="Creando la empresa…">Guardar y seguir</Boton>
      </Pie>
      </>}
    </form>
  )
}


/**
 * EL RUC YA ESTÁ EN REYBAN (fase 4d, camino B; lienzo «Fase 4», pantalla 9).
 *
 * Si se puede, se le pide al titular: le escribimos a su correo (que aquí
 * solo se ve tapado) y la empresa pasa entera a esta cuenta cuando apruebe.
 * Si no se puede, se dice por qué.
 */
function EmpresaYaEnReyban({ ruc, revision }: { ruc: string; revision: RevisionPedido }) {
  const mensaje = useMensaje()
  const navegar = useNavigate()
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const pedir = async () => {
    setError(null)
    setOcupado(true)
    try {
      const r = await pedidosServicio.pedir(ruc, nota.trim())
      mensaje.bien(r.mensaje)
      if (r.enlaceDePrueba) console.info('Enlace para el titular (solo desarrollo):', r.enlaceDePrueba)
      navegar('/empresas')
    } catch (err) {
      setError(textoDe(err, 'No se pudo pedir la empresa.'))
      setOcupado(false)
    }
  }

  const nombre = revision.empresa ?? 'Esa empresa'

  if (revision.resultado !== 'ok') {
    return (
      <>
        <div className="aviso ojo">
          <strong>{nombre} ya está en Reyban.</strong> {revision.mensaje}
        </div>
        {revision.resultado === 'ya_pediste' && <Link to="/empresas" className="boton secundario">Ir a Mis empresas</Link>}
        {revision.resultado === 'convertir' && <Link to="/perfil#convertir" className="boton secundario">Ir a Mi cuenta</Link>}
        <Pie><span /></Pie>
      </>
    )
  }

  return (
    <>
      <div className="aviso info ya-en-reyban">
        <strong>{nombre} ya está en Reyban</strong>
        <p>
          La lleva otra cuenta. Para traerla a la tuya, se lo pedimos a su <strong>titular</strong> por correo. Si
          acepta, la empresa pasa entera a tu cuenta: comprobantes, clientes, series y usuarios. <strong>Nada se borra.</strong>
        </p>
        <dl className="datos-cortos">
          <div><dt>Le escribimos a</dt><dd className="mono">{revision.correo}</dd></div>
          <div><dt>El enlace vale</dt><dd>7 días</dd></div>
        </dl>
      </div>

      <div className="campo">
        <label htmlFor="nota-titular">Mensaje para el titular <span className="detalle-paso">(opcional)</span></label>
        <textarea id="nota-titular" rows={3} maxLength={500} value={nota} onChange={e => setNota(e.target.value)}
                  placeholder="Soy Ana, del Estudio Ruiz. Desde este mes llevo tu contabilidad, como conversamos." />
        <span className="pista">Le llega tal cual, con tu nombre y el de tu cuenta.</span>
      </div>

      {error && <Aviso>{error}</Aviso>}

      <div className="aviso ojo">
        ¿Ese correo ya no es del titular? El titular puede reclamarla con sus documentos desde{' '}
        <strong>«Recupérala»</strong> en la pantalla de ingreso.
      </div>

      <Pie>
        <Boton onClick={() => void pedir()} ocupado={ocupado} textoOcupado="Pidiendo…">Pedir al titular</Boton>
      </Pie>
    </>
  )
}


// =============================================================================
// PASO 2 — EL CERTIFICADO
// =============================================================================

function PasoCertificado({ estado, atras, alTerminar }: {
  estado: EstadoConfiguracion; atras: () => void; alTerminar: () => Promise<void>
}) {
  const mensaje = useMensaje()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  const vence = estado.emisor?.certificadoValidoHasta
  const cargado = !!estado.pasos?.certificado
  // 030: en producción (conexión fija en real) no hay certificado de prueba.
  const conexion = useConexionSunat()
  const beta = (estado.empresa?.ambiente ?? 'beta') === 'beta' && !conexion?.fija

  const elegir = (f: File | null | undefined) => {
    setArchivo(f ?? null)
    setError(null)
  }

  const guardar = async () => {
    setError(null)

    if (!archivo) {
      if (cargado) { await alTerminar(); return }
      setError('Elige el archivo .pfx de tu certificado, o usa uno de prueba.')
      return
    }

    setOcupado(true)
    try {
      // 18 oct: ya no se confirma un certificado de otro RUC; se rechaza.
      const r = await configuracionServicio.subirCertificado(archivo, clave, false)
      mensaje.bien(`${r.mensaje} Vence el ${fecha(r.validoHasta)}.`)
      setArchivo(null); setClave('')
      await alTerminar()
    } catch (err) {
      // RUC que no coincide: en rojo hasta que se elija otro archivo.
      setError(textoDe(err, 'No se pudo guardar el certificado.'))
    } finally {
      setOcupado(false)
    }
  }

  const dePrueba = async () => {
    setError(null)
    setOcupado(true)
    try {
      const r = await configuracionServicio.certificadoDePrueba()
      mensaje.bien(r.mensaje)
      await alTerminar()
    } catch (err) {
      setError(textoDe(err, 'No se pudo crear el certificado de prueba.'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <h2>2 · Certificado digital</h2>
      <p className="texto-paso">
        Firma cada comprobante. Es el archivo <strong>.pfx</strong> (o .p12) que te dio la empresa
        certificadora, con su contraseña.
      </p>

      {cargado && vence && (
        <div className="aviso bien">
          <strong>✓ Ya tienes un certificado cargado.</strong> Vence el {fecha(vence)}.
          Si subes otro, reemplaza a este.
        </div>
      )}

      <label
        className={'zona-archivo' + (arrastrando ? ' encima' : '')}
        onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={e => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files[0]) }}
      >
        <input ref={entrada} type="file" accept=".pfx,.p12" className="oculto"
               onChange={e => elegir(e.target.files?.[0])} />
        <span className="zona-archivo-icono" aria-hidden="true">⬆</span>
        <span>Arrastra aquí tu archivo, o <span className="enlace">elígelo</span></span>
        {archivo && <span className="zona-archivo-nombre">{archivo.name} · {Math.ceil(archivo.size / 1024)} KB</span>}
      </label>

      <Campo etiqueta="Contraseña del certificado" type="password" autoComplete="off"
             value={clave} onChange={e => setClave(e.target.value)}
             pista="No es tu clave SOL: es la del archivo. Se guarda cifrada." />

      {/* 18 oct: sin casilla. Un certificado de otro RUC sale aquí, en rojo. */}
      {error && <Aviso>{error}</Aviso>}

      {beta && (
        <div className="aviso ojo fila-aviso">
          <span>¿Todavía no tienes certificado? En <strong>beta</strong> puedes probar con uno de prueba.</span>
          <Boton estilo="secundario" onClick={() => void dePrueba()} disabled={ocupado}>Usar uno de prueba</Boton>
        </div>
      )}

      <Pie atras={atras}>
        <Boton onClick={() => void guardar()} ocupado={ocupado} textoOcupado="Guardando…"
               disabled={!!error && !!archivo}>
          {archivo || !cargado ? 'Guardar y seguir' : 'Seguir'}
        </Boton>
      </Pie>
    </>
  )
}


// =============================================================================
// PASO 3 — LAS SERIES
// =============================================================================

const TIPOS: [string, string][] = [
  ['01', 'Factura'], ['03', 'Boleta'], ['07', 'Nota de crédito'], ['08', 'Nota de débito'],
]

const RAPIDAS: [string, string, string][] = [
  ['01', 'F001', 'Factura'], ['03', 'B001', 'Boleta'],
  ['07', 'FC01', 'N. crédito factura'], ['07', 'BC01', 'N. crédito boleta'],
]

function nombreTipo(t: string) { return TIPOS.find(([c]) => c === t)?.[1] ?? t }
function numero(serie: string, n: number) { return `${serie}-${String(n).padStart(8, '0')}` }

function PasoSeries({ estado, atras, alCambiar, alTerminar }: {
  estado: EstadoConfiguracion; atras: () => void
  alCambiar: () => Promise<unknown>; alTerminar: () => Promise<void>
}) {
  const mensaje = useMensaje()
  const series = estado.series ?? []

  // El formulario empieza con el primer atajo que falta (F001, luego B001…).
  const primeraLibre = RAPIDAS.find(([t, s]) => !series.some(x => x.serie === s && x.tipoComprobante === t))
  const [tipo, setTipo] = useState(primeraLibre?.[0] ?? '01')
  const [serie, setSerie] = useState(primeraLibre?.[1] ?? '')
  const [ultimo, setUltimo] = useState('0')
  const [confirmado, setConfirmado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const existe = (s: string, t: string) => series.some(x => x.serie === s && x.tipoComprobante === t)
  const n = Number.parseInt(ultimo || '0', 10)
  const nValido = Number.isInteger(n) && n >= 0 && n <= 99999999

  const rapida = (t: string, s: string) => {
    setTipo(t); setSerie(s); setUltimo('0'); setConfirmado(false); setError(null)
  }

  // 22 OCT: QUITAR UNA SERIE AGREGADA POR ERROR. Solo si nunca se usó: último
  // número 0 y ningún comprobante. Si no, el botón queda apagado y dice por qué.
  const [quitando, setQuitando] = useState<string | null>(null)
  const sinUsar = (s: { ultimoCorrelativo: number; comprobantes: number }) =>
    s.ultimoCorrelativo === 0 && (s.comprobantes ?? 0) === 0
  const quitar = async (id: string) => {
    setError(null)
    setQuitando(id)
    try {
      const r = await configuracionServicio.quitarSerie(id)
      mensaje.bien(r.mensaje)
      await alCambiar()
    } catch (err) {
      setError(textoDe(err, 'No se pudo quitar la serie.'))
    } finally {
      setQuitando(null)
    }
  }

  const agregar = async () => {
    setError(null)
    if (!nValido) { setError('El último número va de 0 a 99999999.'); return }
    setOcupado(true)
    try {
      const r = await configuracionServicio.agregarSerie(tipo, serie.trim().toUpperCase(), n, confirmado)
      mensaje.bien(r.mensaje)
      setConfirmado(false)
      await alCambiar()
      const libre = RAPIDAS.find(([t, s]) => !existe(s, t) && !(t === tipo && s === serie.trim().toUpperCase()))
      if (libre) rapida(libre[0], libre[1])
    } catch (err) {
      setError(textoDe(err, 'No se pudo agregar la serie.'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <h2>3 · Series</h2>
      <p className="texto-paso">
        Cada tipo de comprobante necesita su serie. Si ya emitías con otro sistema, pon el{' '}
        <strong>último número que usaste</strong>; si empiezas de cero, déjalo en 0.
      </p>

      <div className="chips">
        <span className="chips-etiqueta">Agregar rápido:</span>
        {RAPIDAS.map(([t, s, nombre]) => (
          <button key={s} type="button" disabled={existe(s, t)}
                  className={'chip' + (existe(s, t) ? ' puesto' : serie === s && tipo === t ? ' elegido' : '')}
                  onClick={() => rapida(t, s)}>
            {existe(s, t) ? '✓' : '+'} {s} · {nombre}
          </button>
        ))}
      </div>

      {series.length > 0 && (
        <table className="tabla">
          <thead>
            <tr><th>Comprobante</th><th>Serie</th><th>Último número usado</th><th>El siguiente será</th>
              <th><span className="solo-lector">Acción</span></th></tr>
          </thead>
          <tbody>
            {series.map(s => (
              <tr key={s.id}>
                <td>{nombreTipo(s.tipoComprobante)}</td>
                <td className="mono">{s.serie}</td>
                <td className="mono">{s.ultimoCorrelativo}</td>
                <td className="mono">{numero(s.serie, s.ultimoCorrelativo + 1)}</td>
                <td className="derecha">
                  <Boton estilo="plano" ocupado={quitando === s.id} textoOcupado="Quitando…"
                         disabled={!sinUsar(s) || quitando !== null}
                         title={sinUsar(s) ? `Quitar la ${s.serie} (nunca se usó)` : `La ${s.serie} ya se usó: no se puede quitar`}
                         onClick={() => void quitar(s.id)}>
                    Quitar
                  </Boton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="nueva-serie">
        <div className="campo">
          <label htmlFor="tipo-serie">Comprobante</label>
          <select id="tipo-serie" value={tipo} onChange={e => setTipo(e.target.value)}>
            {TIPOS.map(([c, nombre]) => <option key={c} value={c}>{nombre}</option>)}
          </select>
        </div>
        <Campo etiqueta="Serie" maxLength={4} className="mono" value={serie}
               onChange={e => setSerie(e.target.value.toUpperCase())} />
        <Campo etiqueta="Último número usado" inputMode="numeric" className="mono" value={ultimo}
               onChange={e => { setUltimo(e.target.value.replace(/\D/g, '')); setConfirmado(false) }} />
        <Boton estilo="secundario" onClick={() => void agregar()} ocupado={ocupado} textoOcupado="Agregando…"
               disabled={serie.trim().length !== 4 || (n > 0 && !confirmado)}>
          Agregar
        </Boton>
      </div>

      {nValido && n > 0 && serie.trim().length === 4 && (
        <div className="aviso ojo">
          <p><strong>{serie} empezará en {n + 1}</strong> ({numero(serie, n + 1)}). Revísalo: si SUNAT ya tiene ese
            número, el comprobante se rechaza. Luego solo se puede subir, nunca bajar.</p>
          <label className="casilla-terminos">
            <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />
            Confirmo que el último número de {serie} es {n}
          </label>
        </div>
      )}

      {error && <Aviso>{error}</Aviso>}

      <Pie atras={atras}>
        <Boton onClick={() => void alTerminar()} disabled={series.length === 0}
               title={series.length === 0 ? 'Agrega al menos una serie' : undefined}>
          Seguir
        </Boton>
      </Pie>
    </>
  )
}


// =============================================================================
// PASO 4 — CORREO Y MARCA
// =============================================================================

const COLORES = ['#0f6f6c', '#1f4e8c', '#8a2b2b', '#5b3f8c', '#2f2f2f']

function PasoCorreo({ estado, atras, alTerminar }: {
  estado: EstadoConfiguracion; atras: () => void; alTerminar: () => Promise<void>
}) {
  const yo = useYo()
  const mensaje = useMensaje()
  const portal = estado.emisor?.portal
  const fijo = portal?.identificador ?? null
  const nombre = estado.empresa?.nombre ?? ''

  const [identificador, setIdentificador] = useState(fijo ?? identificadorDesde(nombre))
  const [correo, setCorreo] = useState(portal?.correoRespuesta ?? yo.usuario.correo)
  const [copia, setCopia] = useState(true)
  const [color, setColor] = useState(COLORES[0])
  const [logo, setLogo] = useState<File | null>(null)
  const [vista, setVista] = useState<string | null>(null)
  // 23 oct: el formato del PDF. null = todavía no se sabe (o el servicio no lo tiene).
  const [formato, setFormato] = useState<FormatoPdf | null>(null)
  const [formatoGuardado, setFormatoGuardado] = useState<FormatoPdf | null>(null)
  const [viendo, setViendo] = useState<FormatoPdf | null>(null)

  useEffect(() => {
    let vivo = true
    configuracionServicio.formatoPdf()
      .then(r => { if (vivo) { setFormato(r.formato); setFormatoGuardado(r.formato) } })
      .catch(() => { /* sin el servicio actualizado: no se ofrece */ })
    return () => { vivo = false }
  }, [])

  const verEjemplo = async (f: FormatoPdf) => {
    setViendo(f)
    try {
      const pdf = await configuracionServicio.muestraPdf(f)
      const url = URL.createObjectURL(pdf)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      mensaje.error(textoDe(err, 'No se pudo generar el ejemplo.'))
    } finally {
      setViendo(null)
    }
  }
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!logo) { setVista(null); return }
    const url = URL.createObjectURL(logo)
    setVista(url)
    return () => URL.revokeObjectURL(url)
  }, [logo])

  const guardar = async () => {
    setError(null)
    setOcupado(true)
    try {
      await configuracionServicio.guardarMarca({
        identificador: fijo ?? (identificador.trim() || null),
        colorMarca: color,
        correoRespuesta: correo.trim() || null,
        copiaAlEmisor: copia,
      })
      if (logo) await configuracionServicio.subirLogo(logo)
      if (formato && formato !== formatoGuardado) {
        await configuracionServicio.guardarFormatoPdf(formato)
        setFormatoGuardado(formato)
      }
      mensaje.bien('Correo y marca guardados.')
      await alTerminar()
    } catch (err) {
      setError(textoDe(err, 'No se pudo guardar.'))
    } finally {
      setOcupado(false)
    }
  }

  const inicial = (nombre.trim()[0] ?? 'E').toUpperCase()

  return (
    <>
      <h2>4 · Correo y marca</h2>
      <p className="texto-paso">
        Así llega cada comprobante a tus clientes: un correo con el PDF y el XML, y un enlace para descargarlos.
      </p>

      <div className="pareja">
        <Campo etiqueta="Dirección de tu página de descargas" obligatorio value={identificador}
               readOnly={!!fijo} onChange={e => setIdentificador(e.target.value.toLowerCase())}
               pista={fijo
                 ? 'Ya está puesta y no se cambia: va en los correos enviados.'
                 : 'Minúsculas, números y guiones. Se pone una sola vez.'} />
        <Campo etiqueta="Correo para respuestas" obligatorio type="email" value={correo}
               onChange={e => setCorreo(e.target.value)}
               pista="Si el cliente responde, le llega a este correo." />
      </div>

      <label className="interruptor">
        <input type="checkbox" checked={copia} onChange={e => setCopia(e.target.checked)} />
        <span>Mandarme una copia de cada comprobante a {correo || 'ese correo'}</span>
      </label>

      <div className="pareja">
        <div className="campo">
          <span className="etiqueta">Logo (opcional)</span>
          <label className="zona-archivo baja">
            <input type="file" accept="image/png,image/jpeg" className="oculto"
                   onChange={e => setLogo(e.target.files?.[0] ?? null)} />
            {vista
              ? <img src={vista} alt="" className="logo-vista" />
              : <span className="logo-inicial" style={{ background: color }}>{inicial}</span>}
            <span>{logo ? logo.name : portal?.tieneLogo ? 'Ya tienes logo · cambiarlo' : 'Elegir PNG o JPG'}</span>
          </label>
          <span className="pista">Máximo 300 KB.</span>
        </div>
        <div className="campo">
          <span className="etiqueta">Color</span>
          <div className="colores">
            {COLORES.map(c => (
              <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c}
                      className={'color' + (color === c ? ' elegido' : '')} style={{ background: c }}
                      onClick={() => setColor(c)} />
            ))}
          </div>
          <span className="pista">Para el correo y la página de descarga.</span>
        </div>
      </div>

      {/* 23 OCT: EL FORMATO DEL PDF (A4) de facturas, boletas y notas. */}
      {formato && (
        <div className="campo">
          <span className="etiqueta">Formato del PDF</span>
          <div className="modos-consulta">
            <div className={formato === 'moderno' ? 'modo elegido' : 'modo'}>
              <label className="interruptor">
                <input type="radio" name="formato-pdf" checked={formato === 'moderno'} onChange={() => setFormato('moderno')} />
                <strong>Moderno</strong>
              </label>
              <span>Con tu logo, limpio, los totales que existen y el QR al pie.</span>
              <Boton estilo="plano" ocupado={viendo === 'moderno'} textoOcupado="Generando…"
                     onClick={() => void verEjemplo('moderno')}>Ver ejemplo</Boton>
            </div>
            <div className={formato === 'clasico' ? 'modo elegido' : 'modo'}>
              <label className="interruptor">
                <input type="radio" name="formato-pdf" checked={formato === 'clasico'} onChange={() => setFormato('clasico')} />
                <strong>Clásico (estilo SUNAT)</strong>
              </label>
              <span>Como el del portal de SUNAT: blanco y negro, cuadro de totales completo y cuadro de detracción.</span>
              <Boton estilo="plano" ocupado={viendo === 'clasico'} textoOcupado="Generando…"
                     onClick={() => void verEjemplo('clasico')}>Ver ejemplo</Boton>
            </div>
          </div>
          <span className="pista">
            Vale para facturas, boletas y notas: en tu panel, en la página de descargas y en el correo
            (también los ya emitidos). El ticket no cambia. El ejemplo sale con tus datos y tu logo ya guardado.
          </span>
        </div>
      )}

      <div className="vista-correo">
        <div className="vista-correo-titulo">Vista previa del correo</div>
        <div className="vista-correo-cuerpo">
          <div className="vista-correo-marca">
            {vista
              ? <img src={vista} alt="" className="logo-vista chico" />
              : <span className="logo-inicial chico" style={{ background: color }}>{inicial}</span>}
            <strong>{nombre}</strong>
          </div>
          <span>Hola, te enviamos la <strong>Factura F001-00000001</strong> por S/ 1,180.00.</span>
          <span><span className="boton-muestra" style={{ background: color }}>Descargar PDF y XML</span></span>
        </div>
      </div>

      {error && <Aviso>{error}</Aviso>}

      <Pie atras={atras}>
        <Boton onClick={() => void guardar()} ocupado={ocupado} textoOcupado="Guardando…"
               disabled={!correo.trim() || !identificador.trim()}>
          Guardar y seguir
        </Boton>
      </Pie>
    </>
  )
}


// =============================================================================
// PASO 5 — SUNAT (para producción)
// =============================================================================

function PasoSunat({ estado, atras, alTerminar }: {
  estado: EstadoConfiguracion; atras: () => void; alTerminar: () => Promise<void>
}) {
  const mensaje = useMensaje()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const ruc = estado.empresa?.ruc ?? ''
  const beta = (estado.empresa?.ambiente ?? 'beta') === 'beta'
  const guardado = !!estado.pasos?.sol

  const guardar = async () => {
    setError(null)
    if (!usuario.trim() && !clave) { await alTerminar(); return }
    setOcupado(true)
    try {
      const r = await configuracionServicio.guardarSol(usuario.trim(), clave)
      mensaje.bien(r.mensaje)
      setClave('')
      await alTerminar()
    } catch (err) {
      setError(textoDe(err, 'No se pudo guardar el usuario SOL.'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <h2>5 · SUNAT <span className="detalle-paso">(para producción)</span></h2>

      {beta && (
        <div className="aviso bien">
          <strong>Estás en beta: este paso puedes dejarlo para después.</strong> En beta tus comprobantes van al
          entorno de pruebas de SUNAT y no tienen valor tributario. Para emitir de verdad, completa esto.
        </div>
      )}

      {guardado && <div className="aviso bien"><strong>✓ Tu usuario SOL ya está guardado.</strong> Si escribes otro, lo reemplaza.</div>}

      <p className="texto-paso">
        Necesitamos un <strong>usuario SOL secundario</strong> para enviar tus comprobantes a SUNAT. No uses tu
        clave SOL principal: crea uno nuevo solo para esto.
      </p>

      <div className="pareja">
        <Campo etiqueta="Usuario SOL secundario" className="mono" autoComplete="off" value={usuario}
               onChange={e => setUsuario(e.target.value.toUpperCase())}
               pista={`Solo el usuario. Se envía como ${ruc}${usuario.trim() || 'USUARIO'}.`} />
        <Campo etiqueta="Clave SOL de ese usuario" type="password" autoComplete="new-password" value={clave}
               onChange={e => setClave(e.target.value)} pista="Se guarda cifrada. Nadie puede verla." />
      </div>

      <div className="bloque-interno">
        <strong>Antes de pasar a producción, en SUNAT Operaciones en Línea:</strong>
        <ul className="lista-nota">
          <li>Crea el usuario secundario con el perfil de envío de comprobantes electrónicos.</li>
          <li>Afíliate como emisor electrónico desde el sistema del contribuyente.</li>
        </ul>
        <span className="nota">La guía paso a paso llega muy pronto.</span>
      </div>

      {error && <Aviso>{error}</Aviso>}

      <Pie atras={atras}>
        <Boton estilo="secundario" onClick={() => void alTerminar()}>Lo hago después</Boton>
        <Boton onClick={() => void guardar()} ocupado={ocupado} textoOcupado="Guardando…"
               disabled={!!usuario.trim() !== !!clave}>
          Guardar y seguir
        </Boton>
      </Pie>
    </>
  )
}


// =============================================================================
// PASO 6 — LISTA PARA EMITIR
// =============================================================================

function PasoListo({ estado, atras, irA, recargar }: {
  estado: EstadoConfiguracion; atras: () => void
  irA: (n: number) => void; recargar: () => Promise<unknown>
}) {
  const { refrescar } = useSesion()
  const navegar = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const intentado = useRef(false)

  const p = estado.pasos
  const activa = !!estado.facturacionActiva
  const listo = !!p?.listo

  const activar = useCallback(async () => {
    setError(null)
    setOcupado(true)
    try {
      await configuracionServicio.terminar()
      await refrescar()     // el menú trae Facturación
      await recargar()
    } catch (err) {
      setError(textoDe(err, 'No se pudo activar la facturación.'))
    } finally {
      setOcupado(false)
    }
  }, [refrescar, recargar])

  // Al llegar con todo listo, se activa sola: es lo que el paso promete.
  useEffect(() => {
    if (listo && !activa && !intentado.current) {
      intentado.current = true
      void activar()
    }
  }, [listo, activa, activar])

  const e = estado.emisor
  const dir = e?.direccion
  const series = e?.listo?.series ?? []

  const filas: [number, boolean, string, string][] = [
    [1, !!estado.empresa, 'La empresa',
      `RUC ${estado.empresa?.ruc ?? ''}${dir ? ` · ${dir.direccion}, ${dir.distrito}` : ''}`],
    [2, !!p?.certificado, 'Certificado digital',
      e?.certificadoValidoHasta ? `Válido hasta el ${fecha(e.certificadoValidoHasta)}` : 'Falta cargarlo.'],
    [3, !!p?.series, 'Series', series.length ? series.join(' · ') : 'Falta al menos una.'],
    [4, !!p?.correo, 'Correo y marca',
      e?.portal?.correoRespuesta ? `Respuestas a ${e.portal.correoRespuesta}`
        : 'Sin esto tus clientes no reciben el correo con su comprobante.'],
    [5, !!p?.sol, 'SUNAT (para producción)',
      p?.sol ? 'Usuario SOL guardado.' : 'Falta tu usuario SOL. No impide probar en beta.'],
  ]

  return (
    <>
      {activa ? (
        <div className="cabecera-listo">
          <h2 className="titulo-serif">¡Lista para emitir!</h2>
          <span className="texto-paso">
            {estado.empresa?.razonSocial} ya puede emitir
            {(estado.empresa?.ambiente ?? 'beta') === 'beta' ? <> en <strong>beta</strong> (pruebas SUNAT)</> : null}.
            Tú quedas como <strong>Administrador</strong> de esta empresa.
          </span>
        </div>
      ) : (
        <h2>6 · Lista para emitir</h2>
      )}

      <ul className="lista-listo">
        {filas.map(([n, ok, titulo, detalle]) => (
          <li key={n}>
            <span className={ok ? 'marca-listo bien' : 'marca-listo ojo'} aria-hidden="true">{ok ? '✓' : '!'}</span>
            <span className="lista-listo-texto">
              <strong>{titulo}</strong>
              <span>{detalle}</span>
            </span>
            {!ok && <button type="button" className="enlace" onClick={() => irA(n)}>Completar</button>}
          </li>
        ))}
      </ul>

      {!listo && !activa && (
        <Aviso tono="ojo">
          Todavía falta algo para emitir: {(e?.listo?.faltan ?? []).join(' ') || 'completa los pasos marcados.'}
        </Aviso>
      )}

      {error && <Aviso>{error}</Aviso>}

      <div className="pie-asistente">
        <Boton estilo="secundario" onClick={atras}>← Atrás</Boton>
        <div className="pie-asistente-derecha">
          {activa ? (
            <>
              <Link to="/" className="boton secundario">Ir al inicio</Link>
              <Boton onClick={() => navegar('/facturacion/comprobantes/nuevo')}>Emitir mi primera factura</Boton>
            </>
          ) : (
            <Boton onClick={() => void activar()} ocupado={ocupado} textoOcupado="Activando…" disabled={!listo}>
              Activar facturación
            </Boton>
          )}
        </div>
      </div>

      <p className="nota">Todo esto lo puedes cambiar después volviendo a este asistente.</p>
    </>
  )
}