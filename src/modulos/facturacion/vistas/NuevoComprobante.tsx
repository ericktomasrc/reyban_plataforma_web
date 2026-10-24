import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Asterisco, Campo } from '../../../componentes/Campo'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { BuscadorCliente } from '../componentes/BuscadorCliente'
import { whatsappLegible } from '../componentes/PanelWhatsapp'
import { BuscadorProducto } from '../componentes/BuscadorProducto'
import {
  PagoYDetraccion, detraccionInicial, montoDetraccion, netoPendiente, nombreDetraccion,
  pagoInicial, revisarPago,
} from '../componentes/PagoYDetraccion'
import type { DetraccionEnEdicion, PagoEnEdicion } from '../componentes/PagoYDetraccion'
import {
  clientesServicio, consultasServicio, documentosServicio, productosServicio,
} from '../servicios/facturacionServicio'
import type { DatosDocumento, SerieEmpresa, SucursalMia } from '../servicios/facturacionServicio'
import { sucursalesServicio } from '../servicios/facturacionServicio'

/**
 * 046: con qué sucursal abre la pantalla. Con una elegida arriba, la API ya
 * manda solo esa. Con «Todas», la de por defecto de la persona; si no tiene,
 * la primera que tenga series.
 */
function sucursalInicial(mias: SucursalMia[], series: SerieEmpresa[], defecto?: string | null): string {
  if (mias.length === 0) return ''
  if (defecto && mias.some(m => m.id === defecto)) return defecto
  return (mias.find(m => series.some(s => s.sucursalId === m.id)) ?? mias[0]).id
}
import type { CatalogosSunat, ClienteEnLista, ProductoEnLista } from '../tipos'

/** Una línea mientras se está escribiendo. Los importes se calculan al vuelo. */
interface LineaEnEdicion {
  clave: string
  productoId: string | null
  codigo: string
  descripcion: string
  unidadMedida: string
  cantidad: string
  valorUnitario: string
  descuento: string
  tipoAfectacion: string
}

const IGV = 0.18

function vacia(): LineaEnEdicion {
  return {
    clave: crypto.randomUUID(),
    productoId: null, codigo: '', descripcion: '',
    unidadMedida: 'NIU', cantidad: '1', valorUnitario: '',
    descuento: '0', tipoAfectacion: '10',
  }
}

const num = (s: string) => {
  const n = Number((s ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Dos decimales, a la mitad hacia arriba.
 *
 * EL `+ Number.EPSILON` NO ES SUPERSTICIÓN. En JavaScript, 1.005 no es
 * exactamente 1.005 sino 1.00499999…, así que `Math.round(1.005 * 100)`
 * devuelve 100 y no 101. Sumar el épsilon empuja esos casos al lado correcto.
 *
 * El back usa `decimal`, que no tiene este problema. Aquí no hay `decimal`, y
 * esta es la aproximación más cercana para una estimación de pantalla.
 */
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// =============================================================================
// LA FECHA DE EMISIÓN
//
// Se maneja como TEXTO «AAAA-MM-DD», no como `Date`. Una fecha de calendario no
// tiene zona horaria, y `new Date('2026-10-04')` es medianoche UTC: en Lima,
// las siete de la tarde del día 3 (lo que pasó en pantalla el 4 de octubre).
// =============================================================================

/** Hoy en Lima, como «AAAA-MM-DD». `en-CA` es el formato que da justo eso. */
const hoyEnLima = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())

/** Resta días a una fecha «AAAA-MM-DD» sin pasar por la zona del navegador. */
function restarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d - dias)).toISOString().slice(0, 10)
}

/** «04 de octubre de 2026», para la revisión. */
const fechaLarga = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric',
  }).format(new Date(Date.UTC(a, m - 1, d)))
}

/**
 * Cuántos días hacia atrás admite SUNAT, por tipo: la factura hasta 3 días
 * después de su fecha, la boleta hasta 7 (viaja en el resumen diario). Los
 * mismos que `Plazos` en el back y que la alarma de atrasados.
 */
const plazoDias = (tipo: string) => tipo === '03' ? 7 : 3

/**
 * Armar y emitir un comprobante.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LOS TOTALES DE ESTA PANTALLA SON UNA ESTIMACIÓN, y así se dice en la
 * pantalla, no solo aquí.
 *
 * La cifra que se firma y viaja a SUNAT la calcula el servicio de facturación,
 * que sabe de redondeos, afectaciones y reglas que esta pantalla no conoce. Lo
 * de aquí existe para que nadie emita a ciegas, no para sustituirlo.
 *
 * Por eso al emitir, el importe que se enseña es el que devolvió el servicio,
 * no el de aquí.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * DOS PASOS Y NO UNO: se guarda como borrador y después se emite. Armar una
 * factura de quince líneas lleva un rato, y perderla por un clic en el sitio
 * equivocado es inaceptable. Además deja revisarla antes del paso que no tiene
 * vuelta atrás.
 */
