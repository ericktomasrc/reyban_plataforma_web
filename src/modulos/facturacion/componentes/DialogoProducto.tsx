import { useEffect, useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { Asterisco, Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { productosServicio, type ComponenteKit, type VarianteDeModelo } from '../servicios/facturacionServicio'
import { BuscadorProducto } from './BuscadorProducto'
import { BuscadorCodigoSunat } from './BuscadorCodigoSunat'
import type { CatalogosSunat, Presentacion, ProductoEnLista } from '../tipos'
import { inventarioServicio, type Categoria, type MinimoEnSucursal } from '../../inventario/servicios/inventarioServicio'

interface Props {
  producto?: ProductoEnLista
  /** e165: datos para empezar un producto NUEVO (desde una línea libre). */
  inicial?: Partial<ProductoEnLista>
  catalogos: CatalogosSunat
  onCerrar: () => void
  /** e174: también el código con el que quedó (para marcar la línea «en tus productos»). */
  onGuardado: (mensaje: string, codigo?: string) => void
}

export function DialogoProducto({ producto, inicial, catalogos, onCerrar, onGuardado }: Props) {
  const editando = producto !== undefined

  const [codigo, setCodigo]   = useState(producto?.codigo ?? inicial?.codigo ?? '')
  const [desc, setDesc]       = useState(producto?.descripcion ?? inicial?.descripcion ?? '')
  const [unidad, setUnidad]   = useState(producto?.unidadMedida ?? inicial?.unidadMedida ?? 'NIU')
  const [afectacion, setAfectacion] = useState(producto?.tipoAfectacion ?? inicial?.tipoAfectacion ?? '10')
  const [precio, setPrecio]   = useState(String(producto?.precioUnitario ?? inicial?.precioUnitario ?? ''))
  const [conIgv, setConIgv]   = useState(producto?.incluyeIgv ?? inicial?.incluyeIgv ?? true)
  const [codSunat, setCodSunat] = useState(producto?.codigoSunat ?? '')
  // e179 (060): el costo sin IGV, a mano (opcional).
  const [costo, setCosto] = useState(producto?.costo != null ? String(producto.costo) : '')

  // 052: inventario. Marcado de fábrica en los bienes; un servicio nunca.
  const [controla, setControla] = useState(producto?.controlaStock ?? inicial?.controlaStock ?? (producto?.unidadMedida ?? inicial?.unidadMedida ?? 'NIU') !== 'ZZ')
  const [categoriaId, setCategoriaId] = useState(producto?.categoriaId ?? '')
  // 064: lotes y vencimientos (solo en lo que controla stock).
  const [lotes, setLotes] = useState(producto?.manejaLotes ?? false)
  // 065: números de serie.
  const [conSeries, setConSeries] = useState(producto?.manejaSeries ?? false)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [encendido, setEncendido] = useState(false)
  const [minimos, setMinimos] = useState<MinimoEnSucursal[]>([])
  const [minimosTexto, setMinimosTexto] = useState<Record<string, string>>({})
  const esServicio = unidad === 'ZZ'

  // 061: las presentaciones (caja, paquete, saco…). Se guardan con el producto.
  const [pres, setPres] = useState<FilaPres[]>([])
  const [presOriginal, setPresOriginal] = useState('[]')
  useEffect(() => {
    if (!producto) return
    let vivo = true
    productosServicio.presentaciones(producto.id)
      .then(l => { if (!vivo) return; const f = l.map(aFila); setPres(f); setPresOriginal(JSON.stringify(f)) })
      .catch(() => { /* sin presentaciones */ })
    return () => { vivo = false }
  }, [producto])
  const cambiarPres = (i: number, c: Partial<FilaPres>) => setPres(ps => ps.map((x, j) => j === i ? { ...x, ...c } : x))

  // 062: kit o combo y sus componentes.
  const [esKit, setEsKit] = useState(producto?.esKit ?? false)
  const [comps, setComps] = useState<(ComponenteKit & { texto: string })[]>([])
  const [compsOriginal, setCompsOriginal] = useState('[]')
  useEffect(() => {
    if (!producto?.esKit) return
    let vivo = true
    productosServicio.componentes(producto.id)
      .then(l => { if (!vivo) return; const f = l.map(c => ({ ...c, texto: String(c.cantidad) })); setComps(f); setCompsOriginal(JSON.stringify(f)) })
      .catch(() => { /* sin componentes */ })
    return () => { vivo = false }
  }, [producto])
  const kit = esKit && !esServicio

  // 063: modelo con variantes (talla, color…). Cada variante es un producto.
  const [esModelo, setEsModelo] = useState(producto?.esModelo ?? false)
  const modelo = esModelo && !esServicio && !kit && !producto?.padreId
  const [variantes, setVariantes] = useState<VarianteDeModelo[]>([])
  const [atribs, setAtribs] = useState<{ nombre: string; valores: string }[]>([{ nombre: 'Talla', valores: '' }, { nombre: 'Color', valores: '' }])
  const [generando, setGenerando] = useState(false)
  useEffect(() => {
    if (!producto?.esModelo) return
    let vivo = true
    productosServicio.variantes(producto.id).then(v => { if (vivo) setVariantes(v) }).catch(() => { /* sin variantes */ })
    return () => { vivo = false }
  }, [producto])
  const atributosParaEnviar = () => atribs
    .map(a => ({ nombre: a.nombre.trim(), valores: a.valores.split(',').map(v => v.trim()).filter(Boolean) }))
    .filter(a => a.nombre && a.valores.length > 0)
  const combinaciones = atributosParaEnviar().reduce((n, a) => n * a.valores.length, 1)
  async function generar(id: string) {
    const atributos = atributosParaEnviar()
    if (atributos.length === 0) return
    setGenerando(true)
    try {
      const r = await productosServicio.generarVariantes(id, { atributos })
      mensaje.bien(r.mensaje)
      setVariantes(await productosServicio.variantes(id))
      setAtribs(a => a.map(x => ({ ...x, valores: '' })))
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudieron crear las variantes.')
    } finally {
      setGenerando(false)
    }
  }

  useEffect(() => {
    let vivo = true
    inventarioServicio.categorias().then(c => { if (vivo) setCategorias(c) }).catch(() => { /* sin categorías */ })
    inventarioServicio.estado().then(e => { if (vivo) setEncendido(e.encendido && e.contratado !== false) }).catch(() => { /* sin inventario */ })
    if (producto) {
      inventarioServicio.minimos(producto.id)
        .then(m => {
          if (!vivo) return
          setMinimos(m)
          setMinimosTexto(Object.fromEntries(m.map(x => [x.sucursalId, x.minimo === null ? '' : String(x.minimo)])))
        })
        .catch(() => { /* sin mínimos */ })
    }
    return () => { vivo = false }
  }, [producto])

  const mensaje = useMensaje()
  const [guardando, setGuardando] = useState(false)

  const valor = Number(precio.replace(',', '.'))
  const valido = precio.trim() !== '' && Number.isFinite(valor) && valor >= 0

  /**
   * El otro precio, para que se vea lo que se está guardando.
   *
   * ES EL ERROR MÁS COMÚN DE ESTA PANTALLA: escribir 118 pensando en el precio
   * de mostrador y marcar «sin IGV», o al revés. Enseñar el otro número al lado
   * lo hace evidente sin tener que explicar nada.
   *
   * SOLO SIRVE PARA MIRAR. Lo que va al comprobante lo calcula el servicio de
   * facturación, que es quien sabe de redondeos y de afectaciones.
   */
  const otro = valido
    ? conIgv ? valor / 1.18 : valor * 1.18
    : 0

  const gravado = afectacion === '10'

  async function enviar(e: React.FormEvent) {
    e.preventDefault()

    if (!valido) {
      mensaje.error('El precio tiene que ser un número.')
      return
    }

    // 061: cada presentación con nombre y cuántas unidades trae.
    const presMal = pres.find(x => !x.nombre.trim() || !(numPres(x.factor) > 0) || (x.precio.trim() !== '' && !(numPres(x.precio) > 0)))
    if (!esServicio && presMal) {
      mensaje.error('Revisa las presentaciones: cada una lleva nombre y cuántas unidades trae (y, si pones precio, mayor que cero).')
      return
    }

    // 062: un kit lleva al menos un componente, cada uno con cantidad.
    if (kit && (comps.length === 0 || comps.some(c => !(numPres(c.texto) > 0)))) {
      mensaje.error(comps.length === 0 ? 'Agrega los productos de los que está hecho el kit.' : 'Cada componente del kit lleva una cantidad mayor que cero.')
      return
    }

    setGuardando(true)

    const datos = {
      codigo: codigo.trim(),
      descripcion: desc.trim(),
      unidadMedida: unidad,
      tipoAfectacion: afectacion,
      precioUnitario: valor,
      incluyeIgv: conIgv,
      codigoSunat: codSunat.trim() || null,
      controlaStock: esServicio || kit || modelo ? false : controla,   // 052 (062/063: kit y modelo no tienen stock propio)
      esKit: kit,                                            // 062
      esModelo: modelo,                                      // 063
      manejaLotes: !esServicio && !kit && !modelo && controla && lotes,   // 064
      manejaSeries: !esServicio && !kit && !modelo && controla && conSeries,   // 065
      categoriaId: categoriaId || null,
      // e179: vacío al editar = quitarlo (0); al crear, sin costo.
      costo: costo.trim() === '' ? (editando ? 0 : null) : Number(costo.replace(',', '.')),
    }

    try {
      if (editando) {
        const r = await productosServicio.editar(producto.id, datos)
        // 052: el mínimo por sucursal (solo si cambió).
        const cambios = minimos
          .map(m => ({ sucursalId: m.sucursalId, minimo: (minimosTexto[m.sucursalId] ?? '').trim() === '' ? null : Number(minimosTexto[m.sucursalId].replace(',', '.')) }))
          .filter(m => m.minimo === null || Number.isFinite(m.minimo))
        if (encendido && controla && cambios.some(c => c.minimo !== (minimos.find(m => m.sucursalId === c.sucursalId)?.minimo ?? null)))
          await inventarioServicio.guardarMinimos(producto.id, cambios)
        if (!esServicio && JSON.stringify(pres) !== presOriginal)
          await productosServicio.guardarPresentaciones(producto.id, pres.map(x => aEnvio(x, conIgv)))   // 061
        if (kit && JSON.stringify(comps) !== compsOriginal)
          await productosServicio.guardarComponentes(producto.id, comps.map(c => ({ componenteId: c.componenteId, cantidad: numPres(c.texto) })))   // 062
        onGuardado(r.mensaje, datos.codigo)
      } else {
        const r = await productosServicio.crear(datos)
        if (!esServicio && pres.length > 0)
          await productosServicio.guardarPresentaciones(r.id, pres.map(x => aEnvio(x, conIgv)))   // 061
        if (kit)
          await productosServicio.guardarComponentes(r.id, comps.map(c => ({ componenteId: c.componenteId, cantidad: numPres(c.texto) })))   // 062
        if (modelo && atributosParaEnviar().length > 0) await generar(r.id)   // 063
        onGuardado(`${r.codigo} ya está en tu catálogo.`, r.codigo)
      }
    } catch (err) {
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo guardar el producto.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      titulo={editando ? `Editar ${producto.codigo}` : 'Nuevo producto'}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" form="producto" ocupado={guardando} textoOcupado="Guardando…">
            {editando ? 'Guardar' : 'Crear producto'}
          </Boton>
        </>
      }
    >
      <form id="producto" onSubmit={enviar}>

        <div className="pareja">
          <Campo
            etiqueta="Código"
            obligatorio
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            maxLength={30}
            pista="Con esto lo buscarás al facturar."
            autoFocus
          />

          <label className="campo">
            <span className="etiqueta">Unidad de medida<Asterisco /></span>
            <select value={unidad} onChange={e => setUnidad(e.target.value)}>
              {catalogos.unidades.map(u => (
                <option key={u.codigo} value={u.codigo}>{u.nombre} ({u.codigo})</option>
              ))}
            </select>
          </label>
        </div>

        <Campo
          etiqueta="Descripción"
          obligatorio
          value={desc}
          onChange={e => setDesc(e.target.value)}
          pista="Es lo que sale impreso en la factura."
        />

        <label className="campo">
          <span className="etiqueta">Afectación del IGV<Asterisco /></span>
          <select value={afectacion} onChange={e => setAfectacion(e.target.value)}>
            {catalogos.afectaciones.map(a => (
              <option key={a.codigo} value={a.codigo}>{a.nombre}</option>
            ))}
          </select>
          {afectacion === '17' && (
            <span className="pista">
              El arroz pilado va en su propio comprobante: no se puede mezclar
              con líneas gravadas.
            </span>
          )}
        </label>

        <div className="pareja">
          <Campo
            etiqueta="Precio unitario"
            obligatorio
            value={precio}
            onChange={e => setPrecio(e.target.value)}
            inputMode="decimal"
            mal={precio.trim() !== '' && !valido}
          />

          <label className="campo">
            <span className="etiqueta">Ese precio…<Asterisco /></span>
            <select value={conIgv ? 'si' : 'no'} onChange={e => setConIgv(e.target.value === 'si')}>
              <option value="si">Ya incluye IGV</option>
              <option value="no">Es sin IGV</option>
            </select>
          </label>
        </div>

        {/* El otro precio, al lado. Es lo que convierte un error silencioso en
            uno evidente: 118 con IGV son 100 sin él, y al revés. */}
        {valido && valor > 0 && gravado && (
          <p className="nota">
            {conIgv
              ? <>Sin IGV serían <strong>{otro.toFixed(4)}</strong>. Es lo que viajará al comprobante.</>
              : <>Con IGV se cobraría <strong>{otro.toFixed(2)}</strong>. Es lo que verá el cliente.</>}
          </p>
        )}

        {valido && valor > 0 && !gravado && (
          <p className="nota">
            Con esta afectación no se calcula IGV, así que da igual cuál de las
            dos opciones elijas.
          </p>
        )}

        {/* e179 (060): para el margen, mientras el inventario no dé el costo real. */}
        <Campo
          etiqueta="Costo unitario sin IGV (opcional)"
          value={costo}
          onChange={e => setCosto(e.target.value)}
          inputMode="decimal"
          mal={costo.trim() !== '' && !(Number(costo.replace(',', '.')) >= 0)}
          pista="Lo que te cuesta a ti. Sirve para ver tu margen. Con inventario, el costo real sale de tus compras."
        />

        {/* 063: modelo con variantes. */}
        {!esServicio && !kit && !producto?.padreId && (
          <label className="casilla">
            <input type="checkbox" checked={esModelo} disabled={editando && !!producto?.esModelo && variantes.length > 0}
                   onChange={e => setEsModelo(e.target.checked)} />
            <span>
              <strong>Tiene variantes (talla, color…)</strong>
              <em>Este es el modelo; se venden sus variantes. Cada variante es un producto con su código, precio y stock.</em>
            </span>
          </label>
        )}
        {producto?.padreId && producto.atributos && (
          <p className="nota">Variante: {Object.entries(producto.atributos).map(([k, v]) => `${k} ${v}`).join(' · ')}.</p>
        )}
        {modelo && (
          <div className="presentaciones-editor">
            {variantes.length > 0 && (
              <>
                <span className="etiqueta">Sus variantes ({variantes.length})</span>
                <div className="variantes-lista">
                  {variantes.map(v => (
                    <div key={v.id} className={v.activo ? 'variante-fila' : 'variante-fila apagada'}>
                      <span className="mono">{v.codigo}</span>
                      <span>{v.atributos ? Object.entries(v.atributos).map(([k, x]) => `${k} ${x}`).join(' · ') : v.descripcion}</span>
                      <span className="mono der">{v.precioUnitario.toFixed(2)}</span>
                      <span className="secundario der">{v.disponible == null ? '—' : `hay ${v.disponible.toLocaleString('es-PE', { maximumFractionDigits: 4 })}`}</span>
                    </div>
                  ))}
                </div>
                <p className="pista">Cada variante se edita como cualquier producto (precio, código de barras, stock mínimo) desde la lista de Productos.</p>
              </>
            )}
            <span className="etiqueta">{variantes.length > 0 ? 'Agregar combinaciones' : 'Crear las variantes'}</span>
            {atribs.map((a, i) => (
              <div key={i} className="atributo-fila">
                <input value={a.nombre} placeholder="Atributo (Talla)" maxLength={20} aria-label={`Atributo ${i + 1}`}
                       onChange={e => setAtribs(xs => xs.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} />
                <input value={a.valores} placeholder="Valores separados por coma: S, M, L, XL" aria-label={`Valores del atributo ${i + 1}`}
                       onChange={e => setAtribs(xs => xs.map((x, j) => j === i ? { ...x, valores: e.target.value } : x))} />
              </div>
            ))}
            {atribs.length < 3 && <button type="button" className="enlace" onClick={() => setAtribs(xs => [...xs, { nombre: '', valores: '' }])}>+ Otro atributo</button>}
            {atributosParaEnviar().length > 0 && (
              editando
                ? <Boton estilo="secundario" ocupado={generando} disabled={combinaciones > 200} onClick={() => void generar(producto!.id)}>
                    Crear las combinaciones que faltan ({combinaciones})
                  </Boton>
                : <p className="pista">Al guardar se crean {combinaciones} variante{combinaciones === 1 ? '' : 's'} con el precio del modelo.</p>
            )}
            {combinaciones > 200 && <p className="pista">Son demasiadas: hasta 200 combinaciones.</p>}
          </div>
        )}

        {/* 062: kit o combo. */}
        {!esServicio && !modelo && (
          <label className="casilla">
            <input type="checkbox" checked={esKit} onChange={e => setEsKit(e.target.checked)} />
            <span>
              <strong>Es un kit o combo</strong>
              <em>Se vende como uno, pero está hecho de otros productos. No tiene stock propio: venderlo descuenta sus componentes.</em>
            </span>
          </label>
        )}
        {kit && (
          <div className="presentaciones-editor">
            <span className="etiqueta">De qué está hecho (por cada kit)</span>
            {comps.map((c, i) => (
              <div key={c.componenteId} className="componente-fila">
                <span>
                  <span className="principal">{c.descripcion}</span>
                  <span className="secundario mono"> {c.codigo}{!c.controlaStock && ' · no controla stock'}</span>
                </span>
                <label className="campo">
                  <span className="solo-lector">Cantidad de {c.descripcion}</span>
                  <input className="mono" inputMode="decimal" value={c.texto} aria-invalid={!(numPres(c.texto) > 0)}
                         onChange={e => setComps(cs => cs.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))} />
                </label>
                <span className="secundario">{c.unidadMedida}</span>
                <button type="button" className="enlace" onClick={() => setComps(cs => cs.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            ))}
            <BuscadorProducto placeholder="+ Agregar componente (código o nombre)…"
              onElegir={p => {
                if (p.esKit) { mensaje.error('Un kit no lleva otro kit: agrega sus productos directamente.'); return }
                if (p.id === producto?.id) return
                setComps(cs => cs.some(x => x.componenteId === p.id) ? cs
                  : [...cs, { componenteId: p.id, codigo: p.codigo, descripcion: p.descripcion, unidadMedida: p.unidadMedida, cantidad: 1, controlaStock: p.controlaStock !== false, texto: '1' }])
              }} />
          </div>
        )}

        {/* 061: presentaciones (unidad de compra o de venta distinta a la del producto). */}
        {!esServicio && !modelo && (
          <div className="presentaciones-editor">
            <span className="etiqueta">Presentaciones (opcional)</span>
            <p className="pista">
              Si lo compras o vendes también por caja, paquete o saco. El stock se sigue contando en {unidad}:
              vender 1 caja de 12 descuenta 12.
            </p>
            {pres.map((x, i) => {
              const f = numPres(x.factor)
              const sugerido = valido && f > 0 ? valor * f : 0
              return (
                <div key={x.clave} className="presentacion-fila">
                  <label className="campo">
                    <span className="etiqueta">Nombre</span>
                    <input value={x.nombre} maxLength={60} placeholder="Caja x 12" onChange={e => cambiarPres(i, { nombre: e.target.value })} />
                  </label>
                  <label className="campo">
                    <span className="etiqueta">Unidad SUNAT</span>
                    <select value={x.unidadMedida} onChange={e => cambiarPres(i, { unidadMedida: e.target.value })}>
                      {catalogos.unidades.filter(u => u.codigo !== 'ZZ').map(u => <option key={u.codigo} value={u.codigo}>{u.codigo} · {u.nombre}</option>)}
                    </select>
                  </label>
                  <label className="campo">
                    <span className="etiqueta">Trae ({unidad})</span>
                    <input className="mono" inputMode="decimal" value={x.factor} placeholder="12" aria-invalid={x.factor !== '' && !(f > 0)}
                           onChange={e => cambiarPres(i, { factor: e.target.value })} />
                  </label>
                  <label className="campo">
                    <span className="etiqueta">Precio {conIgv ? 'con' : 'sin'} IGV</span>
                    <input className="mono" inputMode="decimal" value={x.precio} placeholder={sugerido > 0 ? sugerido.toFixed(2) : 'opcional'}
                           onChange={e => cambiarPres(i, { precio: e.target.value })} />
                  </label>
                  <label className="campo">
                    <span className="etiqueta">Código de barras</span>
                    <input className="mono sin-mayusculas" value={x.codigoBarras} placeholder="opcional" onChange={e => cambiarPres(i, { codigoBarras: e.target.value })} />
                  </label>
                  <div className="presentacion-usos">
                    <label><input type="checkbox" checked={x.paraCompra} onChange={e => cambiarPres(i, { paraCompra: e.target.checked || !x.paraVenta })} /> Compra</label>
                    <label><input type="checkbox" checked={x.paraVenta} onChange={e => cambiarPres(i, { paraVenta: e.target.checked || !x.paraCompra })} /> Venta</label>
                    <button type="button" className="enlace" onClick={() => setPres(ps => ps.filter((_, j) => j !== i))}>Quitar</button>
                  </div>
                </div>
              )
            })}
            <button type="button" className="enlace" onClick={() => setPres(ps => [...ps, filaNueva()])}>+ Agregar presentación</button>
            {pres.length > 0 && <p className="pista">Sin precio, se vende al precio del producto por lo que trae.</p>}
          </div>
        )}

        {/* NO ES UN CÓDIGO QUE SE INVENTE: sale de una lista oficial de SUNAT
            (catálogo 25) que nadie se sabe. Por eso no se escribe: se busca
            por lo que es el producto y se elige. Ver BuscadorCodigoSunat. */}
        <BuscadorCodigoSunat valor={codSunat} onCambiar={setCodSunat} descripcion={desc} />

        {/* 052: inventario */}
        {categorias.length > 0 && (
          <label className="campo">
            <span className="etiqueta">Categoría (opcional)</span>
            <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
              <option value="">Sin categoría</option>
              {/* e161: las desactivadas no se ofrecen, salvo la que ya tiene el producto. */}
              {categorias.filter(c => c.activo !== false || c.id === categoriaId).map(c => (
                <option key={c.id} value={c.id}>{c.nombre}{c.activo === false ? ' (desactivada)' : ''}</option>
              ))}
            </select>
          </label>
        )}
        {/* e174: sin inventario la casilla no se ve. Por dentro un bien sigue
            marcado, así el día que se active el inventario ya está listo. */}
        {encendido && !kit && !modelo && <label className={`casilla${esServicio ? ' deshabilitada' : ''}`}>
          <input type="checkbox" checked={!esServicio && controla} disabled={esServicio} onChange={e => setControla(e.target.checked)} />
          <span>
            <strong>Controla stock</strong>
            <em>{esServicio
              ? 'Los servicios no tienen stock.'
              : 'Marcado de fábrica en los productos que no son servicio. Desmárcalo si no quieres contarlo (por ejemplo, algo que pides a pedido).'}</em>
          </span>
        </label>}
        {/* 064: lotes y vencimientos (farmacias, alimentos). */}
        {encendido && controla && !esServicio && !kit && !modelo && (
          <label className="casilla">
            <input type="checkbox" checked={lotes} onChange={e => setLotes(e.target.checked)} />
            <span>
              <strong>Maneja lotes y vencimientos</strong>
              <em>Al comprar escribes el lote y su vencimiento; al vender sale primero lo que vence antes. Lo que ya hay queda «sin lote».</em>
            </span>
          </label>
        )}
        {/* 065: números de serie (celulares, motores, electrodomésticos). */}
        {encendido && controla && !esServicio && !kit && !modelo && (
          <label className="casilla">
            <input type="checkbox" checked={conSeries} onChange={e => setConSeries(e.target.checked)} />
            <span>
              <strong>Maneja números de serie</strong>
              <em>Al comprar escribes el número de cada unidad; al vender eliges cuáles. Sirve para las garantías.</em>
            </span>
          </label>
        )}
        {editando && encendido && controla && !esServicio && minimos.length > 0 && (
          <>
            <span className="etiqueta">Stock mínimo por sucursal (opcional)</span>
            <div className="pareja">
              {minimos.map(m => (
                <label key={m.sucursalId} className="campo">
                  <span className="etiqueta">{m.codigo} {m.nombre}</span>
                  <input className="mono" inputMode="decimal" value={minimosTexto[m.sucursalId] ?? ''} placeholder="sin mínimo"
                         onChange={e => setMinimosTexto(x => ({ ...x, [m.sucursalId]: e.target.value }))} />
                  <span className="pista">Hay {m.disponible.toLocaleString('es-PE', { maximumFractionDigits: 4 })} disponibles</span>
                </label>
              ))}
            </div>
          </>
        )}
        {encendido && editando && producto.controlaStock && !controla && !esServicio && (
          <p className="nota se-aplica">Se aplica: si desmarcas un producto que ya tiene movimientos, su kardex se guarda pero deja de contarse y de bloquear.</p>
        )}

        <p className="nota">
          Desde el <strong>1 de enero de 2027</strong>, si lo pones tiene que ser
          uno de la lista de SUNAT: uno que no está hace rechazar el
          comprobante. Por eso aquí solo se puede elegir de ella.
        </p>

        {editando && (
          <p className="nota">
            Cambiar el precio <strong>no toca lo ya facturado</strong>: cada
            comprobante lleva copiado el precio del día que se emitió.
          </p>
        )}
      </form>
    </Dialogo>
  )
}


// --- 061: una presentación mientras se edita ------------------------------------
interface FilaPres {
  clave: string
  id: string | null
  nombre: string
  unidadMedida: string
  factor: string
  precio: string
  codigoBarras: string
  paraCompra: boolean
  paraVenta: boolean
}
const numPres = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const aFila = (p: Presentacion): FilaPres => ({
  clave: p.id, id: p.id, nombre: p.nombre, unidadMedida: p.unidadMedida, factor: String(p.factor),
  precio: p.precioUnitario == null ? '' : String(p.precioUnitario), codigoBarras: p.codigoBarras ?? '',
  paraCompra: p.paraCompra, paraVenta: p.paraVenta,
})
const filaNueva = (): FilaPres => ({
  clave: crypto.randomUUID(), id: null, nombre: '', unidadMedida: 'BX', factor: '', precio: '', codigoBarras: '',
  paraCompra: true, paraVenta: true,
})
/** El precio de la presentación se escribe como el del producto (con o sin IGV). */
const aEnvio = (x: FilaPres, conIgv: boolean) => ({
  id: x.id, nombre: x.nombre.trim(), unidadMedida: x.unidadMedida, factor: numPres(x.factor),
  precioUnitario: x.precio.trim() === '' ? null : numPres(x.precio), incluyeIgv: conIgv,
  codigoBarras: x.codigoBarras.trim() || null, paraCompra: x.paraCompra, paraVenta: x.paraVenta,
})