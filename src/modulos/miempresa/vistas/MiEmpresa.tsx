import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { noActiva, noHabida, useFichaRuc } from '../../../nucleo/sunat/useFichaRuc'
import { SelectorUbigeo, buscarUbigeo } from '../../../nucleo/ubigeo/SelectorUbigeo'
import { FilaRegla, GrupoRegla } from '../../planes/componentes/Reglas'
import { soles } from '../../../nucleo/planes/planes'
import { NOMBRE_TIPO, miEmpresaServicio, type ComprobanteCobro, type DatosMiEmpresa, type MiEmpresa } from '../servicios/miEmpresaServicio'

type Seccion = 'datos' | 'facturacion' | 'series' | 'comprobantes'

const SECCIONES: { seccion: Seccion; ruta: string; titulo: string; texto: string }[] = [
  { seccion: 'datos', ruta: '/admin/mi-empresa', titulo: 'Datos de la empresa', texto: 'RUC 20 (empresa) o RUC 10 (persona natural con negocio), razón social y dirección fiscal.' },
  { seccion: 'facturacion', ruta: '/admin/mi-empresa/facturacion', titulo: 'Facturación electrónica', texto: 'Certificado digital, usuario SOL, correo y logo del PDF.' },
  { seccion: 'series', ruta: '/admin/mi-empresa/series', titulo: 'Series', texto: 'F001 para facturas, B001 para boletas y las de notas de crédito.' },
  { seccion: 'comprobantes', ruta: '/admin/mi-empresa/comprobantes', titulo: 'Comprobantes de cobros', texto: 'Con qué series sale la factura o boleta de cada pago, y la lista de las que ya salieron.' },
]

/**
 * 075 — MI EMPRESA (super administrador).
 *
 * La empresa de Reyban que cobra los planes y emite la factura o boleta de
 * cada pago. Aparte de «Empresas» (los clientes). Este menú SOLO CONFIGURA:
 * no hay botón para emitir a mano; los comprobantes de cobros los emite el
 * sistema solo cuando un cliente paga.
 */
