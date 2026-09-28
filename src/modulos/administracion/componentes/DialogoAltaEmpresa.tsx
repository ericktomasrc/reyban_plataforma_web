import { useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { empresasServicio } from '../servicios/empresasServicio'
import type { EmpresaCreada, ModuloDelCatalogo } from '../tipos'

interface Props {
  abierto: boolean
  modulos: ModuloDelCatalogo[]
  onCerrar: () => void

  /** Se llama con el resultado para que la lista se recargue y se vea la clave. */
  onCreada: (resultado: EmpresaCreada) => void
}

const VACIO = {
  ruc: '',
  razonSocial: '',
  nombreComercial: '',
  direccion: '',
  correoAdministrador: '',
  nombreAdministrador: '',
  horasInvitacion: '24',
}

/**
 * El alta de un cliente, entera, en un solo formulario.
 *
 * Empresa + módulos + administrador van juntos porque así va la llamada del
 * back: una empresa sin nadie dentro no sirve para nada, y partirlo en tres
 * pantallas deja tres formas de quedarse a medias.
 *
 * LAS COMPROBACIONES DE AQUÍ NO SON LA VALIDACIÓN. Son para no gastar un viaje
 * al servidor por un RUC de diez dígitos. La validación de verdad está en el
 * endpoint, que rechaza lo mismo aunque esto no existiera.
 */
export function DialogoAltaEmpresa({ abierto, modulos, onCerrar, onCreada }: Props) {
  const [f, setF] = useState(VACIO)
  const [elegidos, setElegidos] = useState<string[]>([])
  const [error, setError] = useState<string>()
  const [enviando, setEnviando] = useState(false)

  const escribir = (campo: keyof typeof VACIO) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setF(v => ({ ...v, [campo]: e.target.value }))

  const alternarModulo = (codigo: string) =>
    setElegidos(v => v.includes(codigo) ? v.filter(c => c !== codigo) : [...v, codigo])

  const limpiar = () => {
    setF(VACIO)
    setElegidos([])
    setError(undefined)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!/^\d{11}$/.test(f.ruc)) {
      setError('El RUC tiene que ser de 11 dígitos.')
      return
    }
    if (!f.razonSocial.trim()) {
      setError('Falta la razón social.')
      return
    }
    if (!f.correoAdministrador.trim()) {
      setError('Falta el correo del administrador: ahí le llega el enlace para entrar.')
      return
    }

    const horas = Number(f.horasInvitacion)
    if (!Number.isInteger(horas) || horas < 1 || horas > 168) {
      setError('El plazo del enlace tiene que estar entre 1 y 168 horas.')
      return
    }

    setEnviando(true)
    try {
      const resultado = await empresasServicio.crear({
        ruc: f.ruc.trim(),
        razonSocial: f.razonSocial.trim(),
        nombreComercial: f.nombreComercial.trim() || undefined,
        direccion: f.direccion.trim() || undefined,
        correoAdministrador: f.correoAdministrador.trim(),
        nombreAdministrador: f.nombreAdministrador.trim() || 'Administrador',
        modulos: elegidos,
        horasInvitacion: Number(f.horasInvitacion) || 24,
      })
      limpiar()
      onCreada(resultado)
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo crear la empresa.')
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
            textoOcupado="Creando…"
          >
            Crear empresa
          </Boton>
        </>
      }
    >
      <form id="alta-empresa" onSubmit={enviar}>
        {error && <Aviso>{error}</Aviso>}

        <h3 className="subtitulo">La empresa</h3>

        <Campo
          etiqueta="RUC"
          value={f.ruc}
          onChange={escribir('ruc')}
          inputMode="numeric"
          maxLength={11}
          placeholder="20123456789"
          autoFocus
        />

        <Campo
          etiqueta="Razón social"
          value={f.razonSocial}
          onChange={escribir('razonSocial')}
        />

        <Campo
          etiqueta="Nombre comercial"
          value={f.nombreComercial}
          onChange={escribir('nombreComercial')}
          pista="Opcional. El nombre con el que la conocen sus clientes."
        />

        <Campo
          etiqueta="Dirección"
          value={f.direccion}
          onChange={escribir('direccion')}
          pista="Opcional."
        />

        <h3 className="subtitulo">Su administrador</h3>

        <Campo
          etiqueta="Correo"
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
            {modulos.map(m => (
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
          Los módulos se pueden activar o quitar después, sin volver a crear
          nada. Al administrador le llegará un correo con un enlace para elegir
          su contraseña.
        </p>
      </form>
    </Dialogo>
  )
}
