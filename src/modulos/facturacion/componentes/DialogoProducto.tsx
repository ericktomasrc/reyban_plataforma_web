import { useEffect, useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { Asterisco, Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { productosServicio } from '../servicios/facturacionServicio'
import { BuscadorCodigoSunat } from './BuscadorCodigoSunat'
import type { CatalogosSunat, ProductoEnLista } from '../tipos'
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

  // 052: inventario. Marcado de fábrica en los bienes; un servicio nunca.
  const [controla, setControla] = useState(producto?.controlaStock ?? inicial?.controlaStock ?? (producto?.unidadMedida ?? inicial?.unidadMedida ?? 'NIU') !== 'ZZ')
  const [categoriaId, setCategoriaId] = useState(producto?.categoriaId ?? '')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [encendido, setEncendido] = useState(false)
  const [minimos, setMinimos] = useState<MinimoEnSucursal[]>([])
  const [minimosTexto, setMinimosTexto] = useState<Record<string, string>>({})
  const esServicio = unidad === 'ZZ'

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

    setGuardando(true)

    const datos = {
      codigo: codigo.trim(),
      descripcion: desc.trim(),
      unidadMedida: unidad,
      tipoAfectacion: afectacion,
      precioUnitario: valor,
      incluyeIgv: conIgv,
      codigoSunat: codSunat.trim() || null,
      controlaStock: esServicio ? false : controla,   // 052
      categoriaId: categoriaId || null,
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
        onGuardado(r.mensaje, datos.codigo)
      } else {
        const r = await productosServicio.crear(datos)
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
        {encendido && <label className={`casilla${esServicio ? ' deshabilitada' : ''}`}>
          <input type="checkbox" checked={!esServicio && controla} disabled={esServicio} onChange={e => setControla(e.target.checked)} />
          <span>
            <strong>Controla stock</strong>
            <em>{esServicio
              ? 'Los servicios no tienen stock.'
              : 'Marcado de fábrica en los productos que no son servicio. Desmárcalo si no quieres contarlo (por ejemplo, algo que pides a pedido).'}</em>
          </span>
        </label>}
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