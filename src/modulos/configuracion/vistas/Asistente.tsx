import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { Dialogo } from '../../../componentes/Dialogo'
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
import '../../facturacion/comprobantes-lista.css'
import '../configuracion.css'
import { CapaOcupado } from '../../../componentes/CapaOcupado'

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
        <h1 className="titulo-pagina">Configura tu empresa</h1>
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

  const enPrueba = (estado.empresa?.ambiente ?? 'beta') === 'beta'

  return (
    <div className="cfg-pagina">
      <Link to="/" className="enlace-volver">← Volver al inicio</Link>

      {/* Diseño 16 nov: título sobrio y los pasos arriba, en una barra. */}
      <div className="encabezado-pagina cmp-encab">
        <div>
          <h1 className="titulo-pagina">
            {estado.empresa?.razonSocial ?? 'Configura tu empresa'}
            {estado.empresa && (
              <span className="lst-cuenta">RUC {estado.empresa.ruc} · {enPrueba ? 'modo prueba (beta)' : 'producción'}</span>
            )}
          </h1>
          <p className="bajada-pagina">
            {estado.empresa
              ? 'Puedes salir y volver cuando quieras: lo que guardes se queda.'
              : 'Unos minutos y quedas lista para emitir. Puedes salir y volver: lo que guardes se queda.'}
          </p>
        </div>
      </div>

      {estado.servicio && !estado.servicio.alcanzado && (
        <Aviso tono="ojo">{estado.servicio.error}</Aviso>
      )}

      <ol className="cfg-pasos" aria-label="Pasos">
        {NOMBRES.map((nombre, i) => {
          const n = i + 1
          const clase = n === paso ? 'actual' : hechos[n] ? 'hecho' : undefined
          return (
            <li key={nombre} className={clase}>
              <button type="button" className="paso-boton" onClick={() => irA(n)}
                      disabled={!estado.empresa && n !== 1} aria-current={n === paso ? 'step' : undefined}>
                <i aria-hidden="true">{hechos[n] && n !== paso ? '✓' : n}</i>
                <span>{nombre}{n === 5 && enPrueba && <small>opcional en prueba</small>}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="cfg-cuerpo">
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
        <AyudaPaso paso={paso} enPrueba={enPrueba} />
      </div>
    </div>
  )
}

const NOMBRES = [
  'Tu empresa', 'Firma digital', 'Numeración', 'Envío a clientes', 'SUNAT', 'Listo',
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
  // 069: la Cartera se pasa de su cupo: se dice lo que cuesta y se confirma.
  const [pasaCupo, setPasaCupo] = useState<string | null>(null)
  const rucEscrito = d.ruc.trim()
  const rucCompleto = !estado.empresa && rucEscrito.length === 11 && rucValido(rucEscrito)

  // 18 OCT: si el RUC está libre en Reyban, se trae su ficha de SUNAT. Va
  // DESPUÉS de revisar, para no gastar una consulta en una empresa que ya está.
  const [libre, setLibre] = useState<string | null>(null)
  // Diseño 16 nov: primero solo el RUC; el resto aparece con la ficha de SUNAT
  // (o a mano). «Corregir» abre los campos de siempre.
  const [aMano, setAMano] = useState(false)
  const [corregir, setCorregir] = useState(false)

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
        <h2>Tu empresa</h2>
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

  const conFicha = !!ficha && !noActiva(ficha)
  const buscoSunat = rucCompleto && libre === rucEscrito && !buscandoSunat
  const hayError = Object.values(errores).some(Boolean)
  const verResto = aMano || conFicha || buscoSunat || hayError
  const errorDeDatos = ['razonSocial', 'direccion', 'ubigeo', 'distrito', 'provincia', 'departamento'].some(k => errores[k])
  const fichaCompleta = !!d.razonSocial.trim() && !!d.direccion.trim() && /^\d{6}$/.test(d.ubigeo)
  const camposAMano = aMano || corregir || !conFicha || !fichaCompleta || errorDeDatos

  const enviar = async (ev: FormEvent | null, confirmoCupo = false) => {
    ev?.preventDefault()
    setGeneral(null)
    setPasaCupo(null)

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
      const r = await configuracionServicio.crearEmpresa({ ...d, ruc, confirmoCupo })

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
      if (err instanceof ErrorApi && err.codigo === 'cupo') { setPasaCupo(err.message); return }
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
      {ocupado && <CapaOcupado texto="Guardando tu empresa…" />}
      <h2>Empieza con tu RUC</h2>
      <p className="texto-paso">Con el RUC traemos de SUNAT la razón social y la dirección fiscal. No tienes que copiarlas.</p>

      {general && <Aviso>{general}</Aviso>}

      <div className="cfg-ruc">
        <Campo etiqueta="RUC de la empresa" obligatorio inputMode="numeric" maxLength={11} className="mono"
               value={d.ruc} onChange={poner('ruc')} mal={!!errores.ruc} autoFocus
               pista={errores.ruc || (buscandoSunat ? 'Buscando en SUNAT…'
                 : ficha && !noActiva(ficha) ? '✓ Datos traídos de SUNAT'
                 : rucBien ? '✓ RUC válido' : '11 dígitos.')} />
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

      {/* Lo que trajo SUNAT, para leer. «Corregir» abre los campos. */}
      {verResto && !camposAMano && (
        <div className="cfg-sunat">
          <div className="cfg-sunat-t">
            <span>Según tu ficha RUC{ficha?.estado && <span className="etiqueta acento">{ficha.estado}{ficha.condicion ? ` · ${ficha.condicion}` : ''}</span>}</span>
            <button type="button" className="enlace" onClick={() => setCorregir(true)}>Corregir</button>
          </div>
          <dl>
            <dt>Razón social</dt><dd><strong>{d.razonSocial}</strong></dd>
            <dt>Dirección fiscal</dt><dd>{d.direccion}</dd>
            <dt>Distrito</dt><dd>{d.distrito} · {d.provincia} · {d.departamento} <span className="secundario">({d.ubigeo})</span></dd>
          </dl>
        </div>
      )}

      {verResto && camposAMano && <>
        <Campo etiqueta="Razón social" obligatorio value={d.razonSocial} onChange={poner('razonSocial')}
               mal={!!errores.razonSocial} pista={errores.razonSocial || 'Tal cual la ficha RUC.'} />

        <p className="cfg-ojo">La dirección fiscal sale en cada comprobante: escríbela <strong>tal cual tu ficha RUC</strong>.</p>

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
      </>}

      {verResto && <>
        <div className="pareja">
          <Campo etiqueta="Nombre comercial (opcional)" value={d.nombreComercial} onChange={poner('nombreComercial')}
                 placeholder="Cómo te conocen tus clientes"
                 mal={!!errores.nombreComercial} pista={errores.nombreComercial || undefined} />
          <Campo etiqueta="Correo del dueño de la empresa" obligatorio required type="email" autoComplete="off"
                 placeholder="dueño@empresa.pe" value={d.correoTitular}
                 onChange={poner('correoTitular')} mal={!!errores.correoTitular}
                 pista={errores.correoTitular ||
                   'Sirve para recuperar la empresa si un día la maneja otra persona.'} />
        </div>

        <Pie>
          <Boton type="submit" ocupado={ocupado} textoOcupado="Creando la empresa…">Crear la empresa y seguir</Boton>
        </Pie>
      </>}

      {!verResto && (
        <div className="cfg-a-mano">
          <button type="button" className="enlace" onClick={() => setAMano(true)}>Prefiero llenar los datos a mano</button>
        </div>
      )}
      </>}

      <Dialogo titulo="Te pasas del cupo de tu Cartera" abierto={!!pasaCupo} onCerrar={() => setPasaCupo(null)}
               acciones={<><Boton estilo="secundario" onClick={() => setPasaCupo(null)}>Cancelar</Boton>
                 <Boton ocupado={ocupado} onClick={() => void enviar(null, true)}>Sumar la empresa</Boton></>}>
        <p>{pasaCupo}</p>
        <p className="nota">Las empresas que ya tienes siguen igual. Puedes ver el detalle en «Plan Cartera».</p>
      </Dialogo>
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
  // Diseño 16 nov: dos caminos (tengo mi certificado / quiero probar).
  const elegirCamino = beta && !cargado
  const [camino, setCamino] = useState<'tengo' | 'prueba' | null>(null)
  const via = elegirCamino ? camino : 'tengo'

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
      {ocupado && <CapaOcupado texto="Revisando tu firma digital…" detalle="Comprobamos el certificado y su clave. No cierres esta ventana." />}
      <h2>Firma digital (certificado)</h2>
      <p className="texto-paso">
        Cada factura y boleta va firmada con tu certificado digital: el archivo <strong>.pfx</strong> (o .p12)
        con su contraseña.{elegirCamino && ' ¿Ya lo tienes?'}
      </p>

      {cargado && vence && (
        <div className="aviso bien">
          <strong>✓ Ya tienes un certificado cargado.</strong> Vence el {fecha(vence)}.
          Si subes otro, reemplaza a este.
        </div>
      )}

      {elegirCamino && (
        <div className="cfg-opciones" role="radiogroup" aria-label="¿Tienes certificado digital?">
          <button type="button" role="radio" aria-checked={camino === 'tengo'}
                  className={'cfg-opcion' + (camino === 'tengo' ? ' elegida' : '')}
                  onClick={() => { setCamino('tengo'); setError(null) }}>
            <i aria-hidden="true" />
            <strong>Sí, tengo mi certificado</strong>
            <span>Un archivo .pfx o .p12 con su contraseña. Te lo da SUNAT o una empresa certificadora.</span>
          </button>
          <button type="button" role="radio" aria-checked={camino === 'prueba'}
                  className={'cfg-opcion' + (camino === 'prueba' ? ' elegida' : '')}
                  onClick={() => { setCamino('prueba'); setError(null) }}>
            <i aria-hidden="true" />
            <strong>Todavía no: quiero probar</strong>
            <span>Usamos un certificado de prueba. Sirve para emitir en modo prueba, no ante SUNAT.</span>
          </button>
        </div>
      )}

      {via === 'prueba' && (
        <p className="cfg-nota">Con el de prueba ya puedes emitir comprobantes de prueba. Cuando tengas el tuyo, vuelves a este paso y lo subes.</p>
      )}

      {via === 'tengo' && <>
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
      </>}

      {/* 18 oct: sin casilla. Un certificado de otro RUC sale aquí, en rojo. */}
      {error && <Aviso>{error}</Aviso>}

      {/* e236: la guía para sacar el certificado (gratis en SUNAT, o comprado). */}
      {!cargado && <GuiaCertificado />}

      <Pie atras={atras}>
        {via === 'prueba' ? (
          <Boton onClick={() => void dePrueba()} ocupado={ocupado} textoOcupado="Creando…">Usar uno de prueba y seguir</Boton>
        ) : (
          <Boton onClick={() => void guardar()} ocupado={ocupado} textoOcupado="Guardando…"
                 disabled={(!!error && !!archivo) || via === null}
                 title={via === null ? 'Elige una de las dos opciones' : undefined}>
            {archivo || !cargado ? 'Guardar y seguir' : 'Seguir'}
          </Boton>
        )}
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

  // Diseño 16 nov: primero una pregunta. «Empiezo de cero» agrega las series
  // de siempre con el último número en 0 (la misma llamada que «Agregar»).
  const deOtroSistema = (s: { serie: string; tipoComprobante: string; ultimoCorrelativo: number }) =>
    s.ultimoCorrelativo > 0 || !RAPIDAS.some(([t, x]) => x === s.serie && t === s.tipoComprobante)
  const [yaEmitia, setYaEmitia] = useState(() => series.some(deOtroSistema))
  const [agregando, setAgregando] = useState<string | null>(null)
  const agregarDeCero = async (t: string, s: string) => {
    setError(null)
    setAgregando(s)
    try {
      const r = await configuracionServicio.agregarSerie(t, s, 0, false)
      mensaje.bien(r.mensaje)
      await alCambiar()
    } catch (err) {
      setError(textoDe(err, 'No se pudo agregar la serie.'))
    } finally {
      setAgregando(null)
    }
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
      <h2>Numeración de tus comprobantes</h2>
      <p className="texto-paso">¿Ya emitías facturas o boletas electrónicas con otro sistema?</p>

      <div className="cfg-opciones" role="radiogroup" aria-label="¿Ya emitías con otro sistema?">
        <button type="button" role="radio" aria-checked={!yaEmitia}
                className={'cfg-opcion' + (!yaEmitia ? ' elegida' : '')} onClick={() => { setYaEmitia(false); setError(null) }}>
          <i aria-hidden="true" />
          <strong>No, empiezo de cero</strong>
          <span>Tus comprobantes empiezan en el número 1.</span>
        </button>
        <button type="button" role="radio" aria-checked={yaEmitia}
                className={'cfg-opcion' + (yaEmitia ? ' elegida' : '')} onClick={() => { setYaEmitia(true); setError(null) }}>
          <i aria-hidden="true" />
          <strong>Sí, ya emitía</strong>
          <span>Escribe tu serie y el último número que usaste, para seguir desde ahí.</span>
        </button>
      </div>

      {!yaEmitia && (
        <div className="cfg-series">
          {RAPIDAS.map(([t, s, nombre], i) => {
            const x = series.find(y => y.serie === s && y.tipoComprobante === t)
            return (
              <div key={s}>
                {i === 2 && <div className="cfg-series-sub">Opcional: notas de crédito</div>}
                <div className="cfg-serie">
                  <strong>{s}</strong>
                  <span className="cfg-serie-d">{nombre}</span>
                  <span className="cfg-serie-n">{x ? `la siguiente será ${numero(s, x.ultimoCorrelativo + 1)}` : `empezaría en ${numero(s, 1)}`}</span>
                  {x ? (
                    <>
                      <span className="etiqueta acento">lista</span>
                      {sinUsar(x) && (
                        <Boton estilo="plano" ocupado={quitando === x.id} textoOcupado="Quitando…"
                               disabled={quitando !== null} title={`Quitar la ${s} (nunca se usó)`}
                               onClick={() => void quitar(x.id)}>Quitar</Boton>
                      )}
                    </>
                  ) : (
                    <Boton estilo="secundario" ocupado={agregando === s} textoOcupado="Agregando…"
                           disabled={agregando !== null} onClick={() => void agregarDeCero(t, s)}>Agregar</Boton>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {yaEmitia && <>
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
      </>}

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
      <h2>Envío a tus clientes</h2>
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

      {/* Diseño 16 nov: la marca en su propio bloque (opcional, a la vista). */}
      <div className="cfg-marca">
      <div className="cfg-marca-t"><strong>Tu marca</strong><span>Opcional: se ve bien sin cambiar nada.</span></div>
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
        <div className="vista-correo-titulo">Vista previa del correo · así lo verá tu cliente. Es solo una muestra: el botón funciona en el correo real.</div>
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
      <h2>SUNAT <span className="detalle-paso">(para emitir de verdad)</span></h2>

      {beta && (
        <div className="aviso bien">
          <strong>Estás en modo prueba: puedes saltar este paso.</strong> Tus comprobantes van al entorno de
          pruebas de SUNAT y no tienen valor tributario. Para emitir de verdad, completa esto.
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
        {beta && !guardado && !usuario.trim() && !clave ? (
          <Boton onClick={() => void alTerminar()}>Saltar por ahora</Boton>
        ) : (
          <>
            <Boton estilo="secundario" onClick={() => void alTerminar()}>Lo hago después</Boton>
            <Boton onClick={() => void guardar()} ocupado={ocupado} textoOcupado="Guardando…"
                   disabled={!!usuario.trim() !== !!clave}>
              Guardar y seguir
            </Boton>
          </>
        )}
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
    [1, !!estado.empresa, 'Tu empresa',
      `RUC ${estado.empresa?.ruc ?? ''}${dir ? ` · ${dir.direccion}, ${dir.distrito}` : ''}`],
    [2, !!p?.certificado, 'Firma digital',
      e?.certificadoValidoHasta ? `Válido hasta el ${fecha(e.certificadoValidoHasta)}` : 'Falta cargarlo.'],
    [3, !!p?.series, 'Numeración', series.length ? series.join(' · ') : 'Falta al menos una.'],
    [4, !!p?.correo, 'Envío a clientes',
      e?.portal?.correoRespuesta ? `Respuestas a ${e.portal.correoRespuesta}`
        : 'Sin esto tus clientes no reciben el correo con su comprobante.'],
    [5, !!p?.sol, 'SUNAT',
      p?.sol ? 'Usuario SOL guardado.' : 'Para emitir de verdad. No hace falta para probar.'],
  ]

  return (
    <>
      {activa ? (
        <div className="cabecera-listo">
          <h2>¡Lista para emitir!</h2>
          <span className="texto-paso">
            {estado.empresa?.razonSocial} ya puede emitir
            {(estado.empresa?.ambiente ?? 'beta') === 'beta' ? <> en <strong>beta</strong> (pruebas SUNAT)</> : null}.
            Tú quedas como <strong>Administrador</strong> de esta empresa.
          </span>
        </div>
      ) : (
        <h2>Lista para emitir</h2>
      )}

      <ul className="lista-listo">
        {filas.map(([n, ok, titulo, detalle]) => (
          <li key={n}>
            <span className={ok ? 'marca-listo bien' : n === 5 ? 'marca-listo opcional' : 'marca-listo ojo'} aria-hidden="true">{ok ? '✓' : n === 5 ? '–' : '!'}</span>
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

/**
 * Diseño 16 nov — LA AYUDA DE CADA PASO (columna derecha). Solo texto.
 */
function AyudaPaso({ paso, enPrueba }: { paso: number; enPrueba: boolean }) {
  const ayuda: Record<number, { titulo: string; puntos: ReactNode[] }> = {
    1: { titulo: 'Qué vas a necesitar', puntos: [
      <>El <strong>RUC</strong> de la empresa. Con él traemos de SUNAT la razón social, la dirección fiscal y el distrito.</>,
      <>Revisa que la dirección sea la de tu ficha RUC: sale impresa en cada comprobante.</>,
      <>El <strong>correo del dueño</strong> de la empresa (no el del contador). Si un día la maneja otra persona, con ese correo se recupera.</>,
      <>Si el RUC ya está en Reyban, te ofrecemos pedirle acceso a su titular.</>,
    ] },
    2: { titulo: 'Sobre la firma digital', puntos: [
      <>El certificado es un archivo <strong>.pfx</strong> o <strong>.p12</strong> con una contraseña. Firma cada comprobante para que SUNAT sepa que es tuyo.</>,
      <>Puede ser <strong>gratis</strong>: SUNAT lo da a empresas con renta de 3ra categoría (abajo, «Así lo sacas»). Si no calificas, se compra a una entidad acreditada.</>,
      <>La contraseña es la del archivo, no tu clave SOL. Lo guardamos cifrado y te avisamos antes de que venza.</>,
      ...(enPrueba ? [<>¿Aún no lo tienes? Elige <strong>Quiero probar</strong> y emite comprobantes de prueba desde hoy.</>] : []),
    ] },
    3: { titulo: '¿Qué es una serie?', puntos: [
      <>Son las 4 letras antes del número: <strong>F001</strong>-00000001. Las facturas empiezan con F y las boletas con B.</>,
      <>Si empiezas de cero, con F001 y B001 basta. Las notas de crédito (FC01, BC01) se agregan cuando las necesites.</>,
      <>Si ya emitías con otro sistema, pon el <strong>último número</strong> que usaste: si repites uno, SUNAT lo rechaza.</>,
      <>¿Varias tiendas? Cada sucursal puede tener su serie; se agregan después en <strong>Sucursales</strong>.</>,
    ] },
    4: { titulo: 'Cómo llega a tu cliente', puntos: [
      <>Tu cliente recibe un correo con el PDF y el XML, y un botón para descargarlos.</>,
      <>Si responde ese correo, la respuesta te llega al <strong>correo para respuestas</strong>.</>,
      <>La <strong>página de descargas</strong> es tu dirección en Reyban: se pone una sola vez porque va en los correos enviados.</>,
      <>Logo: PNG o JPG de hasta 300 KB. <strong>Moderno</strong> lleva tu logo; <strong>Clásico</strong> se parece al del portal de SUNAT. Pulsa «Ver ejemplo» para compararlos.</>,
    ] },
    5: { titulo: 'Para emitir de verdad', puntos: [
      ...(enPrueba ? [<>En modo prueba <strong>no hace falta</strong>: puedes saltarlo y volver cuando quieras emitir de verdad.</>] : []),
      <>Entra a <strong>SUNAT Operaciones en Línea</strong> con tu clave SOL principal y crea un <strong>usuario secundario</strong> con el perfil de envío de comprobantes electrónicos.</>,
      <>Aquí pones solo ese usuario y su clave. Nunca tu clave SOL principal.</>,
      <>La clave se guarda cifrada: nadie de Reyban puede verla.</>,
    ] },
    6: { titulo: 'Qué pasa al activar', puntos: [
      <>Se enciende <strong>Facturación</strong> en tu menú y quedas como Administrador de la empresa.</>,
      enPrueba
        ? <>En modo prueba tus comprobantes van al entorno de pruebas de SUNAT: no tienen valor tributario.</>
        : <>Tus comprobantes van a SUNAT y tienen valor tributario.</>,
      <>Lo marcado con <strong>!</strong> falta para emitir; pulsa «Completar» para ir a ese paso.</>,
      <>Todo se puede cambiar después volviendo a Configuración.</>,
    ] },
  }
  const a = ayuda[paso]
  if (!a) return null
  return (
    <aside className="cfg-ayuda" aria-label="Ayuda de este paso">
      <h3>{a.titulo}</h3>
      <ul>{a.puntos.map((p, i) => <li key={i}>{p}</li>)}</ul>
      <p className="cfg-ayuda-pie">¿Te trabaste? Usa <strong>¿Ayuda? Escríbenos</strong> (abajo a la derecha) y te ayudamos a terminar.</p>
    </aside>
  )
}

/**
 * e236 — CÓMO SACAR EL CERTIFICADO DIGITAL. Lo más común en una empresa con
 * renta de 3ra categoría: el Certificado Digital Tributario (CDT), gratis en
 * SUNAT. Si no califica, uno comprado a una entidad acreditada por INDECOPI.
 */
function GuiaCertificado() {
  return (
    <details className="guia-certificado">
      <summary>¿No tienes certificado digital? Así lo sacas (puede ser gratis)</summary>
      <div className="guia-certificado-cuerpo">
        <h4>Opción 1 · Gratis en SUNAT (Certificado Digital Tributario)</h4>
        <p className="secundario">Para empresas con RUC activo y renta de 3ra categoría, que todavía no tengan uno vigente. SUNAT revisa si cumples.</p>
        <ol>
          <li>Entra a <strong>SUNAT Operaciones en Línea</strong> con tu Clave SOL.</li>
          <li>Ve a <strong>Empresas › Comprobantes de pago › Certificado Digital Tributario - CDT › Solicitar Certificado Digital Tributario</strong>.</li>
          <li>Lee los términos, marca la casilla y pulsa <strong>Enviar solicitud</strong>.</li>
          <li>Abre tu <strong>Buzón SOL</strong>: llega el mensaje «Emisión de Certificado Digital Tributario».</li>
          <li>Entra al enlace del mensaje, crea una <strong>contraseña</strong> (8 letras o números como mínimo) y pulsa <strong>Descargar certificado</strong>. Se baja el archivo <strong>certificado.p12</strong>.</li>
          <li>Súbelo aquí arriba con esa contraseña. Guárdala bien: la necesitarás si lo vuelves a subir.</li>
        </ol>
        <h4>Opción 2 · Comprado</h4>
        <p>Si no calificas para el gratuito, cómpralo a una entidad de certificación acreditada por INDECOPI (dura 1 a 3 años). Te entregan un archivo <strong>.pfx</strong> o <strong>.p12</strong> con su contraseña: súbelo aquí igual.</p>
        <p className="secundario">El certificado firma tus comprobantes. Lo guardamos cifrado y nunca lo compartimos. Te avisamos antes de que venza.</p>
      </div>
    </details>
  )
}