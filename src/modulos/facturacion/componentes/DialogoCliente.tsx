import { useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { Asterisco, Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { clientesServicio } from '../servicios/facturacionServicio'
import type { CatalogosSunat, ClienteEnLista } from '../tipos'

interface Props {
  /** Sin valor, es un alta. */
  cliente?: ClienteEnLista

  /**
   * Los del back. Hacen falta para el desplegable de afectación habitual, y se
   * reciben ya cargados en vez de pedirlos aquí: la pantalla de clientes los
   * necesita también para pintar la columna, y pedirlos dos veces sería una
   * llamada de más por cada alta.
   */
  catalogos: CatalogosSunat

  onCerrar: () => void
  onGuardado: (mensaje: string) => void
}

/**
 * Los tipos de documento del catálogo 06, con nombre.
 *
 * SOLO LOS CINCO QUE SE USAN. El catálogo tiene doce y los otros siete
 * —carné diplomático, cédula del Mercosur, TIN, IN— aparecen en exportación y
 * casi nunca. Un desplegable de doce opciones para elegir siempre la segunda
 * es peor que uno de cinco.
 */
const TIPOS = [
  { codigo: '6', nombre: 'RUC' },
  { codigo: '1', nombre: 'DNI' },
  { codigo: '4', nombre: 'Carné de extranjería' },
  { codigo: '7', nombre: 'Pasaporte' },
  { codigo: '0', nombre: 'Sin documento' },
]

export function DialogoCliente({ cliente, catalogos, onCerrar, onGuardado }: Props) {
  const editando = cliente !== undefined

  const [tipo, setTipo]       = useState(cliente?.tipoDocumento ?? '6')
  const [numero, setNumero]   = useState(cliente?.numeroDocumento ?? '')
  const [razon, setRazon]     = useState(cliente?.razonSocial ?? '')
  const [comercial, setComercial] = useState(cliente?.nombreComercial ?? '')
  const [direccion, setDireccion] = useState(cliente?.direccion ?? '')
  const [ubigeo, setUbigeo]   = useState(cliente?.ubigeo ?? '')
  const [correo, setCorreo]   = useState(cliente?.correo ?? '')
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '')
  const [afectacion, setAfectacion] = useState(cliente?.afectacionHabitual ?? '')

  const mensaje = useMensaje()
  const [guardando, setGuardando] = useState(false)

  const largoEsperado = tipo === '6' ? 11 : tipo === '1' ? 8 : 0

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)

    const datos = {
      tipoDocumento: tipo,
      numeroDocumento: numero.trim(),
      razonSocial: razon.trim(),
      nombreComercial: comercial.trim() || null,
      direccion: direccion.trim() || null,
      ubigeo: ubigeo.trim() || null,
      correo: correo.trim() || null,
      telefono: telefono.trim() || null,
      afectacionHabitual: afectacion || null,
    }

    try {
      if (editando) {
        const r = await clientesServicio.editar(cliente.id, datos)
        onGuardado(r.mensaje)
      } else {
        const r = await clientesServicio.crear(datos)
        onGuardado(`${r.razonSocial} ya está en tu lista de clientes.`)
      }
    } catch (err) {
      // El back comprueba el dígito verificador del RUC y devuelve un mensaje
      // que dice exactamente qué revisar. Se pasa tal cual.
      mensaje.error(err instanceof ErrorApi ? err.message : 'No se pudo guardar el cliente.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      titulo={editando ? `Editar a ${cliente.razonSocial}` : 'Nuevo cliente'}
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" form="cliente" ocupado={guardando} textoOcupado="Guardando…">
            {editando ? 'Guardar' : 'Crear cliente'}
          </Boton>
        </>
      }
    >
      <form id="cliente" onSubmit={enviar}>

        <div className="pareja">
          <label className="campo">
            <span className="etiqueta">Tipo de documento<Asterisco /></span>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPOS.map(t => (
                <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
              ))}
            </select>
          </label>

          <Campo
            etiqueta="Número"
            obligatorio
            value={numero}
            onChange={e => setNumero(e.target.value.replace(/[^0-9A-Za-z]/g, ''))}
            inputMode={tipo === '6' || tipo === '1' ? 'numeric' : 'text'}
            maxLength={20}
            pista={
              largoEsperado > 0
                ? `${numero.length} de ${largoEsperado} dígitos`
                : 'Sin guiones ni espacios'
            }
            mal={largoEsperado > 0 && numero.length > 0 && numero.length !== largoEsperado}
            autoFocus
          />
        </div>

        <Campo
          etiqueta="Razón social"
          obligatorio
          value={razon}
          onChange={e => setRazon(e.target.value)}
          pista="Tal como tiene que salir impreso en el comprobante."
        />

        <Campo
          etiqueta="Nombre comercial"
          value={comercial}
          onChange={e => setComercial(e.target.value)}
          pista="Opcional. Por si lo conoces por otro nombre que el de su ficha."
        />

        <Campo
          etiqueta="Dirección"
          value={direccion}
          onChange={e => setDireccion(e.target.value)}
        />

        <div className="pareja">
          <Campo
            etiqueta="Ubigeo"
            value={ubigeo}
            onChange={e => setUbigeo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            pista="Seis dígitos. Opcional."
          />

          <Campo
            etiqueta="Teléfono"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
          />
        </div>

        {/* OBLIGATORIO, y no es rigor de formulario: es a donde se le manda
            el comprobante. Un cliente sin correo es una factura que se emite,
            se firma, llega a SUNAT y no llega a quien la pagó. */}
        <Campo
          etiqueta="Correo"
          type="email"
          obligatorio
          value={correo}
          onChange={e => setCorreo(e.target.value)}
          pista="A donde se le mandará su comprobante."
        />

        {/* LA AFECTACIÓN VIVE AQUÍ Y NO SOLO EN EL PRODUCTO porque no es una
            propiedad de lo que vendes: es de la operación, y la operación la
            define a quién le vendes. Las mismas zapatillas van gravadas a un
            cliente de Lima y de exportación a uno de Miami.

            Se escribe una vez, al dar de alta al cliente, y a partir de ahí
            nadie tiene que acordarse al facturar. */}
        <label className="campo">
          <span className="etiqueta">Afectación habitual del IGV</span>
          <select value={afectacion} onChange={e => setAfectacion(e.target.value)}>
            <option value="">Sin preferencia — manda la del producto</option>
            {catalogos.afectaciones.map(a => (
              <option key={a.codigo} value={a.codigo}>{a.nombre}</option>
            ))}
          </select>
          <span className="pista">
            Opcional. Si este cliente siempre va igual —exportación, Amazonía—,
            ponlo aquí y sus líneas entrarán así solas. Se puede cambiar en
            cualquier línea: esto avisa, no obliga.
          </span>
        </label>

        {editando && (
          <p className="nota">
            Cambiar estos datos <strong>no toca los comprobantes ya emitidos</strong>:
            cada uno lleva copiados los datos del receptor tal como estaban ese
            día, que es lo correcto tributariamente.
          </p>
        )}
      </form>
    </Dialogo>
  )
}