import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Asterisco } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fecha } from '../../../nucleo/formato/fechas'
import { SelectorUbigeo } from '../../../nucleo/ubigeo/SelectorUbigeo'
import { BuscadorCliente } from '../../facturacion/componentes/BuscadorCliente'
import { BuscadorComprobante } from '../../facturacion/componentes/BuscadorComprobante'
import { BuscadorProducto } from '../../facturacion/componentes/BuscadorProducto'
import { consultasServicio } from '../../facturacion/servicios/facturacionServicio'
import type { ClienteEnLista } from '../../facturacion/tipos'
import {
  ENTIDADES, UNIDADES, guiasServicio, nombreUnidad, nuevaClave,
  type ConductorPeticion, type ContextoGuia, type Despacho, type DocumentoRelacionado, type PersonaDelPersonal,
  type PeticionGuia, type Transporte,
} from '../servicios/guiasServicio'
import '../guias.css'

/**
 * 050 — NUEVA GUÍA DE REMISIÓN (maquetas «Nueva», «Transportista» y
 * «Factura con su guía» del 24 oct).
 *
 *   /guias/nueva                  guía del remitente (09), suelta
 *   /guias/nueva?desde={id}       desde una factura o boleta: trae el cliente y
 *                                 lo que FALTA despachar (despacho en partes)
 *   /guias/transportista          guía del transportista (31)
 *   …?copiar={id}                 24 oct: «Corregir y emitir otra»: los datos de
 *                                 una guía rechazada o que no llegó, para corregir
 *                                 y emitir con número nuevo
 *
 * Se emite directo (no hay borrador). La clave nace al abrir la pantalla: dos
 * clics en «Emitir» son la misma guía. El transporte que se escriba se guarda
 * solo para la próxima.
 */

interface Bien {
  clave: string
  descripcion: string
  unidad: string
  cantidad: string
  codigo?: string | null
  productoId?: string | null
  documentoLineaId?: string | null
  pendiente?: number
}

interface Conductor {
  tipoDocumento: string
  numeroDocumento: string
  nombres: string
  apellidos: string
  licencia: string
  usuarioId?: string | null
}

const CONDUCTOR_VACIO: Conductor = { tipoDocumento: '1', numeroDocumento: '', nombres: '', apellidos: '', licencia: '' }
const hoyLima = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10)
const numero = (s: string) => Number(s.replace(',', '.')) || 0
let contador = 0
const claveFila = () => `b${++contador}`