export function MiEmpresaPagina() {
  const { pathname } = useLocation()
  const seccion: Seccion = pathname.endsWith('/facturacion') ? 'facturacion'
    : pathname.endsWith('/series') ? 'series' : pathname.endsWith('/comprobantes') ? 'comprobantes' : 'datos'
  const [d, setD] = useState<MiEmpresa>()
  const [error, setError] = useState<string>()

  const cargar = useCallback(async () => {
    try { setD(await miEmpresaServicio.leer()); setError(undefined) }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar Mi empresa.') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  if (error) return <Aviso>{error}</Aviso>
  if (!d) return <Cargando />

  const actual = SECCIONES.find(s => s.seccion === seccion)!
  const sinEmpresa = !d.empresa

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">Mi empresa · {actual.titulo}</h1>
          <p className="secundario">
            La empresa de Reyban que cobra los planes y emite la factura o boleta de cada pago. No es una de tus clientes:
            esas están en <Link to="/admin/empresas">Empresas</Link>.
          </p>
        </div>
      </div>

      {d.empresa && <Avance d={d} />}

      {sinEmpresa && seccion !== 'datos'
        ? <Aviso tono="info">Primero registra tu empresa en <Link to="/admin/mi-empresa">Mi empresa › Datos de la empresa</Link>.</Aviso>
        : seccion === 'datos' ? (d.empresa ? <DatosRegistrados d={d} /> : <Registrar onHecho={cargar} />)
        : seccion === 'facturacion' ? <Facturacion d={d} onHecho={cargar} />
        : seccion === 'series' ? <Series d={d} onHecho={cargar} />
        : <Comprobantes d={d} onHecho={cargar} />}
    </>
  )
}

/** Los cuatro pasos, con lo que falta. */
function Avance({ d }: { d: MiEmpresa }) {
  const p = d.pasos
  const items = [
    { ok: true, texto: 'Datos', ruta: '/admin/mi-empresa' },
    { ok: !!p?.certificado, texto: 'Certificado', ruta: '/admin/mi-empresa/facturacion' },
    { ok: !!p?.series, texto: 'Series', ruta: '/admin/mi-empresa/series' },
    { ok: !!p?.sol, texto: 'Usuario SOL', ruta: '/admin/mi-empresa/facturacion' },
    { ok: !!(d.cobros?.serieFactura || d.cobros?.serieBoleta), texto: 'Series de cobros', ruta: '/admin/mi-empresa/comprobantes' },
  ]
  return (
    <div className={`avance-mi-empresa${p?.listo ? ' listo' : ''}`}>
      <div className="avance-pasos">
        {items.map(i => <Link key={i.texto} to={i.ruta} className={i.ok ? 'ok' : 'falta'}>{i.ok ? '✓' : '○'} {i.texto}</Link>)}
      </div>
      <p>
        {d.servicio && !d.servicio.alcanzado ? `⚠ ${d.servicio.error}`
          : p?.listo ? `✓ Lista para emitir en ${d.empresa?.ambiente === 'produccion' ? 'SUNAT real' : 'beta (prueba)'}.`
          : `Falta: ${(d.emisor?.listo?.faltan ?? []).join(' ') || 'completar los pasos.'}`}
      </p>
    </div>
  )
}

// =============================================================================
// 1. DATOS DE LA EMPRESA
// =============================================================================
const VACIO: DatosMiEmpresa = { tipo: 'ruc10', ruc: '', razonSocial: '', nombreComercial: '', direccion: '', ubigeo: '', distrito: '', provincia: '', departamento: '' }

function Registrar({ onHecho }: { onHecho: () => Promise<void> }) {
  const mensaje = useMensaje()
  const [f, setF] = useState<DatosMiEmpresa>(VACIO)
  const [ocupado, setOcupado] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string>()
  const ruc = f.ruc.trim()
  const rucCompleto = /^\d{11}$/.test(ruc)
  const prefijoMal = rucCompleto && (f.tipo === 'ruc20' ? !ruc.startsWith('20') : !/^(10|15|17)/.test(ruc))
  const { ficha, buscando } = useFichaRuc(ruc, rucCompleto && !prefijoMal)
  useEffect(() => {
    if (!ficha) return
    const u = ficha.ubigeo ? buscarUbigeo(ficha.ubigeo) : null
    setF(v => ({ ...v, razonSocial: ficha.razonSocial ?? v.razonSocial, direccion: ficha.direccion ?? v.direccion, ...(u ?? {}) }))
  }, [ficha])
  const cambia = (k: keyof DatosMiEmpresa) => (e: React.ChangeEvent<HTMLInputElement>) => setF(v => ({ ...v, [k]: e.target.value }))

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    setErrorEnvio(undefined)
    if (prefijoMal) { mensaje.error(f.tipo === 'ruc20' ? 'Una empresa tiene RUC que empieza en 20.' : 'El RUC de persona natural empieza en 10.'); return }
    if (noActiva(ficha)) { mensaje.error(`SUNAT tiene este RUC ${ficha?.estado}: no puede emitir.`); return }
    setOcupado(true)
    try {
      const r = await miEmpresaServicio.registrar({ ...f, ruc })
      try { await miEmpresaServicio.confirmar() } catch { /* se confirma sola al volver a entrar */ }
      mensaje.bien(r.mensaje)
      await onHecho()
    } catch (err) {
      setErrorEnvio(err instanceof ErrorApi ? err.message : 'No se pudo registrar.')
    } finally { setOcupado(false) }
  }

  return (
    <form className="bloque mi-empresa-form" onSubmit={registrar}>
      {errorEnvio && <Aviso>{errorEnvio}</Aviso>}
      <h2>¿Cómo emites?</h2>
      <div className="elige-doc" role="radiogroup" aria-label="Tipo de contribuyente">
        {([['ruc10', 'Persona natural con negocio', 'RUC 10 · emites con tu nombre'], ['ruc20', 'Empresa', 'RUC 20 · emites con la razón social']] as const).map(([v, t, s]) => (
          <label key={v} className={f.tipo === v ? 'activo' : undefined}>
            <input type="radio" name="tipo" checked={f.tipo === v} onChange={() => setF(x => ({ ...x, tipo: v }))} />
            <strong>{t}</strong><span>{s}</span>
          </label>
        ))}
      </div>

      <Campo etiqueta={f.tipo === 'ruc10' ? 'Tu RUC (empieza en 10)' : 'RUC de la empresa (empieza en 20)'} obligatorio
             value={f.ruc} onChange={e => setF(v => ({ ...v, ruc: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" maxLength={11}
             placeholder={f.tipo === 'ruc10' ? '10XXXXXXXXX' : '20XXXXXXXXX'} mal={prefijoMal}
             pista={prefijoMal ? (f.tipo === 'ruc20' ? 'Ese RUC no empieza en 20: si es tu RUC personal, elige «Persona natural».' : 'Ese RUC no empieza en 10: si es de una empresa, elige «Empresa».')
               : buscando ? 'Buscando en SUNAT…' : ficha && !noActiva(ficha) ? '✓ Datos traídos de SUNAT. Revísalos.' : 'Se llenan solos los datos de SUNAT. No cambia después.'} />
      {noActiva(ficha) && <Aviso>Según SUNAT este RUC está <strong>{ficha?.estado}</strong>: no puede emitir.</Aviso>}
      {!noActiva(ficha) && noHabida(ficha) && <Aviso tono="ojo">SUNAT lo tiene como <strong>{ficha?.condicion}</strong>: sus comprobantes serán rechazados hasta que actualices tu domicilio fiscal.</Aviso>}

      <Campo etiqueta={f.tipo === 'ruc10' ? 'Tu nombre completo (como en la ficha RUC)' : 'Razón social'} obligatorio value={f.razonSocial} onChange={cambia('razonSocial')}
             pista="Es el nombre que sale en tus facturas y boletas." />
      <Campo etiqueta="Nombre comercial" value={f.nombreComercial} onChange={cambia('nombreComercial')}
             pista="Opcional. Por ejemplo «Reyban Consulting»." />

      <h2>Dirección fiscal</h2>
      <Aviso tono="ojo"><strong>Cópiala tal cual de tu ficha RUC.</strong> Sale en cada comprobante.</Aviso>
      <Campo etiqueta="Dirección" obligatorio value={f.direccion} onChange={cambia('direccion')} placeholder="AV. EJERCITO 123" />
      <SelectorUbigeo ubigeo={f.ubigeo} onCambio={u => setF(v => ({ ...v, ...u }))} />

      <p className="nota">Se registra en <strong>beta</strong> (prueba): nada va a SUNAT real hasta que lo decidas. Después subes el certificado y creas tus series.</p>
      <div className="acciones-bloque"><Boton type="submit" ocupado={ocupado} textoOcupado="Registrando…">Registrar mi empresa</Boton></div>
    </form>
  )
}

function DatosRegistrados({ d }: { d: MiEmpresa }) {
  const e = d.empresa!
  const dir = d.emisor?.direccion
  return (
    <div className="bloque reglas-planes form-mi-empresa">
      <GrupoRegla titulo="Tu empresa" texto="Registrada aquí y en el servicio de facturación. Los datos oficiales salen de tu ficha RUC.">
        <FilaRegla etiqueta="Tipo" ayuda="Cómo emites."><strong>{e.tipo === 'ruc10' ? 'Persona natural con negocio (RUC 10)' : 'Empresa (RUC 20)'}</strong></FilaRegla>
        <FilaRegla etiqueta="RUC" ayuda="No cambia."><strong>{e.ruc}</strong></FilaRegla>
        <FilaRegla etiqueta={e.tipo === 'ruc10' ? 'Nombre' : 'Razón social'} ayuda="Sale en tus comprobantes."><strong>{e.razonSocial}</strong></FilaRegla>
        {e.nombreComercial && <FilaRegla etiqueta="Nombre comercial" ayuda="El que conocen tus clientes.">{e.nombreComercial}</FilaRegla>}
        <FilaRegla etiqueta="Dirección fiscal" ayuda="La que sale en cada comprobante.">
          {dir ? <span>{dir.direccion} · {dir.distrito}, {dir.provincia}, {dir.departamento}</span> : '—'}
        </FilaRegla>
        <FilaRegla etiqueta="Ambiente" ayuda="Beta = prueba (no vale ante SUNAT). Real = producción.">
          <span className={`etiqueta ${e.ambiente === 'produccion' ? 'acento' : 'aviso'}`}>{e.ambiente === 'produccion' ? 'SUNAT real' : 'Beta (prueba)'}</span>
        </FilaRegla>
        <FilaRegla etiqueta="Registrada" ayuda="Cuándo se creó.">{fecha(e.creadaEn)}</FilaRegla>
      </GrupoRegla>
      <p className="pista">Para corregir un dato oficial (razón social, dirección), escríbelo igual que en tu ficha RUC en el panel del servicio de facturación, pestaña Marca.</p>
    </div>
  )
}

// =============================================================================
// 2. FACTURACIÓN ELECTRÓNICA
// =============================================================================
function Facturacion({ d, onHecho }: { d: MiEmpresa; onHecho: () => Promise<void> }) {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [clave, setClave] = useState('')
  const [solUsuario, setSolUsuario] = useState('')
  const [solClave, setSolClave] = useState('')
  const [correo, setCorreo] = useState(d.emisor?.portal?.correoRespuesta ?? '')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const beta = d.empresa?.ambiente !== 'produccion'

  async function hacer(clave_: string, f: () => Promise<unknown>, ok: string) {
    setOcupado(clave_)
    try { await f(); mensaje.bien(ok); await onHecho() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.') }
    finally { setOcupado(null) }
  }

  async function subirCertificado(confirmado = false): Promise<void> {
    if (!archivo) { mensaje.error('Elige el archivo .pfx de tu certificado.'); return }
    setOcupado('cert')
    try {
      const r = await miEmpresaServicio.certificado(archivo, clave, confirmado)
      mensaje.bien(r.mensaje ?? 'Certificado guardado.')
      setArchivo(null); setClave('')
      await onHecho()
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'ruc_no_coincide' && !confirmado) {
        setOcupado(null)
        if (await pedir({ titulo: 'El certificado es de otro RUC', mensaje: e.message, confirmar: 'Usarlo igual', tono: 'peligro' })) await subirCertificado(true)
        return
      }
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo subir el certificado.')
    } finally { setOcupado(null) }
  }

  const cert = d.credencial?.certificadoValidoHasta ?? d.emisor?.certificadoValidoHasta
  return (
    <div className="bloque reglas-planes sin-mayusculas form-mi-empresa">
      <GrupoRegla titulo="Certificado digital" texto="Con él se firma cada comprobante. Es el archivo .pfx (o .p12) que te dio la entidad certificadora, con su contraseña.">
        <FilaRegla etiqueta="Estado" ayuda="Lo que dice el servicio de facturación.">
          {d.pasos?.certificado ? <span className="pista bien">✓ Vigente hasta el {fecha(cert)}</span> : <span className="pista mal">✗ Falta el certificado</span>}
        </FilaRegla>
        <FilaRegla etiqueta="Archivo .pfx" ayuda="Se guarda cifrado: nadie lo puede leer ni descargar.">
          <input type="file" accept=".pfx,.p12" onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
        </FilaRegla>
        <FilaRegla etiqueta="Contraseña del certificado" ayuda="La que te dieron con el archivo.">
          <input type="password" autoComplete="new-password" value={clave} onChange={e => setClave(e.target.value)} />
        </FilaRegla>
        <div className="acciones-bloque">
          {beta && <Boton estilo="plano" ocupado={ocupado === 'prueba'} onClick={() => void hacer('prueba', () => miEmpresaServicio.certificadoPrueba(), 'Listo: usas un certificado de prueba (solo beta).')}>Usar uno de prueba (beta)</Boton>}
          <Boton ocupado={ocupado === 'cert'} onClick={() => void subirCertificado()}>Subir certificado</Boton>
        </div>
      </GrupoRegla>

      <GrupoRegla titulo="Usuario SOL secundario" texto="Para enviar a SUNAT real. Créalo en SUNAT Operaciones en Línea con el perfil de comprobantes electrónicos. En beta no hace falta.">
        <FilaRegla etiqueta="Estado" ayuda="Lo que dice el servicio.">
          {d.pasos?.sol ? <span className="pista bien">✓ Guardado</span> : <span className="pista">{beta ? 'Aún no (en beta no hace falta)' : '✗ Falta'}</span>}
        </FilaRegla>
        <FilaRegla etiqueta="Usuario" ayuda="El usuario secundario (sin el RUC delante).">
          <input autoComplete="off" value={solUsuario} onChange={e => setSolUsuario(e.target.value.toUpperCase())} />
        </FilaRegla>
        <FilaRegla etiqueta="Clave SOL" ayuda="Se guarda cifrada.">
          <input type="password" autoComplete="new-password" value={solClave} onChange={e => setSolClave(e.target.value)} />
        </FilaRegla>
        <div className="acciones-bloque">
          <Boton ocupado={ocupado === 'sol'} onClick={() => void hacer('sol', () => miEmpresaServicio.sol(solUsuario, solClave).then(() => { setSolClave('') }), 'Listo: usuario SOL guardado.')}>Guardar usuario SOL</Boton>
        </div>
      </GrupoRegla>

      <GrupoRegla titulo="Correo y logo" texto="El correo al que pueden responder tus clientes cuando les llega su comprobante, y el logo del PDF.">
        <FilaRegla etiqueta="Correo de respuesta" ayuda="Si un cliente responde el correo del comprobante, te llega aquí.">
          <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="facturacion@tuempresa.pe" />
        </FilaRegla>
        <div className="acciones-bloque">
          <Boton estilo="secundario" ocupado={ocupado === 'marca'} onClick={() => void hacer('marca', () => miEmpresaServicio.marca({
            identificador: d.emisor?.portal?.identificador ?? null, colorMarca: null, correoRespuesta: correo || null, copiaAlEmisor: true }), 'Listo: correo guardado.')}>Guardar correo</Boton>
        </div>
        <FilaRegla etiqueta="Logo" ayuda="PNG o JPG, máximo 1 MB. Sale en el PDF.">
          <input type="file" accept="image/png,image/jpeg" onChange={e => {
            const a = e.target.files?.[0]
            if (a) void hacer('logo', () => miEmpresaServicio.logo(a), 'Listo: logo guardado.')
          }} />
        </FilaRegla>
      </GrupoRegla>
      {dialogo}
    </div>
  )
}

// =============================================================================
// 3. SERIES
// =============================================================================
function Series({ d, onHecho }: { d: MiEmpresa; onHecho: () => Promise<void> }) {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [tipo, setTipo] = useState('01')
  const [serie, setSerie] = useState('F001')
  const [ultimo, setUltimo] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const series = d.series ?? []
  const sugerida: Record<string, string> = { '01': 'F001', '03': 'B001', '07': 'FC01', '08': 'FD01' }

  async function agregar(confirmado = false): Promise<void> {
    setOcupado(true)
    try {
      mensaje.bien((await miEmpresaServicio.serie(tipo, serie.trim().toUpperCase(), ultimo, confirmado)).mensaje ?? 'Serie agregada.')
      await onHecho()
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'confirmar_correlativo' && !confirmado) {
        setOcupado(false)
        if (await pedir({ titulo: 'Confirma el último número', mensaje: e.message, confirmar: 'Sí, es correcto' })) await agregar(true)
        return
      }
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo agregar la serie.')
    } finally { setOcupado(false) }
  }

  async function quitar(id: string, nombre: string) {
    if (!await pedir({ titulo: `¿Quitar la serie ${nombre}?`, mensaje: 'Solo se puede quitar una serie que nunca se usó.', confirmar: 'Quitar', tono: 'peligro' })) return
    try { mensaje.bien((await miEmpresaServicio.quitarSerie(id)).mensaje ?? 'Serie quitada.'); await onHecho() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo quitar.') }
  }

  return (
    <div className="bloque">
      <p className="secundario">Para cobrar los planes necesitas al menos <strong>F001</strong> (facturas, para clientes con RUC) y <strong>B001</strong> (boletas, para clientes con DNI). Las de notas de crédito (<strong>FC01</strong>, <strong>BC01</strong>) sirven si un día devuelves un pago.</p>
      {series.length === 0 ? <p className="secundario">Todavía no tienes series.</p> : (
        <table className="tabla compacta">
          <thead><tr><th>Tipo</th><th>Serie</th><th>Último número usado</th><th>Comprobantes</th><th /></tr></thead>
          <tbody>{series.map(s => (
            <tr key={s.id}><td>{NOMBRE_TIPO[s.tipoComprobante] ?? s.tipoComprobante}</td><td><strong>{s.serie}</strong></td>
              <td>{s.ultimoCorrelativo}</td><td>{s.comprobantes}</td>
              <td>{s.comprobantes === 0 && <button type="button" className="enlace" onClick={() => void quitar(s.id, s.serie)}>Quitar</button>}</td></tr>
          ))}</tbody>
        </table>
      )}
      <h3 className="subtitulo">Agregar una serie</h3>
      <div className="rejilla-datos serie-nueva">
        <label className="campo"><span>Tipo</span>
          <select value={tipo} onChange={e => { setTipo(e.target.value); setSerie(sugerida[e.target.value] ?? '') }}>
            <option value="01">Factura</option><option value="03">Boleta</option>
            <option value="07">Nota de crédito</option><option value="08">Nota de débito</option>
          </select></label>
        <label className="campo"><span>Serie</span><input maxLength={4} value={serie} onChange={e => setSerie(e.target.value.toUpperCase())} /></label>
        <label className="campo"><span>Último número que ya usaste</span>
          <input type="number" min={0} value={ultimo} onChange={e => setUltimo(Number(e.target.value))} />
          <small>0 si es nueva. Si vienes de otro sistema, el último número que emitiste con esa serie.</small></label>
      </div>
      <div className="acciones-bloque"><Boton ocupado={ocupado} onClick={() => void agregar()}>Agregar serie</Boton></div>
      {dialogo}
    </div>
  )
}

// =============================================================================
// 4. COMPROBANTES DE COBROS
// =============================================================================
function Comprobantes({ d, onHecho }: { d: MiEmpresa; onHecho: () => Promise<void> }) {
  const mensaje = useMensaje()
  const c = d.cobros!
  const [sf, setSf] = useState(c.serieFactura ?? '')
  const [sb, setSb] = useState(c.serieBoleta ?? '')
  const [enviar, setEnviar] = useState(c.enviarCorreo)
  const [desc, setDesc] = useState(c.descripcion)
  const [ocupado, setOcupado] = useState(false)
  const series = d.series ?? []
  const deTipo = (t: string) => series.filter(s => s.tipoComprobante === t && s.activo !== false)
  const ejemplo = desc.replace('{plan}', 'Pro').replace('{periodo}', 'diciembre 2026')

  async function guardar() {
    setOcupado(true)
    try { mensaje.bien((await miEmpresaServicio.comprobante({ serieFactura: sf || null, serieBoleta: sb || null, enviarCorreo: enviar, descripcion: desc })).mensaje); await onHecho() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar.') }
    finally { setOcupado(false) }
  }

  return (
    <div className="bloque reglas-planes sin-mayusculas form-mi-empresa">
      <GrupoRegla titulo="Con qué se emite" texto="Cuando un cliente paga su plan, el sistema emite solo, con tu empresa, una factura (si dio RUC) o una boleta (si dio DNI). Nadie la emite a mano.">
        <FilaRegla etiqueta="Serie de facturas" ayuda="Para los clientes que pagan con RUC (10 o 20).">
          <select value={sf} onChange={e => setSf(e.target.value)}>
            <option value="">— Elige —</option>{deTipo('01').map(s => <option key={s.id}>{s.serie}</option>)}
          </select>
        </FilaRegla>
        <FilaRegla etiqueta="Serie de boletas" ayuda="Para los clientes que pagan con DNI.">
          <select value={sb} onChange={e => setSb(e.target.value)}>
            <option value="">— Elige —</option>{deTipo('03').map(s => <option key={s.id}>{s.serie}</option>)}
          </select>
        </FilaRegla>
        {deTipo('01').length + deTipo('03').length === 0 && <p className="pista">Primero crea tus series en <Link to="/admin/mi-empresa/series">Series</Link>.</p>}
        <FilaRegla etiqueta="Enviar por correo" ayuda="El comprobante le llega al correo que dejó en «Mis pagos».">
          <label className="interruptor-chico"><input type="checkbox" checked={enviar} onChange={e => setEnviar(e.target.checked)} /><span>{enviar ? 'Sí' : 'No'}</span></label>
        </FilaRegla>
        <FilaRegla etiqueta="Descripción" ayuda={<>Lo que dice la línea del comprobante. <code>{'{plan}'}</code> se cambia por el plan y <code>{'{periodo}'}</code> por el mes. Así se verá: <strong>{ejemplo}</strong></>}>
          <input className="ancho" maxLength={120} value={desc} onChange={e => setDesc(e.target.value)} />
        </FilaRegla>
      </GrupoRegla>
      <div className="acciones-bloque"><Boton ocupado={ocupado} onClick={() => void guardar()}>Guardar</Boton></div>
      <Emitidos />
    </div>
  )
}

// 076: LOS QUE YA SALIERON. Los emite el sistema solo (unos minutos después de
// cada pago); aquí solo se miran y, si uno falló, se pide otra vez.
const ESTADO_COMP: Record<ComprobanteCobro['estado'], [string, string]> = {
  pendiente: ['Por emitir', 'aviso'], emitido: ['Emitido', 'acento'], error: ['No salió', 'peligro'],
  rechazado: ['Rechazado por SUNAT', 'peligro'], no_aplica: ['Sin comprobante', ''],
}

function Emitidos() {
  const mensaje = useMensaje()
  const [lista, setLista] = useState<ComprobanteCobro[] | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const cargar = useCallback(async () => {
    try { setLista(await miEmpresaServicio.comprobantes()) }
    catch (e) { setLista([]); mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo leer la lista.') }
  }, [mensaje])
  useEffect(() => { void cargar() }, [cargar])

  async function reintentar(id: string) {
    setOcupado(id)
    try { mensaje.bien((await miEmpresaServicio.reintentar(id)).mensaje); await cargar() }
    catch (e) { mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo pedir otra vez.') }
    finally { setOcupado(null) }
  }

  return (
    <GrupoRegla titulo="Comprobantes emitidos" texto="Cada pago de un plan genera su factura o boleta, sola, a los pocos minutos. Si una no sale (por ejemplo, falta la serie o el servicio no respondió), el sistema lo reintenta; también puedes pedirlo tú.">
      {lista === null ? <Cargando /> : lista.length === 0 ? <p className="pista">Todavía no hay pagos con comprobante.</p> : (
        <div className="tabla-desliza">
          <table className="tabla compacta comprobantes-cobros">
            <thead><tr><th>Pago</th><th>Cliente</th><th>Monto</th><th>Comprobante</th><th>Estado</th><th /></tr></thead>
            <tbody>{lista.map(c => {
              const [texto, tono] = ESTADO_COMP[c.estado] ?? [c.estado, '']
              return (
                <tr key={c.id}>
                  <td>{c.numero ?? '—'}<div className="secundario">{fecha(c.fecha)}{c.modo !== 'real' && c.modo !== 'manual' ? ' · prueba' : ''}</div></td>
                  <td>{c.comprador ?? '—'}<div className="secundario">{c.documento ?? ''}</div></td>
                  <td>{soles(c.monto)}</td>
                  <td>{c.comprobante ? <strong>{c.comprobante}</strong> : '—'}{c.sunat && <div className="secundario">SUNAT: {c.sunat}</div>}</td>
                  <td><span className={'etiqueta ' + tono}>{texto}</span>
                    {c.error && <div className="secundario">{c.error}</div>}
                    {c.estado === 'error' && <div className="secundario">{c.intentos} intento{c.intentos === 1 ? '' : 's'}</div>}</td>
                  <td>{(c.estado === 'error' || (c.estado === 'pendiente' && c.intentos > 0)) && (
                    <Boton estilo="secundario" ocupado={ocupado === c.id} onClick={() => void reintentar(c.id)}>Reintentar</Boton>)}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
    </GrupoRegla>
  )
}