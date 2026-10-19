import { useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { credencialesServicio } from '../../facturacion/servicios/facturacionServicio'
import { empresasServicio } from '../servicios/empresasServicio'
import { SelectorUbigeo, buscarUbigeo } from '../../../nucleo/ubigeo/SelectorUbigeo'
import { noActiva, noHabida, useFichaRuc } from '../../../nucleo/sunat/useFichaRuc'
import type { EmpresaCreada, ModuloDelCatalogo } from '../tipos'

interface Props {
  abierto: boolean
  modulos: ModuloDelCatalogo[]
  onCerrar: () => void

  /**
   * Se llama con el resultado para que la lista se recargue. `confirmada` dice
   * si el servicio recibió la confirmación del alta (si no, se reintenta sola).
   */
  onCreada: (resultado: EmpresaCreada, confirmada: boolean) => void
}

const VACIO = {
  ruc: '',
  razonSocial: '',
  nombreComercial: '',
  nombre: '',
  direccion: '',
  ubigeo: '',
  distrito: '',
  provincia: '',
  departamento: '',
  correoAdministrador: '',
  nombreAdministrador: '',
  horasInvitacion: '24',
}

/** El módulo que NO se da en el alta: se activa cuando el emisor está listo. */
const FACTURACION = 'facturacion'

// El departamento ya no se compara con el ubigeo aquí: los dos salen de la
// misma lista (SelectorUbigeo), así que no pueden dejar de cuadrar.

/** El dígito verificador del RUC (módulo 11), el mismo cálculo que SUNAT y el back. */
function problemaRuc(ruc: string): string | null {
  if (!/^\d{11}$/.test(ruc)) return 'El RUC son 11 dígitos.'
  if (!['10', '15', '16', '17', '20'].includes(ruc.slice(0, 2)))
    return 'Un RUC empieza por 10, 15, 16, 17 o 20.'

  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((s, p, i) => s + p * Number(ruc[i]), 0)
  let digito = 11 - (suma % 11)
  if (digito === 10) digito = 0
  if (digito === 11) digito = 1

  return digito === Number(ruc[10])
    ? null
    : 'Ese RUC no existe: el último dígito no cuadra. Revisa que esté bien copiado.'
}

/**
 * El alta de un cliente, entera, en un solo formulario — Y SU EMISOR EN EL
 * SERVICIO (parte C).
 *
 * El RUC, la razón social y la dirección se teclean AQUÍ, una vez, y viajan
 * solos al servicio de facturación: allí se crea el emisor (en beta), su clave
 * y su webhook, y la plataforma guarda la clave cifrada. Nada se copia de un
 * panel a otro.
 *
 * DESPUÉS DE CREAR, ESTA PANTALLA CONFIRMA EL ALTA AL SERVICIO, en otra
 * petición: el back solo puede decir «ya está guardado» cuando su transacción
 * terminó. Si esa segunda llamada falla no pasa nada grave: la empresa ya
 * existe, y el alta se confirma sola al volver a preguntar o al día siguiente.
 *
 * LA DIRECCIÓN NO SE QUEDA EN LA PLATAFORMA: vive en el servicio, que es quien
 * la pone en los comprobantes. Por eso se pide entera y bien: el ubigeo tiene
 * que cuadrar con el departamento.
 *
 * LAS COMPROBACIONES DE AQUÍ NO SON LA VALIDACIÓN. Son para no gastar un viaje
 * al servidor por un dedazo. El back las repite, y el servicio otra vez.
 */
export function DialogoAltaEmpresa({ abierto, modulos, onCerrar, onCreada }: Props) {
  const [f, setF] = useState(VACIO)
  const [elegidos, setElegidos] = useState<string[]>([])
  const mensaje = useMensaje()
  const [enviando, setEnviando] = useState(false)

  // El error que devolvió el back o el servicio, en la propia ventana: un 409
  // «ese RUC ya existe» o un «alta en curso» hay que leerlo con calma, no en
  // un aviso que se va solo.
  const [errorEnvio, setErrorEnvio] = useState<string>()

  const escribir = (campo: keyof typeof VACIO) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setF(v => ({ ...v, [campo]: e.target.value }))

  const alternarModulo = (codigo: string) =>
    setElegidos(v => v.includes(codigo) ? v.filter(c => c !== codigo) : [...v, codigo])

  const limpiar = () => {
    setF(VACIO)
    setVuelta(v => v + 1)
    setElegidos([])
    setErrorEnvio(undefined)
  }

  // El ubigeo sale del distrito elegido en las listas (17 oct): no se teclea.
  const ubigeo = f.ubigeo.trim()

  // 18 OCT: con el RUC completo y válido, la ficha de SUNAT llena razón
  // social, dirección y las listas. Se pueden corregir a mano.
  const rucEscrito = f.ruc.trim()
  const { ficha, buscando: buscandoSunat } = useFichaRuc(rucEscrito, problemaRuc(rucEscrito) === null)
  useEffect(() => {
    if (!ficha) return
    const u = ficha.ubigeo ? buscarUbigeo(ficha.ubigeo) : null
    setF(v => ({
      ...v,
      razonSocial: ficha.razonSocial ?? v.razonSocial,
      direccion: ficha.direccion ?? v.direccion,
      ...(u ?? {}),
    }))
  }, [ficha])

  // Al limpiar, las listas vuelven a empezar.
  const [vuelta, setVuelta] = useState(0)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErrorEnvio(undefined)

    const ruc = f.ruc.trim()
    const malRuc = problemaRuc(ruc)
    if (malRuc) { mensaje.error(malRuc); return }
    if (noActiva(ficha)) {
      mensaje.error(`SUNAT tiene este RUC ${ficha?.estado}: una empresa que no está activa no puede emitir.`)
      return
    }

    if (f.razonSocial.trim().length < 3) {
      mensaje.error('Falta la razón social, tal como sale en la ficha RUC.')
      return
    }
    if (f.direccion.trim().length < 3) {
      mensaje.error('Falta la dirección fiscal: calle y número, como en la ficha RUC.')
      return
    }
    if (!/^\d{6}$/.test(ubigeo) || !f.distrito || !f.provincia || !f.departamento) {
      mensaje.error('Elige el departamento, la provincia y el distrito, como en la ficha RUC.')
      return
    }
    if (!f.correoAdministrador.trim()) {
      mensaje.error('Falta el correo del administrador: ahí le llega el enlace para entrar.')
      return
    }

    const horas = Number(f.horasInvitacion)
    if (!Number.isInteger(horas) || horas < 1 || horas > 168) {
      mensaje.error('El plazo del enlace tiene que estar entre 1 y 168 horas.')
      return
    }

    setEnviando(true)
    try {
      const resultado = await empresasServicio.crear({
        nombre: f.nombre.trim() || undefined,
        ruc,
        razonSocial: f.razonSocial.trim(),
        nombreComercial: f.nombreComercial.trim() || undefined,
        direccion: f.direccion.trim(),
        ubigeo,
        distrito: f.distrito.trim(),
        provincia: f.provincia.trim(),
        departamento: f.departamento.trim(),
        correoAdministrador: f.correoAdministrador.trim(),
        nombreAdministrador: f.nombreAdministrador.trim() || 'Administrador',
        modulos: elegidos.filter(c => c !== FACTURACION),
        horasInvitacion: horas,
      })

      // LA CONFIRMACIÓN, EN OTRA PETICIÓN. Si falla, la empresa ya existe:
      // se avisa en ámbar y se confirma sola más tarde.
      let confirmada = false
      try {
        const c = await credencialesServicio.confirmarAlta(resultado.empresa.id)
        confirmada = c.ok && c.alta === 'confirmada'
      } catch {
        confirmada = false
      }

      limpiar()
      onCreada(resultado, confirmada)
    } catch (err) {
      setErrorEnvio(err instanceof ErrorApi ? err.message : 'No se pudo crear la empresa.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo
      titulo="Dar de alta una empresa"
      abierto={abierto}
      onCerrar={() => { limpiar(); onCerrar() }}
      acciones={
        <>
          <Boton estilo="secundario" onClick={() => { limpiar(); onCerrar() }}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            form="alta-empresa"
            ocupado={enviando}
            textoOcupado="Creando aquí y en el servicio…"
          >
            Crear empresa
          </Boton>
        </>
      }
    >
      <form id="alta-empresa" onSubmit={enviar}>

        {errorEnvio && (
          <Aviso>
            {errorEnvio}
            <div className="secundario">No se creó nada, ni aquí ni en el servicio, salvo que el mensaje diga otra cosa.</div>
          </Aviso>
        )}

        <h3 className="subtitulo">La empresa</h3>

        <Campo
          etiqueta="RUC"
          obligatorio
          value={f.ruc}
          onChange={escribir('ruc')}
          inputMode="numeric"
          maxLength={11}
          placeholder="20123456789"
          pista={buscandoSunat ? 'Buscando en SUNAT…'
            : ficha && !noActiva(ficha) ? '✓ Datos traídos de SUNAT. Revísalos antes de crear.'
            : 'Se teclea solo aquí: el emisor del servicio se crea con este RUC. No cambia después.'}
          autoFocus
        />

        {noActiva(ficha) && (
          <Aviso>
            Según SUNAT este RUC está <strong>{ficha?.estado}</strong>. Una empresa que no está
            activa no puede emitir: SUNAT le rechaza los comprobantes.
          </Aviso>
        )}
        {!noActiva(ficha) && noHabida(ficha) && (
          <Aviso tono="ojo">
            SUNAT la tiene como <strong>{ficha?.condicion}</strong>: sus comprobantes serán
            rechazados hasta que actualice su domicilio fiscal.
          </Aviso>
        )}

        <Campo
          etiqueta="Razón social"
          obligatorio
          value={f.razonSocial}
          onChange={escribir('razonSocial')}
          pista="Tal como sale en la ficha RUC. Es la que va en los comprobantes."
        />

        <Campo
          etiqueta="Nombre comercial"
          value={f.nombreComercial}
          onChange={escribir('nombreComercial')}
          pista="Opcional. El nombre con el que la conocen sus clientes."
        />

        <Campo
          etiqueta="Nombre para mostrar"
          value={f.nombre}
          onChange={escribir('nombre')}
          pista="Opcional. El que se ve en la plataforma. Si lo dejas vacío, se usa el nombre comercial o la razón social."
        />

        <h3 className="subtitulo">Dirección fiscal</h3>

        <Aviso tono="ojo">
          <strong>Cópiala tal cual de la ficha RUC.</strong> Sale en cada comprobante y
          SUNAT no la corrige. Elige el departamento, la provincia y el distrito: el
          ubigeo se pone solo. Si después hay que corregirla, se hace en el panel del
          servicio (pestaña Marca).
        </Aviso>

        <Campo
          etiqueta="Dirección"
          obligatorio
          value={f.direccion}
          onChange={escribir('direccion')}
          placeholder="AV. EJERCITO 123"
          pista="Calle y número, como en la ficha RUC. Sale en cada comprobante."
        />

        <SelectorUbigeo
          key={vuelta}
          ubigeo={f.ubigeo}
          onCambio={u => setF(v => ({ ...v, ...u }))}
        />

        <h3 className="subtitulo">Su administrador</h3>

        <Campo
          etiqueta="Correo"
          obligatorio
          type="email"
          value={f.correoAdministrador}
          onChange={escribir('correoAdministrador')}
          pista="Con este correo entra. Es único en toda la plataforma."
        />

        <Campo
          etiqueta="Nombre"
          value={f.nombreAdministrador}
          onChange={escribir('nombreAdministrador')}
          placeholder="Administrador"
        />

        <Campo
          etiqueta="Horas que dura el enlace"
          obligatorio
          type="number"
          min={1}
          max={168}
          value={f.horasInvitacion}
          onChange={escribir('horasInvitacion')}
          pista="Entre 1 y 168 (siete días). Se aplica a toda la gente de esta empresa, no solo a su administrador."
        />

        <h3 className="subtitulo">Módulos contratados</h3>

        {modulos.length === 0 ? (
          <p className="vacio">No hay módulos en el catálogo.</p>
        ) : (
          <div className="casillas">
            {modulos.map(m => m.codigo === FACTURACION ? (
              /* FACTURACIÓN QUEDA CONTRATADA EN EL ALTA (migración 028), no
                 activa: el emisor nace sin certificado ni series. La activa su
                 administrador al terminar «Configurar facturación». */
              <label key={m.codigo} className="casilla">
                <input type="checkbox" checked disabled readOnly />
                <span>
                  <strong>{m.nombre}</strong>
                  <em>
                    Contratada. Se activa sola cuando su administrador termine «Configurar
                    facturación» (certificado, series, marca y usuario SOL) en la plataforma.
                  </em>
                </span>
              </label>
            ) : (
              <label key={m.codigo} className="casilla">
                <input
                  type="checkbox"
                  checked={elegidos.includes(m.codigo)}
                  onChange={() => alternarModulo(m.codigo)}
                />
                <span>
                  <strong>{m.nombre}</strong>
                  {m.descripcion && <em>{m.descripcion}</em>}
                </span>
              </label>
            ))}
          </div>
        )}

        <p className="nota">
          Al crearla, el emisor nace también en el servicio de facturación, en <strong>beta</strong>,
          con su clave y su webhook: no hay que copiar nada. El certificado, el usuario SOL, las
          series y la Marca se cargan después en el panel del servicio. Al administrador le
          llegará un correo con un enlace para elegir su contraseña.
        </p>
      </form>
    </Dialogo>
  )
}