export function NuevaGuia({ tipo }: { tipo: '09' | '31' }) {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const desdeParam = tipo === '09' ? params.get('desde') : null
  const copiarId = params.get('copiar')   // 24 oct

  const [ctx, setCtx] = useState<ContextoGuia>()
  const [despacho, setDespacho] = useState<Despacho>()
  const [transporte, setTransporte] = useState<Transporte>()
  const [personal, setPersonal] = useState<PersonaDelPersonal[]>([])
  const [error, setError] = useState<string>()

  // --- 1. salida ---------------------------------------------------------------
  const [sucursalId, setSucursalId] = useState('')
  const [serie, setSerie] = useState('')
  const [fechaTraslado, setFechaTraslado] = useState(hoyLima())
  // 052: «Trasladar» desde Inventario abre la guía con motivo 04.
  const [motivo, setMotivo] = useState(() => tipo === '09' && params.get('motivo') === '04' ? '04' : '01')
  const [motivoDescripcion, setMotivoDescripcion] = useState('')

  // --- 2. destinatario y recorrido ------------------------------------------------
  const [cliente, setCliente] = useState<ClienteEnLista>()
  const [destTipo, setDestTipo] = useState('6')
  const [destDoc, setDestDoc] = useState('')
  const [destNombre, setDestNombre] = useState('')
  const [partidaDir, setPartidaDir] = useState('')
  const [partidaUbigeo, setPartidaUbigeo] = useState('')
  const [llegadaDir, setLlegadaDir] = useState('')
  const [llegadaUbigeo, setLlegadaUbigeo] = useState('')
  const [llegadaLocal, setLlegadaLocal] = useState('')   // motivo 04

  // --- 3. transporte ---------------------------------------------------------------
  const [modalidad, setModalidad] = useState<'01' | '02'>('02')
  const [menor, setMenor] = useState(false)
  const [placa, setPlaca] = useState('')
  const [vehDescripcion, setVehDescripcion] = useState('')
  const [tuc, setTuc] = useState('')
  const [autorizacion, setAutorizacion] = useState('')
  const [entidad, setEntidad] = useState('')
  const [conductor, setConductor] = useState<Conductor>(CONDUCTOR_VACIO)
  const [relevo, setRelevo] = useState<Conductor>()
  const [transRuc, setTransRuc] = useState('')
  const [transNombre, setTransNombre] = useState('')
  const [transMtc, setTransMtc] = useState('')
  const [entrega, setEntrega] = useState('')

  // --- 31 ---------------------------------------------------------------------------
  const [remRuc, setRemRuc] = useState('')
  const [remNombre, setRemNombre] = useState('')
  const [guiaRemitente, setGuiaRemitente] = useState('')
  const [pagaTercero, setPagaTercero] = useState(false)
  const [pagRuc, setPagRuc] = useState('')
  const [pagNombre, setPagNombre] = useState('')
  const [subcontrato, setSubcontrato] = useState(false)
  const [subRuc, setSubRuc] = useState('')
  const [subNombre, setSubNombre] = useState('')

  // --- 4. carga -------------------------------------------------------------------
  const [bienes, setBienes] = useState<Bien[]>([])
  const [peso, setPeso] = useState('')
  const [bultos, setBultos] = useState('')
  const [observaciones, setObservaciones] = useState('')
  // 24 oct: lo que pedían los manuales de SOL.
  const [unidadPeso, setUnidadPeso] = useState<'KGM' | 'TNE'>('KGM')
  const [transbordo, setTransbordo] = useState(false)
  const [retorno, setRetorno] = useState<'' | 'vacio' | 'envases'>('')
  const [documentos, setDocumentos] = useState<DocumentoRelacionado[]>([])
  const [copiada, setCopiada] = useState<string>()

  const [emitiendo, setEmitiendo] = useState(false)
  const [fallo, setFallo] = useState<string>()
  const clave = useRef(nuevaClave())

  // ---------------------------------------------------------------------- carga
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [c, t] = await Promise.all([guiasServicio.contexto(), guiasServicio.transporte()])
        if (!vivo) return
        setCtx(c); setTransporte(t)
        guiasServicio.personal().then(p => { if (vivo) setPersonal(p) }).catch(() => { /* sin personal: se escribe */ })

        // 24 oct: «Corregir y emitir otra»: los datos de la guía que no salió.
        const copia = copiarId ? await guiasServicio.ver(copiarId) : undefined
        if (!vivo) return
        const p = copia?.peticion ?? undefined
        const desdeId = desdeParam ?? (tipo === '09' ? p?.documentoId : null) ?? null

        let d: Despacho | undefined
        // 24 oct: «Quitar (guía sin comprobante)»: deja de salir de la factura.
        if (!desdeId) { setDespacho(undefined); setCliente(undefined) }
        if (desdeId) {
          d = await guiasServicio.desde(desdeId)
          if (!vivo) return
          setDespacho(d)
          if (d.cliente && !p) {
            setDestTipo(d.cliente.tipoDocumento); setDestDoc(d.cliente.numeroDocumento); setDestNombre(d.cliente.razonSocial)
            setLlegadaDir(d.cliente.direccion ?? ''); setLlegadaUbigeo(d.cliente.ubigeo ?? '')
          }
          setBienes(d.lineas.filter(l => !l.esServicio && l.pendiente > 0).map(l => ({
            clave: claveFila(), descripcion: l.descripcion, unidad: l.unidad, cantidad: String(l.pendiente),
            codigo: l.codigo, productoId: l.productoId, documentoLineaId: l.id, pendiente: l.pendiente,
          })))
        } else setBienes([{ clave: claveFila(), descripcion: '', unidad: 'NIU', cantidad: '1' }])

        // La sucursal: la del comprobante, o la primera en la que puede emitir.
        const local = c.sucursales.find(s => s.id === d?.sucursalId) ?? c.sucursales[0]
        if (local) elegirLocal(local.id, c)

        if (copia && p) {
          aplicarCopia(p, d)
          setCopiada(copia.numero ?? copia.serie)
        }
      } catch (e) {
        if (vivo) setError(e instanceof ErrorApi ? e.message : 'No se pudo preparar la guía.')
      }
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desdeParam, copiarId, tipo])

  /** 24 oct: pone en la pantalla lo que se mandó en la guía que se corrige. */
  function aplicarCopia(p: NonNullable<Awaited<ReturnType<typeof guiasServicio.ver>>['peticion']>, d: Despacho | undefined) {
    if (p.fechaTraslado && p.fechaTraslado >= hoyLima()) setFechaTraslado(p.fechaTraslado)
    if (p.motivo) setMotivo(p.motivo)
    setMotivoDescripcion(p.motivoDescripcion ?? '')
    if (p.modalidad) setModalidad(p.modalidad)
    if (p.destinatario) {
      setDestTipo(p.destinatario.tipoDocumento ?? '6'); setDestDoc(p.destinatario.numeroDocumento ?? ''); setDestNombre(p.destinatario.razonSocial ?? '')
    }
    setPartidaDir(p.partida?.direccion ?? ''); setPartidaUbigeo(p.partida?.ubigeo ?? '')
    setLlegadaDir(p.llegada?.direccion ?? ''); setLlegadaUbigeo(p.llegada?.ubigeo ?? '')
    setMenor(!!p.vehiculoMenor)
    setPlaca((p.vehiculo?.placa ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)); setVehDescripcion(p.vehiculo?.descripcion ?? ''); setTuc(p.vehiculo?.tuc ?? '')
    setAutorizacion(p.vehiculo?.autorizacion ?? ''); setEntidad(p.vehiculo?.entidad ?? '')
    if (p.conductor) setConductor({ ...CONDUCTOR_VACIO, ...p.conductor })
    if (p.relevos?.[0]) setRelevo({ ...CONDUCTOR_VACIO, ...p.relevos[0] })
    setTransRuc(p.transportista?.ruc ?? ''); setTransNombre(p.transportista?.razonSocial ?? ''); setTransMtc(p.transportista?.mtc ?? '')
    setRemRuc(p.remitente?.numeroDocumento ?? ''); setRemNombre(p.remitente?.razonSocial ?? '')
    setGuiaRemitente(p.guiaRemitente ?? '')
    setPagaTercero(!!p.pagadorFlete); setPagRuc(p.pagadorFlete?.numeroDocumento ?? ''); setPagNombre(p.pagadorFlete?.razonSocial ?? '')
    setSubcontrato(!!p.subcontratista); setSubRuc(p.subcontratista?.ruc ?? ''); setSubNombre(p.subcontratista?.razonSocial ?? '')
    setPeso(p.pesoBruto ? String(p.pesoBruto) : ''); setBultos(p.bultos ? String(p.bultos) : '')
    setObservaciones(p.observaciones ?? '')
    setUnidadPeso(p.unidadPeso === 'TNE' ? 'TNE' : 'KGM')
    setTransbordo(!!p.transbordoProgramado)
    setRetorno(p.retornoVacio ? 'vacio' : p.retornoConEnvases ? 'envases' : '')
    setDocumentos(p.documentos ?? [])
    // Los bienes: los mismos; si salen de un comprobante, con lo que falta hoy.
    setBienes((p.bienes ?? []).map(b => {
      const linea = d?.lineas.find(l => l.id === b.documentoLineaId)
      return {
        clave: claveFila(), descripcion: b.descripcion, unidad: b.unidad, cantidad: String(b.cantidad),
        codigo: b.codigo, productoId: b.productoId, documentoLineaId: linea ? b.documentoLineaId : null,
        pendiente: linea?.pendiente,
      }
    }))
  }

  function elegirLocal(id: string, c: ContextoGuia | undefined = ctx) {
    const s = c?.sucursales.find(x => x.id === id)
    if (!s) return
    setSucursalId(id)
    const series = tipo === '09' ? s.series09 : s.series31
    setSerie(series[0]?.serie ?? (tipo === '09' ? s.nueva09 : s.nueva31) ?? '')
    if (tipo === '09') { setPartidaDir(s.direccion ?? ''); setPartidaUbigeo(s.ubigeo ?? '') }
  }

  const local = ctx?.sucursales.find(s => s.id === sucursalId)
  const seriesLocal = local ? (tipo === '09' ? local.series09 : local.series31) : []
  const nuevaLocal = local ? (tipo === '09' ? local.nueva09 : local.nueva31) : null
  const otrosLocales = ctx?.sucursales.filter(s => s.id !== sucursalId) ?? []
  const entreLocales = tipo === '09' && motivo === '04'
  const publico = tipo === '09' && modalidad === '01'
  const conVehiculo = tipo === '31' || (!publico && !menor)

  // Motivo 04: el destinatario es la propia empresa y la llegada, otro local.
  useEffect(() => {
    if (!entreLocales || !ctx) return
    setDestTipo('6'); setDestDoc(ctx.empresa.ruc ?? ''); setDestNombre(ctx.empresa.razonSocial)
    setCliente(undefined)
  }, [entreLocales, ctx])

  function elegirLlegadaLocal(id: string) {
    setLlegadaLocal(id)
    const s = ctx?.sucursales.find(x => x.id === id)
    if (s) { setLlegadaDir(s.direccion ?? ''); setLlegadaUbigeo(s.ubigeo ?? '') }
  }

  function elegirCliente(c: ClienteEnLista) {
    setCliente(c)
    setDestTipo(c.tipoDocumento); setDestDoc(c.numeroDocumento); setDestNombre(c.razonSocial)
    if (c.direccion) setLlegadaDir(c.direccion)
    if (c.ubigeo) setLlegadaUbigeo(c.ubigeo)
  }

  // --- transporte guardado: al escribir una placa o un RUC conocido, se completa ---
  function cambiarPlaca(v: string) {
    const p = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    setPlaca(p)
    const g = transporte?.vehiculos.find(x => x.activo && x.placa === p)
    if (g) {
      setVehDescripcion(g.descripcion ?? ''); setTuc(g.tuc ?? '')
      setAutorizacion(g.autorizacion ?? ''); setEntidad(g.entidad ?? '')
    }
  }

  function elegirConductor(valor: string, poner: (c: Conductor) => void) {
    if (!valor) return
    const [de, id] = valor.split(':')
    if (de === 'g') {
      const k = transporte?.conductores.find(x => x.id === id)
      if (k) poner({ tipoDocumento: k.tipoDoc, numeroDocumento: k.numeroDoc, nombres: k.nombres, apellidos: k.apellidos, licencia: k.licencia, usuarioId: k.usuarioId })
    } else if (de === 'p') {
      const u = personal.find(x => x.usuarioId === id)
      const guardado = transporte?.conductores.find(x => x.numeroDoc === u?.numeroDoc)
      if (u) poner({ tipoDocumento: u.tipoDoc, numeroDocumento: u.numeroDoc, nombres: u.nombres, apellidos: u.apellidos, licencia: guardado?.licencia ?? '', usuarioId: u.usuarioId })
    }
  }

  function cambiarRuc(v: string, poner: (n: string) => void, mtc?: (m: string) => void) {
    const r = v.replace(/\D/g, '').slice(0, 11)
    return {
      r,
      completar: () => {
        if (r.length !== 11) return
        const t = transporte?.transportistas.find(x => x.ruc === r)
        if (t) { poner(t.razonSocial); if (mtc && t.mtc) mtc(t.mtc); return }
        consultasServicio.ruc(r).then(d => { if (d.razonSocial) poner(d.razonSocial) }).catch(() => { /* se escribe a mano */ })
      },
    }
  }

  // --- bienes ---------------------------------------------------------------------
  const cambiarBien = (k: string, cambio: Partial<Bien>) =>
    setBienes(bs => bs.map(b => b.clave === k ? { ...b, ...cambio } : b))
  const quitarBien = (k: string) => setBienes(bs => bs.filter(b => b.clave !== k))
  const agregarBien = () => setBienes(bs => [...bs, { clave: claveFila(), descripcion: '', unidad: 'NIU', cantidad: '1' }])

  const sinDespachar = useMemo(() => {
    if (!despacho) return []
    const puestos = new Set(bienes.map(b => b.documentoLineaId).filter(Boolean))
    return despacho.lineas.filter(l => !l.esServicio && l.pendiente > 0 && !puestos.has(l.id))
  }, [despacho, bienes])

  // ---------------------------------------------------------------------- emitir
  function armar(): PeticionGuia {
    const c = (x: Conductor): ConductorPeticion => ({ ...x, licencia: x.licencia.toUpperCase() })
    return {
      clave: clave.current,
      tipo,
      serie,
      fechaTraslado,
      motivo: tipo === '09' ? motivo : undefined,
      motivoDescripcion: motivo === '13' ? motivoDescripcion : undefined,
      modalidad: tipo === '09' ? modalidad : undefined,
      destinatario: { tipoDocumento: destTipo, numeroDocumento: destDoc.trim(), razonSocial: destNombre.trim() },
      clienteId: cliente?.id ?? despacho?.cliente?.id ?? null,
      partida: { direccion: partidaDir, ubigeo: partidaUbigeo, codigoEstablecimiento: entreLocales ? local?.codigo : null },
      llegada: {
        direccion: llegadaDir, ubigeo: llegadaUbigeo,
        codigoEstablecimiento: entreLocales ? ctx?.sucursales.find(s => s.id === llegadaLocal)?.codigo : null,
      },
      pesoBruto: numero(peso),
      bultos: bultos ? Math.round(numero(bultos)) : null,
      bienes: bienes.map(b => ({
        descripcion: b.descripcion, unidad: b.unidad, cantidad: numero(b.cantidad),
        codigo: b.codigo, productoId: b.productoId, documentoLineaId: b.documentoLineaId,
      })),
      vehiculo: conVehiculo ? { placa, descripcion: vehDescripcion, tuc, autorizacion, entidad } : null,
      conductor: conVehiculo ? c(conductor) : null,
      relevos: conVehiculo && relevo ? [c(relevo)] : [],
      transportista: publico ? { ruc: transRuc, razonSocial: transNombre, mtc: transMtc } : null,
      entregaAlTransportista: publico && entrega ? entrega : null,
      vehiculoMenor: tipo === '09' && !publico && menor,
      documentoId: despacho?.id ?? null,
      observaciones: observaciones.trim() || undefined,
      remitente: tipo === '31' ? { tipoDocumento: '6', numeroDocumento: remRuc, razonSocial: remNombre } : null,
      guiaRemitente: tipo === '31' ? guiaRemitente.trim().toUpperCase() : undefined,
      pagadorFlete: tipo === '31' && pagaTercero ? { tipoDocumento: '6', numeroDocumento: pagRuc, razonSocial: pagNombre } : null,
      subcontratista: tipo === '31' && subcontrato ? { ruc: subRuc, razonSocial: subNombre } : null,
      unidadPeso,
      transbordoProgramado: transbordo,
      retornoVacio: retorno === 'vacio',
      retornoConEnvases: retorno === 'envases',
      documentos: documentos.filter(x => x.numero.trim()).map(x => ({ tipo: x.tipo, numero: x.numero.trim(), ruc: x.ruc?.trim() || undefined })),
    }
  }

  async function emitir() {
    setEmitiendo(true); setFallo(undefined)
    try {
      const r = await guiasServicio.emitir(armar())
      navegar(`/guias/${r.id}`, { state: { reciente: r.mensaje } })
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo emitir la guía.')
    } finally {
      setEmitiendo(false)
    }
  }

  if (error) return <Aviso>{error}</Aviso>
  if (!ctx || !transporte) return <Cargando />

  if (tipo === '31' && !ctx.empresa.transportaCarga) {
    return (
      <>
        <h1 className="titulo-pagina">Guía del transportista</h1>
        <Aviso tono="ojo">
          La guía del transportista es para empresas que llevan carga de otros por encargo (con registro MTC).
          Si es tu caso, actívalo en <strong>Guías de remisión › Configuración</strong>.
        </Aviso>
        <Boton estilo="secundario" onClick={() => navegar('/guias')}>Volver</Boton>
      </>
    )
  }

  if (ctx.sucursales.length === 0) {
    return <Aviso>No trabajas en ninguna sucursal activa: no puedes emitir guías. Pide al administrador que te asigne una.</Aviso>
  }

  const campoSerie = (<div className="campo">
        <label>Serie<Asterisco /></label>
        <select value={serie} onChange={e => setSerie(e.target.value)}>
          {seriesLocal.map(s => <option key={s.serie} value={s.serie}>{s.serie} · sigue {s.siguiente.split('-')[1]?.replace(/^0+/, '')}</option>)}
          {nuevaLocal && <option value={nuevaLocal}>{nuevaLocal} (nueva: se crea al emitir)</option>}
        </select>
        {seriesLocal.length === 0 && nuevaLocal && <span className="pista">Tu primera guía{tipo === '31' ? ' del transportista' : ''}: la serie {nuevaLocal} se crea sola.</span>}
      </div>
  )

  const titulo = tipo === '31'
    ? 'Guía del transportista'
    : despacho ? `Guía de remisión de ${despacho.numero}` : 'Nueva guía de remisión'

  return (
    <div className="guia-form">
      <div className="encabezado-pagina">
        <div>
          <h1 className="titulo-pagina">{titulo}</h1>
          <p className="secundario">
            {tipo === '31'
              ? 'Para quien lleva carga ajena por encargo. Ampara la guía que emitió el dueño de la carga: van las dos, y las dos aceptadas antes de salir.'
              : 'La guía se emite ANTES del traslado. El vehículo sale cuando SUNAT la acepta (unos segundos).'}
            {ctx.empresa.ambiente === 'beta' && <> <span className="etiqueta aviso">prueba</span></>}
          </p>
        </div>
        {ctx.empresa.transportaCarga && !despacho && (
          <div className="segmentado" role="tablist" aria-label="Tipo de guía">
            <button type="button" className={tipo === '09' ? 'elegido' : ''} onClick={() => navegar('/guias/nueva')}>Remitente (09)</button>
            <button type="button" className={tipo === '31' ? 'elegido' : ''} onClick={() => navegar('/guias/transportista')}>Transportista (31)</button>
          </div>
        )}
      </div>

      {copiada && (
        <Aviso tono="ojo">
          Con los datos de la guía <span className="mono">{copiada}</span>, que no salió. Corrige lo que haga falta y emite: sale con número nuevo.
        </Aviso>
      )}
      {despacho && !despacho.puede && <Aviso>{despacho.problema}</Aviso>}
      {despacho && despacho.guias.length > 0 && (
        <Aviso tono="ojo">
          Este comprobante ya tiene {despacho.guias.length === 1 ? 'una guía' : `${despacho.guias.length} guías`}{' '}
          ({despacho.guias.map(g => g.numero).join(', ')}). Aquí sale solo lo que falta despachar.
        </Aviso>
      )}

      {/* --- 1 ----------------------------------------------------------------- */}
      {tipo === '31' ? (
        <section className="bloque">
          <h2 className="subtitulo">1 · Quién te contrató y su guía</h2>
          <div className="rejilla-4">
            <Texto etiqueta="RUC del remitente" obligatorio value={remRuc} inputMode="numeric" pista="11 dígitos."
                   onChange={v => { const x = cambiarRuc(v, setRemNombre); setRemRuc(x.r) }}
                   onBlur={() => cambiarRuc(remRuc, setRemNombre).completar()} />
            <Texto etiqueta="Razón social" obligatorio value={remNombre} onChange={setRemNombre} ancho={2} />
            <Texto etiqueta="Su guía (09)" obligatorio={!transbordo} value={guiaRemitente} mono placeholder="T001-00000453"
                   pista={transbordo ? 'En un transbordo programado puede ir sin ella.' : 'Serie (T y 3 números), guion y número. Ej.: T001-453.'}
                   onChange={v => setGuiaRemitente(v.toUpperCase())} />
          </div>
          <div className="rejilla-4">
            {campoSerie}
            <Texto etiqueta="Fecha de traslado" obligatorio type="date" value={fechaTraslado} onChange={setFechaTraslado} min={ctx.hoy} />
            <div className="campo ancho-2">
              <label>¿Quién paga el flete?</label>
              <select value={pagaTercero ? 't' : 'r'} onChange={e => setPagaTercero(e.target.value === 't')}>
                <option value="r">El remitente</option>
                <option value="t">Un tercero (indicar RUC)</option>
              </select>
            </div>
          </div>
          {pagaTercero && (
            <div className="rejilla-4">
              <Texto etiqueta="RUC de quien paga" obligatorio value={pagRuc} inputMode="numeric" pista="11 dígitos."
                     onChange={v => setPagRuc(cambiarRuc(v, setPagNombre).r)} onBlur={() => cambiarRuc(pagRuc, setPagNombre).completar()} />
              <Texto etiqueta="Razón social" obligatorio value={pagNombre} onChange={setPagNombre} ancho={3} />
            </div>
          )}
          <p className="nota se-aplica">
            Se aplica: la guía del transportista se relaciona con la <strong>guía del remitente</strong> (arriba), no con una factura tuya:
            la factura de esta carga es del remitente. Si quieres que figure, agrégala abajo en «Documentos relacionados» con su RUC.
          </p>
        </section>
      ) : (
        <section className="bloque">
          <h2 className="subtitulo">1 · Desde dónde y por qué</h2>
          {/* 24 oct: relacionarla con su factura o boleta desde aquí también. */}
          {despacho ? (
            <p className="secundario">
              Sale de <strong className="mono">{despacho.numero}</strong>: va relacionada con ese comprobante.{' '}
              <Boton estilo="plano" onClick={() => navegar('/guias/nueva')}>Quitar (guía sin comprobante)</Boton>
            </p>
          ) : (
            <div className="campo">
              <label>¿Sale de una factura o boleta?</label>
              <BuscadorComprobante buscar={guiasServicio.buscarComprobante} series={guiasServicio.seriesComprobante}
                                   onElegir={id => navegar(`/guias/nueva?desde=${id}`)} />
              <span className="pista">
                Elígela y trae el cliente y lo que falta despachar, y la guía queda relacionada con ella. Si no sale de una
                (traslado entre tus locales, consignación…), déjalo vacío.
              </span>
            </div>
          )}
          <div className="rejilla-4">
            <div className="campo">
              <label>Sucursal de partida<Asterisco /></label>
              <select value={sucursalId} onChange={e => elegirLocal(e.target.value)}>
                {ctx.sucursales.map(s => <option key={s.id} value={s.id}>{s.codigo} {s.nombre}</option>)}
              </select>
            </div>
            {campoSerie}
            <Texto etiqueta="Fecha de traslado" obligatorio type="date" value={fechaTraslado} onChange={setFechaTraslado} min={ctx.hoy}
                   pista="Hoy o un día próximo." />
            <div className="campo">
              <label>Motivo<Asterisco /></label>
              <select value={motivo} onChange={e => setMotivo(e.target.value)}>
                {ctx.motivos.map(m => <option key={m.codigo} value={m.codigo}>{m.nombre}</option>)}
              </select>
            </div>
          </div>
          {motivo === '13' && (
            <Texto etiqueta="¿Cuál es el motivo?" obligatorio value={motivoDescripcion} onChange={setMotivoDescripcion} maxLength={100} />
          )}
        </section>
      )}

      {/* --- 2 ----------------------------------------------------------------- */}
      <section className="bloque">
        <h2 className="subtitulo">2 · Destinatario y recorrido</h2>

        {entreLocales ? (
          <p className="secundario">Entre tus locales: el destinatario eres tú mismo ({ctx.empresa.razonSocial}, RUC {ctx.empresa.ruc}).</p>
        ) : despacho?.cliente ? (
          <p className="secundario">
            <strong>{despacho.cliente.razonSocial}</strong> · {despacho.cliente.tipoDocumento === '6' ? 'RUC' : 'Doc.'} {despacho.cliente.numeroDocumento} · el cliente de {despacho.numero}
          </p>
        ) : (
          <>
            {tipo === '09' && (
              <div className="campo">
                <label>Buscar entre tus clientes</label>
                <BuscadorCliente elegido={cliente} onElegir={elegirCliente} />
              </div>
            )}
            <div className="rejilla-4">
              <div className="campo">
                <label>Documento<Asterisco /></label>
                <select value={destTipo} onChange={e => setDestTipo(e.target.value)}>
                  <option value="6">RUC</option><option value="1">DNI</option><option value="4">Carné de extranjería</option>
                  <option value="7">Pasaporte</option>
                </select>
              </div>
              <Texto etiqueta="Número" obligatorio value={destDoc} onChange={v => { setDestDoc(v.trim()); setCliente(undefined) }}
                     pista={destTipo === '6' ? 'RUC: 11 dígitos.' : destTipo === '1' ? 'DNI: 8 dígitos.' : 'Como figura en el documento.'}
                     onBlur={() => { if (destTipo === '6' && destDoc.length === 11 && !destNombre) consultasServicio.ruc(destDoc).then(d => { if (d.razonSocial) setDestNombre(d.razonSocial); if (d.direccion && !llegadaDir) setLlegadaDir(d.direccion); if (d.ubigeo && !llegadaUbigeo) setLlegadaUbigeo(d.ubigeo) }).catch(() => {}) }} />
              <Texto etiqueta="Nombre o razón social" obligatorio value={destNombre} onChange={setDestNombre} ancho={2} />
            </div>
          </>
        )}

        <div className="recorrido">
          <div>
            <h3 className="rotulo">Partida{tipo === '31' ? ' (donde recoges)' : ''}</h3>
            <Texto etiqueta="Dirección" obligatorio value={partidaDir} onChange={setPartidaDir} maxLength={200}
                   pista="Calle y número (5 a 200 caracteres). El distrito va abajo." />
            <SelectorUbigeo ubigeo={partidaUbigeo} onCambio={u => setPartidaUbigeo(u.ubigeo)} />
          </div>
          <div>
            <h3 className="rotulo">Llegada{tipo === '31' ? ' (donde entregas)' : ''}</h3>
            {entreLocales && (
              <div className="campo">
                <label>Local de llegada<Asterisco /></label>
                <select value={llegadaLocal} onChange={e => elegirLlegadaLocal(e.target.value)}>
                  <option value="">Elige…</option>
                  {otrosLocales.map(s => <option key={s.id} value={s.id}>{s.codigo} {s.nombre}</option>)}
                </select>
                {otrosLocales.length === 0 && <span className="pista mal">Solo trabajas en un local: para trasladar entre locales hace falta otra sucursal.</span>}
              </div>
            )}
            <Texto etiqueta="Dirección" obligatorio value={llegadaDir} onChange={setLlegadaDir} maxLength={200}
                   pista="Calle y número (5 a 200 caracteres). El distrito va abajo." />
            <SelectorUbigeo ubigeo={llegadaUbigeo} onCambio={u => setLlegadaUbigeo(u.ubigeo)} />
          </div>
        </div>
      </section>

      {/* --- 3 ----------------------------------------------------------------- */}
      <section className="bloque">
        <h2 className="subtitulo">3 · {tipo === '31' ? 'Tu vehículo y tu conductor' : 'Quién lo lleva'}</h2>

        {tipo === '09' && (
          <div className="segmentado" role="tablist" aria-label="Quién lleva la carga">
            <button type="button" className={modalidad === '02' ? 'elegido' : ''} onClick={() => setModalidad('02')}>Mi vehículo (privado)</button>
            <button type="button" className={modalidad === '01' ? 'elegido' : ''} onClick={() => setModalidad('01')}>Una empresa de transporte (público)</button>
          </div>
        )}

        {publico ? (
          <>
            <div className="rejilla-4">
              <Texto etiqueta="RUC de la empresa de transporte" obligatorio value={transRuc} inputMode="numeric" lista="transportistas-guardados"
                     pista="11 dígitos. Su razón social se completa sola."
                     onChange={v => setTransRuc(cambiarRuc(v, setTransNombre, setTransMtc).r)}
                     onBlur={() => cambiarRuc(transRuc, setTransNombre, setTransMtc).completar()} />
              <Texto etiqueta="Razón social" obligatorio value={transNombre} onChange={setTransNombre} ancho={2} />
              <Texto etiqueta="Registro MTC" value={transMtc} onChange={v => setTransMtc(v.toUpperCase())}
                     pista="Opcional. Letras y números, como en su constancia del MTC." />
            </div>
            <datalist id="transportistas-guardados">
              {transporte.transportistas.filter(t => t.activo).map(t => <option key={t.id} value={t.ruc}>{t.razonSocial}</option>)}
            </datalist>
            <div className="rejilla-4">
              <Texto etiqueta="Entrega al transportista" type="date" value={entrega || fechaTraslado} onChange={setEntrega}
                     pista="Por defecto, el día del traslado." />
            </div>
            {/* 24 oct: lo que se aplica, en pequeño (como Odoo o SAP: avisa, no bloquea). */}
            <p className="nota se-aplica">
              Se aplica: tú emites la guía del remitente. La empresa de transporte emite la suya (guía del transportista),
              salvo que la norma la exceptúe.
            </p>
          </>
        ) : (
          <>
            {tipo === '09' && (
              <label className="casilla">
                <input type="checkbox" checked={menor} onChange={e => setMenor(e.target.checked)} />
                {' '}Va en un vehículo menor (moto o auto: categoría M1 o L). No pide placa ni conductor.
              </label>
            )}
            {conVehiculo && (
              <>
                <div className="rejilla-4">
                  <Texto etiqueta="Placa" obligatorio value={placa} mono lista="vehiculos-guardados" onChange={cambiarPlaca}
                         pista={transporte.vehiculos.find(v => v.placa === placa && v.activo) ? `Guardada${vehDescripcion ? ` · ${vehDescripcion}` : ''}` : 'Sin guion. Ej.: ABC123'} />
                  <Texto etiqueta={tipo === '31' ? 'Certificado de habilitación (TUC)' : 'Certificado de habilitación (TUC)'} obligatorio={tipo === '31'}
                         value={tuc} onChange={v => setTuc(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))}
                         pista={tipo === '31'
                           ? 'De 10 a 15 letras y números, como en el certificado (no la tarjeta de propiedad). Ej.: 15M21028441E.'
                           : 'Opcional en tu propio vehículo: si no lo tienes, déjalo vacío. Si lo pones: 10 a 15 letras y números.'} />
                  <div className="campo">
                    <label>Autorización especial</label>
                    <select value={entidad} onChange={e => { setEntidad(e.target.value); if (!e.target.value) setAutorizacion('') }}>
                      <option value="">No necesita</option>
                      {ENTIDADES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                    </select>
                  </div>
                  {entidad && <Texto etiqueta="N.° de autorización" obligatorio value={autorizacion} onChange={setAutorizacion}
                                     pista="Como figura en la autorización de la entidad." />}
                </div>
                <datalist id="vehiculos-guardados">
                  {transporte.vehiculos.filter(v => v.activo).map(v => <option key={v.id} value={v.placa}>{v.descripcion ?? ''}</option>)}
                </datalist>

                <CamposConductor titulo="Conductor" valor={conductor} onCambio={setConductor}
                                 transporte={transporte} personal={personal} onElegir={v => elegirConductor(v, setConductor)} />
                {relevo ? (
                  <>
                    <CamposConductor titulo="Conductor de relevo" valor={relevo} onCambio={setRelevo}
                                     transporte={transporte} personal={personal} onElegir={v => elegirConductor(v, setRelevo)} />
                    <Boton estilo="plano" onClick={() => setRelevo(undefined)}>Quitar el conductor de relevo</Boton>
                  </>
                ) : (
                  <Boton estilo="plano" onClick={() => setRelevo(CONDUCTOR_VACIO)}>+ Conductor de relevo</Boton>
                )}
              </>
            )}
            {tipo === '31' && (
              <>
                <p className="secundario">Registro MTC de tu empresa: <strong className="mono">{ctx.empresa.registroMtc ?? '—'}</strong> (Configuración de guías).</p>
                <label className="casilla">
                  <input type="checkbox" checked={subcontrato} onChange={e => setSubcontrato(e.target.checked)} />{' '}Subcontraté el traslado
                </label>
                {subcontrato && (
                  <div className="rejilla-4">
                    <Texto etiqueta="RUC del subcontratado" obligatorio value={subRuc} inputMode="numeric" pista="11 dígitos."
                           onChange={v => setSubRuc(cambiarRuc(v, setSubNombre).r)} onBlur={() => cambiarRuc(subRuc, setSubNombre).completar()} />
                    <Texto etiqueta="Razón social" obligatorio value={subNombre} onChange={setSubNombre} ancho={3} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      {/* 24 oct: las casillas de SOL (para los dos tipos de guía). */}
      <section className="bloque">
        <h2 className="subtitulo">Indicadores del traslado (opcional)</h2>
        <label className="casilla">
          <input type="checkbox" checked={transbordo} onChange={e => setTransbordo(e.target.checked)} />
          {' '}Realiza transbordo programado (el traslado cambia de vehículo en el camino, ya previsto)
        </label>
        <label className="casilla">
          <input type="checkbox" checked={retorno === 'vacio'} onChange={e => setRetorno(e.target.checked ? 'vacio' : '')} />
          {' '}Retorno de vehículo vacío
        </label>
        <label className="casilla">
          <input type="checkbox" checked={retorno === 'envases'} onChange={e => setRetorno(e.target.checked ? 'envases' : '')} />
          {' '}Retorno de vehículo con envases o embalajes vacíos
        </label>
      </section>

      {/* --- 4 ----------------------------------------------------------------- */}
      <section className="bloque">
        <h2 className="subtitulo">4 · Lo que se traslada</h2>
        {despacho && (
          <p className="secundario">
            Sale de {despacho.numero} ({fecha(despacho.fechaEmision)}). Puedes bajar las cantidades: lo que no vaya ahora queda pendiente para otra guía.
          </p>
        )}
        {tipo === '31' && <p className="secundario">Se copian de la guía del remitente (o se escriben): no hace falta que sean productos tuyos.</p>}

        <table className="tabla tabla-bienes">
          <thead>
            <tr><th>Descripción</th><th>Unidad</th><th className="derecha">Cantidad</th><th aria-label="Quitar" /></tr>
          </thead>
          <tbody>
            {bienes.map(b => {
              const excede = b.pendiente !== undefined && numero(b.cantidad) > b.pendiente
              return (
                <tr key={b.clave}>
                  <td>
                    <input value={b.descripcion} aria-label="Descripción" maxLength={500} readOnly={!!b.documentoLineaId}
                           onChange={e => cambiarBien(b.clave, { descripcion: e.target.value })} />
                    {b.codigo && <div className="secundario mono">{b.codigo}</div>}
                  </td>
                  <td>
                    {b.documentoLineaId ? nombreUnidad(b.unidad) : (
                      <select value={b.unidad} aria-label="Unidad" onChange={e => cambiarBien(b.clave, { unidad: e.target.value })}>
                        {!UNIDADES.some(u => u[0] === b.unidad) && <option value={b.unidad}>{b.unidad}</option>}
                        {UNIDADES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="derecha">
                    <input className="mono cantidad" inputMode="decimal" value={b.cantidad} aria-label="Cantidad" aria-invalid={excede || undefined}
                           onChange={e => cambiarBien(b.clave, { cantidad: e.target.value.replace(/[^\d.,]/g, '') })} />
                    {b.pendiente !== undefined && <div className={excede ? 'pista mal' : 'secundario'}>faltan {b.pendiente}</div>}
                  </td>
                  <td><Boton estilo="plano" onClick={() => quitarBien(b.clave)} aria-label="Quitar este bien">Quitar</Boton></td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="acciones-linea">
          {!despacho && tipo === '09' && (
            <div className="buscador-bien">
              <BuscadorProducto onElegir={p => setBienes(bs => [...bs, {
                clave: claveFila(), descripcion: p.descripcion, unidad: p.unidadMedida === 'ZZ' ? 'NIU' : p.unidadMedida,
                cantidad: '1', codigo: p.codigo, productoId: p.id,
              }])} />
            </div>
          )}
          {!despacho && <Boton estilo="secundario" onClick={agregarBien}>+ Escribir un bien</Boton>}
          {sinDespachar.map(l => (
            <Boton key={l.id} estilo="plano" onClick={() => setBienes(bs => [...bs, {
              clave: claveFila(), descripcion: l.descripcion, unidad: l.unidad, cantidad: String(l.pendiente),
              codigo: l.codigo, productoId: l.productoId, documentoLineaId: l.id, pendiente: l.pendiente,
            }])}>+ {l.descripcion}</Boton>
          ))}
        </div>

        <div className="rejilla-4">
          <Texto etiqueta={`Peso bruto total (${unidadPeso === 'TNE' ? 't' : 'kg'})`} obligatorio value={peso} inputMode="decimal" mono
                 onChange={v => setPeso(v.replace(/[^\d.,]/g, ''))} pista="Todo lo que va, con su empaque." />
          <div className="campo">
            <label>Unidad del peso</label>
            <select value={unidadPeso} onChange={e => setUnidadPeso(e.target.value === 'TNE' ? 'TNE' : 'KGM')}>
              <option value="KGM">Kilogramos (KGM)</option>
              <option value="TNE">Toneladas (TNE)</option>
            </select>
          </div>
          <Texto etiqueta={motivo === '08' ? 'Bultos' : 'Bultos (opcional)'} obligatorio={motivo === '08'} value={bultos} inputMode="numeric"
                 pista="Solo números enteros."
                 onChange={v => setBultos(v.replace(/\D/g, ''))} />
          <Texto etiqueta="Observaciones (opcional)" value={observaciones} onChange={setObservaciones} maxLength={250} ancho={2} />
        </div>

        {/* 24 oct: otros documentos relacionados (en una guía suelta sobre todo). */}
        <h3 className="rotulo">Documentos relacionados</h3>
        {despacho && <p className="secundario">{despacho.numero} ya va como documento relacionado.</p>}
        {documentos.map((x, i) => (
          <div className="rejilla-4" key={i}>
            <div className="campo">
              <label>Tipo</label>
              <select value={x.tipo} onChange={e => setDocumentos(ds => ds.map((y, j) => j === i ? { ...y, tipo: e.target.value } : y))}>
                {(ctx.tiposDocumento ?? []).map(t => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
              </select>
            </div>
            <Texto etiqueta="Número" obligatorio value={x.numero} mono maxLength={30}
                   onChange={v => setDocumentos(ds => ds.map((y, j) => j === i ? { ...y, numero: v.toUpperCase() } : y))} />
            {['01', '03', '04', '09', '12', '31', '48'].includes(x.tipo) ? (
              <Texto etiqueta="RUC de quien lo emitió" value={x.ruc ?? ''} inputMode="numeric" pista="Vacío = tu RUC."
                     onChange={v => setDocumentos(ds => ds.map((y, j) => j === i ? { ...y, ruc: v.replace(/\D/g, '').slice(0, 11) } : y))} />
            ) : <div />}
            <div className="campo"><label>&nbsp;</label>
              <Boton estilo="plano" onClick={() => setDocumentos(ds => ds.filter((_, j) => j !== i))}>Quitar</Boton>
            </div>
          </div>
        ))}
        {documentos.length < 10 && (
          <Boton estilo="plano" onClick={() => setDocumentos(ds => [...ds, { tipo: '80', numero: '' }])}>
            + Documento relacionado (constancia de detracción, DAM, otra factura…)
          </Boton>
        )}
      </section>

      {fallo && <Aviso>{fallo}</Aviso>}

      <div className="bloque pie-guia">
        <span className="secundario">
          {tipo === '31'
            ? <>La guía del remitente debe estar emitida antes que esta. Sale el camión cuando <strong>las dos digan «Aceptada»</strong>.</>
            : <>Sale con la serie <strong className="mono">{serie || '—'}</strong>{!seriesLocal.some(s => s.serie === serie) && serie ? ' (se crea al emitir)' : ''}. El transporte que escribas queda guardado para la próxima.</>}
        </span>
        <div className="acciones-guia">
          <Boton estilo="secundario" onClick={() => navegar(despacho ? `/facturacion/comprobantes/${despacho.id}` : '/guias')}>Cancelar</Boton>
          <Boton onClick={() => void emitir()} ocupado={emitiendo} textoOcupado="Emitiendo…"
                 disabled={!!despacho && !despacho.puede}>
            {tipo === '31' ? 'Emitir guía del transportista' : 'Emitir guía'}
          </Boton>
        </div>
      </div>
    </div>
  )

}


// =============================================================================

function Texto({ etiqueta, value, onChange, obligatorio, pista, ancho, mono, lista, onBlur, ...resto }: {
  etiqueta: string
  value: string
  onChange: (v: string) => void
  obligatorio?: boolean
  pista?: string
  ancho?: number
  mono?: boolean
  lista?: string
  onBlur?: () => void
  type?: string
  inputMode?: 'numeric' | 'decimal' | 'text'
  placeholder?: string
  maxLength?: number
  min?: string
}) {
  const id = useId()
  return (
    <div className={`campo${ancho ? ` ancho-${ancho}` : ''}`}>
      <label htmlFor={id}>{etiqueta}{obligatorio && <Asterisco />}</label>
      <input id={id} value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} list={lista}
             className={mono ? 'mono' : undefined} aria-required={obligatorio || undefined} {...resto} />
      {pista && <span className="pista">{pista}</span>}
    </div>
  )
}

function CamposConductor({ titulo, valor, onCambio, transporte, personal, onElegir }: {
  titulo: string
  valor: Conductor
  onCambio: (c: Conductor) => void
  transporte: Transporte
  personal: PersonaDelPersonal[]
  onElegir: (v: string) => void
}) {
  const guardados = transporte.conductores.filter(c => c.activo)
  const delPersonal = personal.filter(p => !guardados.some(g => g.numeroDoc === p.numeroDoc))
  const cambiar = (c: Partial<Conductor>) => onCambio({ ...valor, ...c, usuarioId: c.numeroDocumento !== undefined ? null : valor.usuarioId })

  return (
    <div className="conductor-guia">
      <div className="rejilla-4">
        {(guardados.length > 0 || delPersonal.length > 0) && (
          <div className="campo">
            <label>{titulo}: elegir</label>
            <select value="" onChange={e => onElegir(e.target.value)}>
              <option value="">Escribir uno nuevo…</option>
              {guardados.length > 0 && (
                <optgroup label="Guardados">
                  {guardados.map(c => <option key={c.id} value={`g:${c.id}`}>{c.nombres} {c.apellidos} · {c.numeroDoc}</option>)}
                </optgroup>
              )}
              {delPersonal.length > 0 && (
                <optgroup label="De tu personal">
                  {delPersonal.map(p => <option key={p.usuarioId} value={`p:${p.usuarioId}`}>{p.nombres} {p.apellidos} · {p.numeroDoc}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        )}
        <div className="campo">
          <label>Documento<Asterisco /></label>
          <select value={valor.tipoDocumento} onChange={e => cambiar({ tipoDocumento: e.target.value })}>
            <option value="1">DNI</option><option value="4">Carné de extranjería</option><option value="7">Pasaporte</option>
          </select>
        </div>
        <Texto etiqueta="Número" obligatorio value={valor.numeroDocumento} inputMode={valor.tipoDocumento === '1' ? 'numeric' : 'text'}
               pista={valor.tipoDocumento === '1' ? '8 dígitos.' : 'Como figura en el documento.'}
               onChange={v => cambiar({ numeroDocumento: v.trim().toUpperCase() })} />
        <Texto etiqueta="Licencia" obligatorio value={valor.licencia} mono placeholder="Q41025874"
               pista="9 o 10 letras y números, como en el brevete (una letra y el DNI)."
               onChange={v => cambiar({ licencia: v.toUpperCase().replace(/\s/g, '') })} />
      </div>
      <div className="pareja">
        <Texto etiqueta="Nombres" obligatorio value={valor.nombres} onChange={v => cambiar({ nombres: v })} />
        <Texto etiqueta="Apellidos" obligatorio value={valor.apellidos} onChange={v => cambiar({ apellidos: v })} />
      </div>
    </div>
  )
}