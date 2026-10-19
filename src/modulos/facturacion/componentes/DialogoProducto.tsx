import { useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { Asterisco, Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { productosServicio } from '../servicios/facturacionServicio'
import { BuscadorCodigoSunat } from './BuscadorCodigoSunat'
import type { CatalogosSunat, ProductoEnLista } from '../tipos'

interface Props {
  producto?: ProductoEnLista
  catalogos: CatalogosSunat
  onCerrar: () => void
  onGuardado: (mensaje: string) => void
}

export function DialogoProducto({ producto, catalogos, onCerrar, onGuardado }: Props) {
  const editando = producto !== undefined

  const [codigo, setCodigo]   = useState(producto?.codigo ?? '')
  const [desc, setDesc]       = useState(producto?.descripcion ?? '')
  const [unidad, setUnidad]   = useState(producto?.unidadMedida ?? 'NIU')
  const [afectacion, setAfectacion] = useState(producto?.tipoAfectacion ?? '10')
  const [precio, setPrecio]   = useState(String(producto?.precioUnitario ?? ''))
  const [conIgv, setConIgv]   = useState(producto?.incluyeIgv ?? true)
  const [codSunat, setCodSunat] = useState(producto?.codigoSunat ?? '')

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
    }

    try {
      if (editando) {
        const r = await productosServicio.editar(producto.id, datos)
        onGuardado(r.mensaje)
      } else {
        const r = await productosServicio.crear(datos)
        onGuardado(`${r.codigo} ya está en tu catálogo.`)
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