export function NuevoComprobante() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { pedir, dialogo: confirmacion } = useConfirmar()
  const mensaje = useMensaje()

  const [cargando, setCargando] = useState(true)
  const [catalogos, setCatalogos] = useState<CatalogosSunat>()

  const [tipo, setTipo]     = useState('01')
  const [serie, setSerie]   = useState('F001')
  // 21 OCT: las series de la empresa, del servicio. Null = no se pudieron
  // leer (queda el campo de texto); [] = la empresa no tiene ninguna.
  const [series, setSeries] = useState<SerieEmpresa[] | null>(null)
  // 044: las sucursales en las que trabajo, y desde cuál emito.
  const [sucursales, setSucursales] = useState<SucursalMia[]>([])
  const [sucursalId, setSucursalId] = useState('')
  const [moneda, setMoneda] = useState('PEN')
  // Soles por dólar, como lo escribe la gente («3.745»). Solo en dólares.
  const [tipoCambio, setTipoCambio] = useState('')
  // 17 oct: el de venta SUNAT del día, propuesto. Se puede corregir; si se
  // corrige a mano ya no se vuelve a proponer encima.
  const [tcPropuesto, setTcPropuesto] = useState<string>()
  // 033: si SUNAT no publicó ese día, de qué día es el propuesto.
  const [tcNota, setTcNota] = useState<string | null>(null)
  // 24 oct: si la consulta falla, se dice (antes el campo quedaba vacío sin explicación).
  const [tcFallo, setTcFallo] = useState<string | null>(null)
  const [cliente, setCliente] = useState<ClienteEnLista>()
  // 043: null = lo que diga el cliente; true/false = decidido para este comprobante.
  const [porWhatsapp, setPorWhatsapp] = useState<boolean | null>(null)
  const [lineas, setLineas] = useState<LineaEnEdicion[]>([vacia()])

  const [ordenCompra, setOrdenCompra] = useState('')

  // 040: contado o crédito, y la detracción. Solo facturas.
  const [pago, setPago] = useState<PagoEnEdicion>(pagoInicial())
  const [det, setDet]   = useState<DetraccionEnEdicion>(detraccionInicial())

  // HOY POR DEFECTO, y se puede poner una anterior dentro del plazo: «ayer
  // vendí, hoy facturo con la fecha de ayer» es lo normal en cualquier empresa.
  const [fechaEmision, setFechaEmision] = useState(hoyEnLima())

  const [borradorId, setBorradorId] = useState<string | undefined>(id)

  // EL ESTADO DEL DOCUMENTO CARGADO. Hace falta para una sola cosa: el botón
  // «Descartar» sale solo con un BORRADOR. Uno en `error` también se edita
  // aquí, pero ya se intentó mandar al servicio —puede que le llegara— y no se
  // tira: se reintenta. El back dice lo mismo (solo descarta borradores).
  const [estadoDoc, setEstadoDoc] = useState<string>('borrador')
  const [descartando, setDescartando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [emitiendo, setEmitiendo] = useState(false)
  // LA CAPA QUE TAPA LA PANTALLA mientras se guarda o se emite desde «Emitir».
  //
  // El botón ya decía «Emitiendo…», pero queda al pie de la página y nadie lo
  // mira: lo que se veía era una pantalla quieta durante varios segundos, con
  // la tentación de volver a pulsar o de cerrar. Emitir gasta un correlativo;
  // ahí no puede haber duda de si algo está pasando. Y mientras está puesta no
  // se puede tocar el formulario, que es justo lo que hay que impedir.
  const [capa, setCapa] = useState<'guardando' | 'emitiendo'>()
  // Igual que en las listas: lo que no se pudo CARGAR se queda en banda —
  // detrás de la ventana no habría formulario que arreglar—, y todo lo que es
  // consecuencia de pulsar «Guardar» o «Emitir» sale en ventana.
  const [errorCarga, setErrorCarga] = useState<string>()

  // --- Carga inicial --------------------------------------------------------
  useEffect(() => {
    let vivo = true

    void (async () => {
      try {
        const cat = await productosServicio.catalogos()
        if (vivo) setCatalogos(cat)

        // 21 OCT: LA SERIE SALE SOLA, de las que tiene dada de alta la empresa.
        // En un comprobante nuevo, la primera de factura; un borrador trae la suya.
        let ss: SerieEmpresa[] = []
        try {
          ss = await documentosServicio.series()
          // 044: las sucursales en las que trabajo (el selector sale si son dos o más).
          let mias: SucursalMia[] = []
          let defecto: string | null = null
          try {
            const r = await sucursalesServicio.mias()
            mias = r.sucursales
            defecto = r.defectoId ?? null
          } catch { /* como antes, sin sucursales */ }
          if (vivo) {
            setSeries(ss)
            setSucursales(mias)
            const suc = sucursalInicial(mias, ss, defecto)
            setSucursalId(suc)
            const primera = ss.find(s => s.tipo === '01' && (!suc || !s.sucursalId || s.sucursalId === suc))
            if (!id && primera) setSerie(primera.serie)
          }
        } catch { /* queda el campo de texto */ }

        // 040: la cuenta de detracciones y el código habituales de la empresa.
        // Se dejan escritos pero SIN marcar: la pantalla propone, no decide.
        try {
          const pref = await documentosServicio.preferenciasDetraccion()
          if (vivo && !id) setDet(d => ({
            ...d,
            cuenta: pref.cuenta ?? '',
            codigo: pref.codigo ?? '',
            porcentaje: pref.porcentaje != null ? String(pref.porcentaje) : '',
          }))
        } catch { /* se escriben a mano */ }

        if (id) {
          const d = await documentosServicio.ver(id)
          if (!vivo) return

          if (!d.sePuedeEditar) {
            navegar(`/facturacion/comprobantes/${id}`, { replace: true })
            return
          }

          setEstadoDoc(d.estado)
          setTipo(d.tipo)
          setSerie(d.serie ?? (d.tipo === '01' ? 'F001' : 'B001'))
          // 044: la sucursal del borrador es la de su serie.
          const deSerie = ss.find(s => s.tipo === d.tipo && s.serie === d.serie)?.sucursalId
          if (deSerie) setSucursalId(deSerie)
          setMoneda(d.moneda)
          setTipoCambio(d.tipoCambio != null ? d.tipoCambio.toFixed(3) : '')
          setOrdenCompra(d.datosExtra?.ordenCompra ?? '')
          // La del borrador, tal cual. Si envejeció fuera de plazo, el aviso
          // de debajo del campo lo dice y Emitir no deja seguir.
          setFechaEmision(d.fechaEmision)
          setPorWhatsapp(d.whatsapp?.enviar ?? null)   // 043: como se guardó

          // 040: como se guardó. Ya decidido: no se vuelve a proponer encima.
          setPago({
            forma: d.formaPago ?? 'contado',
            cuotas: (d.cuotas ?? []).map(c => ({
              clave: crypto.randomUUID(), monto: c.monto.toFixed(2), vence: c.vence,
            })),
          })
          if (d.detraccion) {
            setDet({
              activa: true, tocada: true,
              codigo: d.detraccion.codigo,
              porcentaje: String(d.detraccion.porcentaje),
              cuenta: d.detraccion.cuenta,
              medioPago: d.detraccion.medioPago,
            })
          } else {
            setDet(x => ({ ...x, tocada: true }))
          }

          if (d.cliente) {
            const encontrados = await clientesServicio.listar(d.cliente.numeroDocumento)
            if (vivo) setCliente(encontrados.find(c => c.id === d.cliente!.id))
          }

          setLineas(d.lineas.map(l => ({
            clave: crypto.randomUUID(),
            productoId: l.productoId,
            codigo: l.codigo ?? '',
            descripcion: l.descripcion,
            unidadMedida: l.unidadMedida,
            cantidad: String(l.cantidad),
            valorUnitario: String(l.valorUnitario),
            descuento: String(l.descuento),
            tipoAfectacion: l.tipoAfectacion,
          })))
        }
      } catch (e) {
        if (vivo) setErrorCarga(e instanceof ErrorApi ? e.message : 'No se pudo cargar.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()

    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // --- Los totales, estimados ----------------------------------------------
  //
  // ══════════════════════════════════════════════════════════════════════════
  // SE REDONDEA LÍNEA A LÍNEA Y DESPUÉS SE SUMA. Nunca al revés.
  //
  // Por dos motivos, y el segundo se comprobó con números:
  //
  //   1. Es lo que exige SUNAT: la base imponible del documento tiene que ser
  //      exactamente la suma de las líneas (regla 3277).
  //
  //   2. Es lo que hace `CalculoPrevio.cs` en el back. Acumulando primero y
  //      redondeando al final, las dos cuentas se separan: siete líneas de
  //      1.25 dan 10.36 en el back y 10.33 aquí. La pantalla enseñaría un
  //      número y el borrador guardaría otro, y quien lo viera no tendría
  //      forma de saber cuál creer.
  //
  // Son dos implementaciones de la misma fórmula y eso es una duplicación
  // incómoda; existe porque la alternativa era una llamada al servidor por
  // cada tecla. Si se cambia una, hay que cambiar la otra.
  // ══════════════════════════════════════════════════════════════════════════
  const totales = useMemo(() => {
    let gravado = 0, otros = 0, igv = 0, descuentos = 0

    for (const l of lineas) {
      const bruto = num(l.cantidad) * num(l.valorUnitario)
      const desc  = num(l.descuento)
      const neto  = r2(Math.max(0, bruto - desc))

      descuentos += desc

      if (l.tipoAfectacion === '10') {
        gravado += neto
        igv += r2(neto * IGV)
      } else if (l.tipoAfectacion === '17') {
        // El arroz pilado tributa IVAP al 4%, no IGV al 18%. Con el 18 el
        // total de pantalla saldría un 14% por encima del real.
        gravado += neto
        igv += r2(neto * 0.04)
      } else {
        otros += neto
      }
    }

    return {
      gravado: r2(gravado), otros: r2(otros), igv: r2(igv),
      descuentos: r2(descuentos), total: r2(gravado + otros + igv),
    }
  }, [lineas])

  // ═══════════════════════════════════════════════════════════════════════════
  // EL MARGEN DE LA FECHA, EN HORA DE LIMA Y NO EN LA DEL NAVEGADOR: un
  // portátil con la zona de otro país enseñaría un «hoy» distinto del que
  // usa el back, y un día de diferencia en una factura es un rechazo.
  //
  // Nunca futura —SUNAT no la acepta— ni anterior al plazo del tipo. El campo
  // ya no deja elegir fuera de ahí; esto cubre el borrador que se guardó hace
  // días y llega con su fecha vieja.
  // ═══════════════════════════════════════════════════════════════════════════
  const hoy = hoyEnLima()

  // EL TIPO DE CAMBIO SE PROPONE SOLO (venta SUNAT de la fecha de emisión).
  // No pisa uno escrito a mano ni el de un borrador cargado.
  useEffect(() => {
    if (moneda === 'PEN' || !fechaEmision) return
    if (tipoCambio.trim() && tipoCambio !== tcPropuesto) return
    let vivo = true
    setTcFallo(null)
    consultasServicio.tipoCambio(fechaEmision)
      .then(r => {
        if (!vivo) return
        if (!(r.venta > 0)) { setTcFallo('No se encontró el tipo de cambio de esa fecha: escríbelo a mano (el de venta que publica SUNAT).'); return }
        const v = Number(r.venta).toFixed(3)
        setTipoCambio(v)
        setTcPropuesto(v)
        setTcNota(r.nota ?? null)
      })
      .catch(e => {
        if (vivo) setTcFallo(`${e instanceof ErrorApi ? e.message : 'No se pudo traer el tipo de cambio.'}`.replace(/\s*$/, ''))
      })
    return () => { vivo = false }
  }, [moneda, fechaEmision]) // eslint-disable-line react-hooks/exhaustive-deps

  // BOLETA DE MÁS DE S/ 700 SIN IDENTIFICAR AL CLIENTE: SUNAT exige su
  // documento (el servicio también lo comprueba). Igual que el servicio:
  // sin documento, o un número de un solo dígito repetido (00000000).
  const sinIdentificar = !!cliente && (cliente.tipoDocumento === '0' ||
    !cliente.numeroDocumento.trim() || /^(\d)\1*$/.test(cliente.numeroDocumento.trim()))
  const totalSoles = moneda === 'PEN' ? totales.total : totales.total * num(tipoCambio)
  const boletaSinDni = tipo === '03' && sinIdentificar && totalSoles > 700

  // 21 oct: las series de este tipo, y el número que tocará con la elegida.
  // 044: solo las de la sucursal elegida (sin asignar = de la 0000, que ya viene con su id).
  const seriesDeSucursal = (series ?? []).filter(s => !sucursalId || !s.sucursalId || s.sucursalId === sucursalId)
  const seriesDelTipo = seriesDeSucursal.filter(s => s.tipo === tipo)
  const sucursalElegida = sucursales.find(s => s.id === sucursalId)
  const siguiente = seriesDelTipo.find(s => s.serie === serie)?.siguiente

  // 040: la detracción en soles y lo que queda por cobrar.
  const esFactura = tipo === '01'
  const detSoles = esFactura ? montoDetraccion(det, totalSoles) : null
  const neto = netoPendiente(totales.total, moneda, num(tipoCambio), detSoles)

  // 040: LA DETRACCIÓN SE PROPONE SOLA cuando la empresa ya tiene un código
  // habitual y la factura pasa de S/ 700. Solo mientras nadie la haya tocado:
  // si alguien dice «No», es «No».
  useEffect(() => {
    if (!esFactura || det.tocada || det.activa || !det.codigo) return
    if (totalSoles > 700) setDet(d => ({ ...d, activa: true }))
  }, [esFactura, totalSoles, det.tocada, det.activa, det.codigo])

  /** Al pasar a boleta, el cliente arranca en «Público en general». */
  async function ponerPublicoGeneral() {
    try { setCliente(await clientesServicio.publicoGeneral()) }
    catch { /* se elige a mano */ }
  }
  const fechaMinima = restarDias(hoy, plazoDias(tipo))
  const fechaMal =
    !fechaEmision ? 'Falta la fecha de emisión.'
    : fechaEmision > hoy ? 'La fecha de emisión no puede ser posterior a hoy.'
    : fechaEmision < fechaMinima
      ? `Con fecha del ${fechaLarga(fechaEmision)} ya pasó el plazo de SUNAT ` +
        `(${plazoDias(tipo)} días para ${tipo === '03' ? 'una boleta' : 'una factura'}). ` +
        `Pon una desde el ${fechaLarga(fechaMinima)}.`
    : undefined

  // --- El aviso ámbar -------------------------------------------------------
  //
  // LAS LÍNEAS QUE NO CUADRAN CON LA COSTUMBRE DEL CLIENTE. Solo existe si el
  // cliente tiene afectación habitual: sin ella no hay nada con qué comparar,
  // y un aviso que sale siempre deja de leerse a la semana.
  //
  // NO BLOQUEA LA EMISIÓN, a propósito. Un cliente de exportación puede
  // comprar algo en el mercado local perfectamente. Si esto lo impidiera, lo
  // que pasaría es que alguien vaciaría el campo de la ficha del cliente para
  // poder facturar — y se perdería la protección para siempre, no solo para
  // esa factura.
  const desajustadas = useMemo(() => {
    const habitual = cliente?.afectacionHabitual
    if (!habitual) return []

    return lineas
      .map((l, i) => ({ numero: i + 1, l }))
      .filter(x => x.l.tipoAfectacion !== habitual)
  }, [lineas, cliente])

  const nombreAfectacion = (codigo: string) =>
    catalogos?.afectaciones.find(a => a.codigo === codigo)?.nombre ?? codigo

  /** Cuántas líneas van de cada afectación. Es el resumen de la revisión. */
  const resumenAfectaciones = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const l of lineas) cuenta.set(l.tipoAfectacion, (cuenta.get(l.tipoAfectacion) ?? 0) + 1)

    return [...cuenta.entries()]
      .map(([codigo, cuantas]) => ({ codigo, cuantas, nombre: nombreAfectacion(codigo) }))
      .sort((a, b) => b.cuantas - a.cuantas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineas, catalogos])

  /** Hay algo que mirar dos veces: el cliente va de una forma y alguna línea no. */
  const sospechoso = desajustadas.length > 0 && !!cliente?.afectacionHabitual

  /** Pone la costumbre del cliente en todas las líneas, de un golpe. */
  const igualarAfectacion = () => {
    const habitual = cliente?.afectacionHabitual
    if (!habitual) return
    setLineas(ls => ls.map(l => ({ ...l, tipoAfectacion: habitual })))
  }

  // --- Manejo de líneas -----------------------------------------------------
  const cambiar = (clave: string, campo: keyof LineaEnEdicion, valor: string) =>
    setLineas(ls => ls.map(l => l.clave === clave ? { ...l, [campo]: valor } : l))

  function ponerProducto(clave: string, p: ProductoEnLista) {
    // ══════════════════════════════════════════════════════════════════════
    // MANDA LA DEL CLIENTE, Y SOLO SI NO TIENE, LA DEL PRODUCTO.
    //
    // La afectación del IGV no es una propiedad de lo que vendes: es de la
    // operación, y la operación la define a quién le vendes. Las mismas
    // zapatillas van gravadas a un cliente de Lima y de exportación a uno de
    // Miami.
    //
    // Antes la línea heredaba siempre la del producto, que acierta casi
    // siempre. El «casi» era el error más caro de esta pantalla: la factura
    // salía con IGV a un cliente que no lo paga, bien formada, firmada y
    // aceptada por SUNAT, y el fallo aparecía semanas después cuadrando el
    // mes. Para entonces solo se arregla con una nota de crédito.
    //
    // Sigue pudiendo cambiarse en el desplegable de la línea: esto propone,
    // no impone.
    // ══════════════════════════════════════════════════════════════════════
    const afectacion = cliente?.afectacionHabitual ?? p.tipoAfectacion

    // EL SERVICIO ESPERA EL VALOR SIN IGV. Si el precio guardado lo lleva, se
    // le quita aquí — en un solo sitio, para que nadie tenga que acordarse de
    // dividir entre 1.18 al facturar.
    //
    // Se mira la afectación QUE VA A LLEVAR LA LÍNEA, no la del producto: en
    // una exportación no hay IGV que quitar, y quitarlo igualmente rebajaría
    // el precio un 18% sin que nadie lo pidiera.
    const sinIgv = p.incluyeIgv && afectacion === '10'
      ? p.precioUnitario / (1 + IGV)
      : p.precioUnitario

    setLineas(ls => ls.map(l => l.clave === clave ? {
      ...l,
      productoId: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      unidadMedida: p.unidadMedida,
      tipoAfectacion: afectacion,
      valorUnitario: sinIgv.toFixed(6),
    } : l))
  }

  const datos = (): DatosDocumento => ({
    tipo,
    serie: serie.trim().toUpperCase(),
    clienteId: cliente!.id,
    fechaEmision,
    moneda,
    tipoCambio: moneda !== 'PEN' && tipoCambio.trim() ? num(tipoCambio) : null,
    lineas: lineas.map(l => ({
      productoId: l.productoId,
      codigo: l.codigo || null,
      descripcion: l.descripcion.trim(),
      unidadMedida: l.unidadMedida,
      cantidad: num(l.cantidad),
      valorUnitario: num(l.valorUnitario),
      descuento: num(l.descuento),
      tipoAfectacion: l.tipoAfectacion,
    })),
    // El tipo explícito no es cosmético: sin él, TypeScript deduce del
    // ternario un `{ordenCompra: string} | {}` que no encaja con
    // `Record<string, string>`. Declararlo también hace que un campo mal
    // escrito falle aquí y no en el back.
    datosExtra: ordenCompra.trim()
      ? { ordenCompra: ordenCompra.trim() }
      : ({} as Record<string, string>),

    // 040: solo facturas.
    formaPago: esFactura ? pago.forma : 'contado',
    cuotas: esFactura && pago.forma === 'credito'
      ? pago.cuotas.map(c => ({ monto: num(c.monto), vence: c.vence }))
      : [],
    detraccion: esFactura && det.activa
      ? { codigo: det.codigo, porcentaje: num(det.porcentaje), cuenta: det.cuenta.trim(), medioPago: det.medioPago || '001' }
      : null,

    // 043
    whatsapp: !!cliente?.whatsapp && (porWhatsapp ?? !!cliente?.whatsappActivo),
  })

  function revisar(): string | undefined {
    if (!cliente) return 'Elige a quién le vas a facturar.'
    if (tipo === '01' && cliente.tipoDocumento !== '6')
      return 'Una factura necesita un cliente con RUC. Para este cliente, emite una boleta.'
    if (lineas.length === 0) return 'Añade al menos una línea.'

    // Al GUARDAR solo se para lo que nunca valdrá: vacía o futura. Una fecha
    // vieja se deja guardar —un borrador puede esperar— y se para al emitir.
    if (!fechaEmision) return 'Falta la fecha de emisión.'
    if (fechaEmision > hoy) return 'La fecha de emisión no puede ser posterior a hoy.'

    // El tipo de cambio puede faltar en un borrador (se para al emitir), pero
    // si está escrito tiene que tener sentido.
    if (moneda !== 'PEN' && tipoCambio.trim() && !(num(tipoCambio) > 0 && num(tipoCambio) < 100))
      return 'El tipo de cambio son los soles que vale un dólar, por ejemplo 3.745.'

    for (const [i, l] of lineas.entries()) {
      if (!l.descripcion.trim()) return `A la línea ${i + 1} le falta la descripción.`
      if (num(l.cantidad) <= 0) return `La cantidad de la línea ${i + 1} tiene que ser mayor que cero.`
      if (num(l.valorUnitario) < 0) return `El valor de la línea ${i + 1} no puede ser negativo.`
    }

    const ivap = lineas.filter(l => l.tipoAfectacion === '17').length
    if (ivap > 0 && ivap !== lineas.length)
      return 'El arroz pilado va en su propio comprobante: no se puede mezclar con otras líneas.'

    const expo = lineas.filter(l => l.tipoAfectacion === '40').length
    if (expo > 0 && expo !== lineas.length)
      return 'En una factura de exportación todas las líneas tienen que ser de exportación.'

    // 040: cuotas y detracción.
    const pagoMal = revisarPago(tipo, pago, det, fechaEmision, totales.total)
    if (pagoMal) return pagoMal

    return undefined
  }

  /**
   * `avisar = false` cuando lo llama «Emitir»: ahí el «Borrador guardado.» es
   * un paso intermedio, no una respuesta, y salía en ventana encima de la
   * revisión — dos ventanas a la vez justo antes del paso sin vuelta atrás.
   * Los errores sí se enseñan siempre.
   */
  async function guardar(avisar = true): Promise<string | undefined> {
    const mal = revisar()
    if (mal) { mensaje.error(mal); return undefined }

    setGuardando(true)

    try {
      if (borradorId) {
        await documentosServicio.editar(borradorId, datos())
        if (avisar) mensaje.bien('Borrador guardado.')
        return borradorId
      }

      const r = await documentosServicio.crear(datos())
      setBorradorId(r.id)
      if (avisar) mensaje.bien('Borrador guardado.')
      return r.id
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo guardar el borrador.')
      return undefined
    } finally {
      setGuardando(false)
    }
  }

  async function emitir() {
    // La fecha fuera de plazo se para AQUÍ, antes de guardar y de la revisión:
    // el back la rechazaría igual, pero así se dice en la pantalla donde se
    // arregla, sin capa ni ventana de por medio.
    if (fechaMal) { mensaje.error(fechaMal); return }

    if (moneda !== 'PEN' && !(num(tipoCambio) > 0)) {
      mensaje.error('Falta el tipo de cambio: el de venta que publica SUNAT para la fecha de emisión.')
      return
    }

    if (boletaSinDni) {
      mensaje.error('Una boleta de más de S/ 700 tiene que llevar el DNI del cliente (norma de SUNAT).')
      return
    }

    // 040: a crédito, SUNAT exige al menos una cuota (errores 3249 y 3251).
    if (esFactura && pago.forma === 'credito' && pago.cuotas.length === 0) {
      mensaje.error('Una factura al crédito necesita al menos una cuota con su monto y su fecha de vencimiento.')
      return
    }

    // SE GUARDA SIEMPRE ANTES DE EMITIR, aunque parezca que no hace falta:
    // lo que se manda al servicio es el borrador de la base, no lo que hay en
    // la pantalla. Sin este paso, un cambio de última hora no viajaría.
    setCapa('guardando')
    const idBorrador = await guardar(false)
    setCapa(undefined)
    if (!idBorrador) return

    // ════════════════════════════════════════════════════════════════════════
    // LA ÚLTIMA MIRADA, Y ES LA QUE IMPORTA.
    //
    // No es un «¿seguro?» de cortesía: es la única pantalla donde los seis
    // datos que no se pueden corregir después están juntos y grandes. Antes
    // solo decía el total y el nombre del cliente, que son justamente los dos
    // que nadie se equivoca — el importe se ve al armarlo y el cliente se
    // acaba de elegir.
    //
    // Los que se escapan son los otros: la afectación del IGV, el RUC, el tipo
    // de comprobante, la serie. Todos salen aquí marcados en color, y el
    // resumen de afectaciones cuenta las líneas por tipo para que «4 gravadas»
    // salte a la vista cuando el cliente era de exportación.
    //
    // Lo que NO se pone aquí: las líneas una por una. Una lista de treinta
    // líneas en una ventana no se lee, y lo que no se lee no protege.
    // ════════════════════════════════════════════════════════════════════════
    const seguro = await pedir({
      titulo: 'Revisa antes de emitir',
      confirmar: 'Emitir',
      mensaje: (
        <>
          <dl className="revision">
            <div className={sospechoso ? 'fila sensible ojo' : 'fila sensible'}>
              <dt>Afectación del IGV</dt>
              <dd>
                {resumenAfectaciones.map(r => (
                  <div key={r.codigo}>
                    {r.cuantas} {r.cuantas === 1 ? 'línea' : 'líneas'} · {r.nombre}
                  </div>
                ))}
                {sospechoso && (
                  <div className="alerta">
                    A {cliente?.razonSocial} se le suele facturar como{' '}
                    {nombreAfectacion(cliente!.afectacionHabitual!)}.
                  </div>
                )}
              </dd>
            </div>

            <div className="fila sensible">
              <dt>Cliente</dt>
              <dd>
                {cliente?.razonSocial}
                <div className="mono">{cliente?.numeroDocumento}</div>
              </dd>
            </div>

            <div className="fila sensible">
              <dt>Comprobante</dt>
              <dd>
                {tipo === '01' ? 'Factura' : 'Boleta de venta'}
                <div className="mono">{siguiente ?? `serie ${serie.trim().toUpperCase()}`}</div>
              </dd>
            </div>

            <div className={fechaEmision !== hoy ? 'fila sensible ojo' : 'fila sensible'}>
              <dt>Fecha de emisión</dt>
              <dd>
                {fechaLarga(fechaEmision)}
                {fechaEmision !== hoy && (
                  <div className="alerta">
                    No es hoy. Asegúrate de que la venta fue ese día: esta es
                    la fecha que verá SUNAT.
                  </div>
                )}
              </dd>
            </div>

            {moneda !== 'PEN' && (
              <div className="fila sensible">
                <dt>Tipo de cambio</dt>
                <dd className="mono">
                  {num(tipoCambio).toFixed(3)}
                  <div>≈ S/ {(totales.total * num(tipoCambio)).toFixed(2)}</div>
                </dd>
              </div>
            )}

            {/* 040 */}
            {esFactura && (
              <div className="fila sensible">
                <dt>Forma de pago</dt>
                <dd>
                  {pago.forma === 'credito'
                    ? <>Al crédito · {pago.cuotas.length} {pago.cuotas.length === 1 ? 'cuota' : 'cuotas'}
                        <div className="mono">
                          {pago.cuotas.map(c => `${num(c.monto).toFixed(2)} al ${fechaLarga(c.vence)}`).join(' · ')}
                        </div></>
                    : 'Al contado'}
                </dd>
              </div>
            )}
            {esFactura && (
              <div className={!det.activa && totalSoles > 700 ? 'fila sensible ojo' : 'fila sensible'}>
                <dt>Detracción</dt>
                <dd>
                  {det.activa
                    ? <>{det.codigo} · {nombreDetraccion(det.codigo)}
                        <div className="mono">{det.porcentaje} % = S/ {detSoles?.toFixed(2) ?? '—'} · cuenta {det.cuenta}</div></>
                    : 'No lleva'}
                  {!det.activa && totalSoles > 700 && (
                    <div className="alerta">Pasa de S/ 700: si es un servicio sujeto a detracción, SUNAT la exige.</div>
                  )}
                </dd>
              </div>
            )}

            <div className="fila">
              <dt>Total</dt>
              <dd className="mono grande">{moneda} {totales.total.toFixed(2)}</dd>
            </div>
            {esFactura && pago.forma === 'credito' && detSoles != null && (
              <div className="fila">
                <dt>Neto a cobrar</dt>
                <dd className="mono">{moneda} {neto.toFixed(2)}</dd>
              </div>
            )}
          </dl>

          <p>
            <strong>Esto no se puede deshacer.</strong> El comprobante gastará un
            número de tu serie y pasará a formar parte de una secuencia que SUNAT
            revisa. Para corregirlo después habría que emitir una nota de crédito.
          </p>
        </>
      ),
    })
    if (!seguro) return

    setEmitiendo(true)
    setCapa('emitiendo')

    try {
      const r = await documentosServicio.emitir(idBorrador)
      navegar(`/facturacion/comprobantes/${r.id}`, { state: { reciente: r.mensaje, abrirWhatsapp: r.whatsapp } })
    } catch (e) {
      // La capa se quita ANTES del mensaje: si no, el error saldría tapado.
      setCapa(undefined)
      if (e instanceof ErrorApi) {
        mensaje.error(
          e.message,
          'El comprobante sigue guardado: corrige lo que dice arriba y vuelve a pulsar Emitir. ' +
          'Si el servicio no respondía, púlsalo cuando vuelva: ' +
          'la clave de idempotencia impide que se emita dos veces.',
        )
      } else {
        mensaje.error('No se pudo emitir.')
      }
      setEmitiendo(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DESCARTAR UN BORRADOR
  //
  // NO LO BORRA: el back lo desactiva —nada se borra en la plataforma— y su
  // historial se conserva. Para quien lo pulsa, desaparece de la lista, que es
  // lo único que le importa.
  //
  // Pide confirmación aunque no sea irreversible para SUNAT: un borrador de
  // quince líneas tirado por un clic en el sitio equivocado es una mañana de
  // trabajo, y desde la pantalla no hay forma de recuperarlo.
  // ═══════════════════════════════════════════════════════════════════════════
  async function descartar() {
    if (!borradorId) return

    const seguro = await pedir({
      titulo: 'Descartar el borrador',
      confirmar: 'Descartar',
      tono: 'peligro',
      mensaje: (
        <>
          <p>Deja de salir en la lista de comprobantes y no se podrá continuar.</p>
          <p>
            <strong>No se emitió y no gastó ningún número</strong>, así que a
            SUNAT no le llega nada.
          </p>
        </>
      ),
    })
    if (!seguro) return

    setDescartando(true)
    try {
      const r = await documentosServicio.borrar(borradorId)
      mensaje.bien(r.mensaje)
      navegar('/facturacion/comprobantes')
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo descartar el borrador.')
      setDescartando(false)
    }
  }

  if (cargando) return <Cargando />

  const afectaciones = catalogos?.afectaciones ?? []
  const unidades = catalogos?.unidades ?? []

  return (
    <>
      <div className="encabezado-pagina">
        <h1 className="titulo-pagina">
          {borradorId ? 'Continuar el comprobante' : 'Nuevo comprobante'}
        </h1>
        <Boton estilo="secundario" onClick={() => navegar('/facturacion/comprobantes')}>
          Volver
        </Boton>
      </div>

      {errorCarga && <Aviso>{errorCarga}</Aviso>}

      {/* --- Cabecera ------------------------------------------------------ */}
      <div className="bloque">
        {/* 044: DESDE QUÉ SUCURSAL. Solo si trabajas en más de una. */}
        {sucursales.length > 1 && (
          <label className="campo selector-sucursal">
            <span className="etiqueta">Emitir desde<Asterisco /></span>
            <select value={sucursalId} onChange={e => {
              const v = e.target.value
              setSucursalId(v)
              setSerie((series ?? []).find(s => s.tipo === tipo && (!s.sucursalId || s.sucursalId === v))?.serie
                ?? (tipo === '01' ? 'F001' : 'B001'))
            }}>
              {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.codigo})</option>)}
            </select>
            <span className="pista">
              Un comprobante siempre sale de un local: viene elegida tu sucursal por defecto. Sale en el XML (código de
              establecimiento) y su dirección en el PDF.
            </span>
          </label>
        )}
        <div className="pareja">
          <label className="campo">
            <span className="etiqueta">Tipo<Asterisco /></span>
            <select
              value={tipo}
              onChange={e => {
                setTipo(e.target.value)
                // La serie sigue al tipo: una factura empieza por F y una
                // boleta por B. Dejar «F001» en una boleta es un rechazo
                // seguro, y el mensaje de SUNAT no menciona la serie.
                setSerie(seriesDeSucursal.find(s => s.tipo === e.target.value)?.serie
                  ?? (e.target.value === '01' ? 'F001' : 'B001'))
                // 17 oct: boleta sin cliente → «Público en general»; de vuelta
                // a factura, ese cliente no sirve y se quita.
                if (e.target.value === '03' && !cliente) void ponerPublicoGeneral()
                // 040: crédito y detracción, solo en facturas.
                if (e.target.value === '03') {
                  setPago(pagoInicial())
                  setDet(d => ({ ...d, activa: false }))
                }
                if (e.target.value === '01' && cliente?.tipoDocumento === '0') setCliente(undefined)
              }}
            >
              <option value="01">Factura</option>
              <option value="03">Boleta de venta</option>
            </select>
          </label>

          {/* 21 OCT: LA SERIE Y EL NÚMERO, de la configuración de la empresa. */}
          {seriesDelTipo.length > 0 ? (
            <label className="campo">
              <span className="etiqueta">Serie y número<Asterisco /></span>
              <select value={serie} onChange={e => setSerie(e.target.value)}>
                {!seriesDelTipo.some(s => s.serie === serie) && (
                  <option value={serie}>{serie} (no está dada de alta)</option>
                )}
                {seriesDelTipo.map(s => (
                  <option key={s.serie} value={s.serie}>{s.siguiente}</option>
                ))}
              </select>
              <span className="pista">
                {seriesDelTipo.length > 1 ? 'Elige la serie. ' : ''}
                El número lo confirma el servicio al emitir.
              </span>
            </label>
          ) : (
            <Campo
              etiqueta="Serie"
              obligatorio
              value={serie}
              onChange={e => setSerie(e.target.value.toUpperCase())}
              maxLength={4}
              mal={series !== null}
              pista={series !== null
                ? (sucursalElegida && sucursales.length > 1
                    ? `«${sucursalElegida.nombre}» no tiene serie de ${tipo === '01' ? 'factura' : 'boleta'}. Agrégala en Sucursales.`
                    : `Tu empresa no tiene serie de ${tipo === '01' ? 'factura' : 'boleta'}. Agrégala en Configuración › Series.`)
                : 'Una de las que tiene dada de alta tu empresa en el servicio.'}
            />
          )}
        </div>

        <BuscadorCliente elegido={cliente} onElegir={c => { setCliente(c); setPorWhatsapp(null) }} />

        {boletaSinDni && (
          <Aviso>
            Una boleta de más de <strong>S/ 700</strong> tiene que llevar el DNI (u otro
            documento) del cliente. Es norma de SUNAT. Pulsa «Cambiar» y búscalo o créalo.
          </Aviso>
        )}

        {tipo === '01' && cliente && cliente.tipoDocumento !== '6' && (
          <Aviso tono="ojo">
            <strong>{cliente.razonSocial}</strong> no tiene RUC, y una factura lo
            exige. Cambia a boleta de venta.
          </Aviso>
        )}

        {cliente?.afectacionHabitual && (
          <p className="nota">
            A <strong>{cliente.razonSocial}</strong> se le factura como{' '}
            <strong>{nombreAfectacion(cliente.afectacionHabitual)}</strong>. Las
            líneas entran así solas.
          </p>
        )}

        {desajustadas.length > 0 && cliente?.afectacionHabitual && (
          <Aviso tono="ojo">
            <p>
              {desajustadas.length === 1
                ? `La línea ${desajustadas[0].numero} no va como `
                : `Estas líneas no van como `}
              <strong>{nombreAfectacion(cliente.afectacionHabitual)}</strong>
              {desajustadas.length > 1 && (
                <>: {desajustadas.map(x => x.numero).join(', ')}</>
              )}
              , que es como se le suele facturar a{' '}
              <strong>{cliente.razonSocial}</strong>.
            </p>
            <p>
              Puede estar bien —una venta local a un cliente de exportación pasa—,
              pero míralo antes de emitir.
            </p>
            <Boton estilo="secundario" onClick={igualarAfectacion}>
              Poner {nombreAfectacion(cliente.afectacionHabitual).toLowerCase()} en todas
            </Boton>
          </Aviso>
        )}

        <div className="pareja">
          <label className="campo">
            <span className="etiqueta">Fecha de emisión<Asterisco /></span>
            <input
              type="date"
              value={fechaEmision}
              min={fechaMinima}
              max={hoy}
              onChange={e => setFechaEmision(e.target.value)}
              aria-invalid={fechaMal ? true : undefined}
            />
            {/* FUERA DE PLAZO, AQUÍ SOLO LA ETIQUETA: el motivo completo y el
                botón para arreglarlo van en el aviso de debajo. Con el texto
                en los dos sitios se leía dos veces lo mismo. */}
            <span className={fechaMal ? 'pista mal' : 'pista'}>
              {fechaEmision && fechaEmision < fechaMinima
                ? 'Fuera de plazo.'
                : fechaMal ?? `Hoy, o hasta ${plazoDias(tipo)} días antes si la venta fue ese día.`}
            </span>
          </label>

          <label className="campo">
            <span className="etiqueta">Moneda<Asterisco /></span>
            <select value={moneda} onChange={e => setMoneda(e.target.value)}>
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </label>
        </div>

        {fechaMal && fechaEmision < fechaMinima && (
          <Aviso tono="ojo">
            <p>{fechaMal}</p>
            <Boton estilo="secundario" onClick={() => setFechaEmision(hoy)}>
              Poner la fecha de hoy
            </Boton>
          </Aviso>
        )}

        <Campo
          etiqueta="Orden de compra"
          value={ordenCompra}
          onChange={e => setOrdenCompra(e.target.value)}
          pista="Opcional. Se guarda y se imprime, pero no viaja a SUNAT."
        />

        {/* EN DÓLARES, EL TIPO DE CAMBIO (migración 026). SUNAT lo exige en el
            XML; el de venta que publica SUNAT para la fecha de emisión. Desde
            el 17 oct se propone solo y se puede corregir. */}
        {moneda !== 'PEN' && (
          <Campo
            etiqueta="Tipo de cambio"
            obligatorio
            value={tipoCambio}
            onChange={e => setTipoCambio(e.target.value)}
            inputMode="decimal"
            placeholder="3.745"
            autoComplete="off"
            mal={(!!tipoCambio.trim() && !(num(tipoCambio) > 0 && num(tipoCambio) < 100)) || (!tipoCambio.trim() && !!tcFallo)}
            pista={!tipoCambio.trim() && tcFallo ? tcFallo : tcPropuesto && tipoCambio === tcPropuesto
              ? (tcNota ? `${tcNota} Puedes corregirlo.` : 'Propuesto: el de venta que publica SUNAT para la fecha de emisión. Puedes corregirlo.')
              : 'Soles por dólar: el de venta que publica SUNAT para la fecha de emisión, con 3 decimales.'}
          />
        )}
      </div>

      {/* --- Líneas -------------------------------------------------------- */}
      <div className="bloque">
        <h2 className="subtitulo">Qué se vende</h2>

        {lineas.map((l, i) => {
          const bruto = num(l.cantidad) * num(l.valorUnitario)
          const neto  = Math.max(0, bruto - num(l.descuento))

          return (
            <div key={l.clave} className="linea-comprobante">
              <div className="cabecera-linea">
                <span className="numero">{i + 1}</span>
                <BuscadorProducto onElegir={p => ponerProducto(l.clave, p)} />
                {lineas.length > 1 && (
                  <Boton
                    estilo="plano"
                    onClick={() => setLineas(ls => ls.filter(x => x.clave !== l.clave))}
                  >
                    Quitar
                  </Boton>
                )}
              </div>

              <Campo
                etiqueta="Descripción"
                obligatorio
                value={l.descripcion}
                onChange={e => cambiar(l.clave, 'descripcion', e.target.value)}
                pista="Es lo que sale impreso."
              />

              <div className="rejilla-linea">
                <Campo
                  etiqueta="Cantidad"
                  obligatorio
                  value={l.cantidad}
                  onChange={e => cambiar(l.clave, 'cantidad', e.target.value)}
                  inputMode="decimal"
                />

                <label className="campo">
                  <span className="etiqueta">Unidad<Asterisco /></span>
                  <select
                    value={l.unidadMedida}
                    onChange={e => cambiar(l.clave, 'unidadMedida', e.target.value)}
                  >
                    {unidades.map(u => (
                      <option key={u.codigo} value={u.codigo}>{u.codigo}</option>
                    ))}
                  </select>
                </label>

                <Campo
                  etiqueta="Valor unitario"
                  obligatorio
                  value={l.valorUnitario}
                  onChange={e => cambiar(l.clave, 'valorUnitario', e.target.value)}
                  inputMode="decimal"
                  pista="Sin IGV"
                />

                <Campo
                  etiqueta="Descuento"
                  value={l.descuento}
                  onChange={e => cambiar(l.clave, 'descuento', e.target.value)}
                  inputMode="decimal"
                  pista={moneda === 'PEN' ? 'En soles' : 'En dólares'}
                  mal={num(l.descuento) > bruto}
                />

                <label className="campo">
                  <span className="etiqueta">Afectación<Asterisco /></span>
                  {/* Ámbar cuando no coincide con la costumbre del cliente. El
                      aviso de arriba dice qué línea es; esto la señala sin que
                      haya que contar. */}
                  <select
                    className={
                      cliente?.afectacionHabitual &&
                      l.tipoAfectacion !== cliente.afectacionHabitual
                        ? 'desajustada' : undefined
                    }
                    value={l.tipoAfectacion}
                    onChange={e => cambiar(l.clave, 'tipoAfectacion', e.target.value)}
                  >
                    {afectaciones.map(a => (
                      <option key={a.codigo} value={a.codigo}>{a.nombre}</option>
                    ))}
                  </select>
                </label>

                <div className="campo">
                  <span className="etiqueta">Importe</span>
                  <div className="importe-linea mono">{neto.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )
        })}

        <Boton estilo="secundario" onClick={() => setLineas(ls => [...ls, vacia()])}>
          Añadir línea
        </Boton>
      </div>

      {/* --- Totales ------------------------------------------------------- */}
      <div className="bloque">
        <h2 className="subtitulo">Total estimado</h2>

        <dl className="datos totales">
          {totales.descuentos > 0 && (
            <div className="fila">
              <dt>Descuentos</dt>
              <dd className="mono">−{totales.descuentos.toFixed(2)}</dd>
            </div>
          )}
          <div className="fila">
            <dt>Gravado</dt>
            <dd className="mono">{totales.gravado.toFixed(2)}</dd>
          </div>
          {totales.otros > 0 && (
            <div className="fila">
              <dt>Otras operaciones</dt>
              <dd className="mono">{totales.otros.toFixed(2)}</dd>
            </div>
          )}
          <div className="fila">
            <dt>IGV</dt>
            <dd className="mono">{totales.igv.toFixed(2)}</dd>
          </div>
          <div className="fila grande">
            <dt>Total</dt>
            <dd className="mono">{moneda} {totales.total.toFixed(2)}</dd>
          </div>
        </dl>

        {/* LA HONESTIDAD VA EN LA PANTALLA, no solo en un comentario del
            código: quien emite tiene que saber que este número es una
            estimación y que la cifra buena la pone el servicio. */}
        <p className="nota">
          Es una <strong>estimación</strong> para que veas por dónde va. El
          importe que se firma y viaja a SUNAT lo calcula el servicio de
          facturación al emitir, y es el que quedará guardado.
        </p>
      </div>

      {/* --- 040: forma de pago y detracción (solo facturas) ----------------- */}
      {esFactura && (
        <PagoYDetraccion
          moneda={moneda}
          total={totales.total}
          totalSoles={totalSoles}
          tipoCambio={num(tipoCambio)}
          fechaEmision={fechaEmision}
          pago={pago}
          onPago={setPago}
          det={det}
          onDet={setDet}
        />
      )}

      {/* --- 043: a dónde se le manda --------------------------------------- */}
      {cliente && (
        <div className="bloque">
          <h2 className="subtitulo">Envío al cliente</h2>
          <label className="casilla-wsp">
            <input type="checkbox" checked={!!cliente.correo} disabled />
            {cliente.correo ? <>Correo a {cliente.correo}</> : <>Sin correo: no se le manda por correo</>}
          </label>
          {cliente.whatsapp ? (
            <label className={(porWhatsapp ?? !!cliente.whatsappActivo) ? 'casilla-wsp caja-whatsapp' : 'casilla-wsp'}>
              <input type="checkbox" checked={porWhatsapp ?? !!cliente.whatsappActivo}
                     onChange={e => setPorWhatsapp(e.target.checked)} />
              WhatsApp a {whatsappLegible(cliente.whatsapp)}
            </label>
          ) : (
            <p className="nota">Sin WhatsApp guardado. Se puede mandar después, desde el detalle del comprobante.</p>
          )}
          {cliente.whatsapp && (
            <p className="nota">
              {cliente.whatsappActivo
                ? 'Viene marcada porque el cliente lo tiene activado. Desmárcala si este no.'
                : 'El cliente no lo tiene activado: márcala si este sí.'}
              {' '}Al emitir se abre WhatsApp con el mensaje listo: solo pulsas Enviar.
            </p>
          )}
        </div>
      )}

      <div className="acciones-pagina">
        {borradorId && estadoDoc === 'borrador' && (
          <Boton
            estilo="plano"
            onClick={() => void descartar()}
            ocupado={descartando}
            textoOcupado="Descartando…"
            disabled={guardando || emitiendo}
          >
            Descartar borrador
          </Boton>
        )}

        <Boton
          estilo="secundario"
          onClick={() => void guardar()}
          ocupado={guardando}
          textoOcupado="Guardando…"
          disabled={emitiendo}
        >
          Guardar borrador
        </Boton>

        <Boton
          onClick={() => void emitir()}
          ocupado={emitiendo || capa !== undefined}
          textoOcupado="Emitiendo…"
          disabled={!cliente || guardando}
        >
          Emitir
        </Boton>
      </div>

      {confirmacion}

      {capa && (
        <div className="capa-ocupado" role="status" aria-live="assertive" aria-busy="true">
          <div className="capa-ocupado-caja">
            <span className="girador" aria-hidden="true" />
            {capa === 'guardando' ? (
              <p className="texto">Guardando el borrador…</p>
            ) : (
              <>
                <p className="texto">Emitiendo el comprobante…</p>
                <p className="detalle">
                  El servicio de facturación lo está firmando y numerando. Tarda
                  unos segundos. No cierres esta ventana.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}