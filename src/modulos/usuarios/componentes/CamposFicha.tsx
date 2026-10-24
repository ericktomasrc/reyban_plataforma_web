import { useId } from 'react'
import { Asterisco, Campo } from '../../../componentes/Campo'
import { SelectorUbigeo } from '../../../nucleo/ubigeo/SelectorUbigeo'

/**
 * 046 — LOS DATOS PERSONALES DE LA FICHA (Personal de la empresa y Mi equipo).
 *
 * Obligatorios: tipo y número de documento, nombres, apellido paterno y el
 * materno con DNI (con carné o pasaporte puede no tenerlo). Lo demás es
 * opcional. Ley 29733: no se pide foto del documento.
 *
 * Se escriben como texto ('' = vacío); `paraEnviar` los pasa a lo que espera
 * la API (null en lo vacío).
 */
export interface DatosFicha {
  tipoDocumento: '1' | '4' | '7'
  numeroDocumento: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  celular: string
  fechaNacimiento: string
  direccion: string
  ubigeo: string
  cargo: string
  fechaIngreso: string
}

export type FichaParaEnviar = {
  [K in keyof DatosFicha]: DatosFicha[K] extends string ? string | null : DatosFicha[K]
}

export const FICHA_VACIA: DatosFicha = {
  tipoDocumento: '1', numeroDocumento: '', nombres: '', apellidoPaterno: '', apellidoMaterno: '',
  celular: '', fechaNacimiento: '', direccion: '', ubigeo: '', cargo: '', fechaIngreso: '',
}

/** De lo que trae la API (nulos) a lo que se edita. */
export function fichaDe(x: Partial<Record<keyof DatosFicha, string | null | undefined>>): DatosFicha {
  const t = x.tipoDocumento
  return {
    tipoDocumento: t === '4' || t === '7' ? t : '1',
    numeroDocumento: x.numeroDocumento ?? '',
    nombres: x.nombres ?? '',
    apellidoPaterno: x.apellidoPaterno ?? '',
    apellidoMaterno: x.apellidoMaterno ?? '',
    celular: x.celular ?? '',
    fechaNacimiento: x.fechaNacimiento ?? '',
    direccion: x.direccion ?? '',
    ubigeo: x.ubigeo ?? '',
    cargo: x.cargo ?? '',
    fechaIngreso: x.fechaIngreso ?? '',
  }
}

export function paraEnviar(f: DatosFicha): FichaParaEnviar {
  const v = (s: string) => (s.trim() === '' ? null : s.trim())
  return {
    tipoDocumento: f.tipoDocumento,
    numeroDocumento: v(f.numeroDocumento.toUpperCase()),
    nombres: v(f.nombres),
    apellidoPaterno: v(f.apellidoPaterno),
    apellidoMaterno: v(f.apellidoMaterno),
    celular: v(f.celular),
    fechaNacimiento: v(f.fechaNacimiento),
    direccion: v(f.direccion),
    ubigeo: v(f.ubigeo),
    cargo: v(f.cargo),
    fechaIngreso: v(f.fechaIngreso),
  }
}

/** Lo mismo que revisa la API, para avisar antes de enviar. Devuelve [mensaje, campo] o null. */
export function problemaFicha(f: DatosFicha): [string, keyof DatosFicha] | null {
  const n = f.numeroDocumento.replace(/[\s-]/g, '').toUpperCase()
  if (f.tipoDocumento === '1' && !/^\d{8}$/.test(n)) return ['El DNI son 8 dígitos.', 'numeroDocumento']
  if (f.tipoDocumento === '4' && !/^[A-Z0-9]{8,12}$/.test(n)) return ['El carné de extranjería son de 8 a 12 letras o números.', 'numeroDocumento']
  if (f.tipoDocumento === '7' && !/^[A-Z0-9]{6,12}$/.test(n)) return ['El pasaporte son de 6 a 12 letras o números.', 'numeroDocumento']
  if (f.nombres.trim().length < 2) return ['Escribe sus nombres.', 'nombres']
  if (!f.apellidoPaterno.trim()) return ['Escribe su apellido paterno.', 'apellidoPaterno']
  if (f.tipoDocumento === '1' && !f.apellidoMaterno.trim())
    return ['Con DNI, el apellido materno es obligatorio (con carné o pasaporte puede no tenerlo).', 'apellidoMaterno']
  return null
}

export const NOMBRE_DOCUMENTO: Record<string, string> = { '1': 'DNI', '4': 'CE', '7': 'Pasaporte' }

export function CamposFicha({ valor, onCambio, campoMal, aviso, children, cargos, sinTrabajo }: {
  valor: DatosFicha
  /** 048: la propia persona no se pone el cargo ni la fecha de ingreso (Mi cuenta, «Tus datos»). */
  sinTrabajo?: boolean
  onCambio: (f: DatosFicha) => void
  /** 047: los cargos de la maestra, para sugerir mientras se escribe (si no está, se crea solo). */
  cargos?: string[]
  /** El campo que la API o la revisión marcó. */
  campoMal?: string | null
  /** Debajo del número: «ya está en tu personal», por ejemplo. */
  aviso?: React.ReactNode
  /** El correo (va en la segunda fila, junto al celular). */
  children?: React.ReactNode
}) {
  const listaCargos = useId()
  const poner = (k: keyof DatosFicha) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onCambio({ ...valor, [k]: e.target.value })

  return (
    <>
      <div className="terna">
        <label className="campo">
          <span className="etiqueta">Tipo de documento<Asterisco /></span>
          <select value={valor.tipoDocumento} onChange={poner('tipoDocumento')}>
            <option value="1">DNI</option>
            <option value="4">Carné de extranjería</option>
            <option value="7">Pasaporte</option>
          </select>
        </label>
        <Campo etiqueta="Número" obligatorio value={valor.numeroDocumento} onChange={poner('numeroDocumento')}
               inputMode={valor.tipoDocumento === '1' ? 'numeric' : undefined}
               maxLength={valor.tipoDocumento === '1' ? 8 : 12} mal={campoMal === 'numeroDocumento'}
               pista={aviso} />
        <span className="pista" style={{ alignSelf: 'end' }}>
          Sin foto del documento: basta el número.
        </span>
      </div>

      <div className="terna">
        <Campo etiqueta="Nombres" obligatorio value={valor.nombres} onChange={poner('nombres')} maxLength={80}
               mal={campoMal === 'nombres'} />
        <Campo etiqueta="Apellido paterno" obligatorio value={valor.apellidoPaterno} onChange={poner('apellidoPaterno')}
               maxLength={60} mal={campoMal === 'apellidoPaterno'} />
        <Campo etiqueta="Apellido materno" obligatorio={valor.tipoDocumento === '1'} value={valor.apellidoMaterno}
               onChange={poner('apellidoMaterno')} maxLength={60} mal={campoMal === 'apellidoMaterno'}
               pista={valor.tipoDocumento === '1' ? undefined : 'Opcional con carné o pasaporte.'} />
      </div>

      <div className="terna">
        {children}
        <Campo etiqueta="Celular" value={valor.celular} onChange={poner('celular')} inputMode="tel" maxLength={16}
               placeholder="987654321" mal={campoMal === 'celular'} />
        <Campo etiqueta="Fecha de nacimiento" type="date" value={valor.fechaNacimiento} onChange={poner('fechaNacimiento')}
               mal={campoMal === 'fechaNacimiento'} />
      </div>

      <Campo etiqueta="Dirección" value={valor.direccion} onChange={poner('direccion')} maxLength={200} />
      <SelectorUbigeo opcional ubigeo={valor.ubigeo} onCambio={u => onCambio({ ...valor, ubigeo: u.ubigeo })}
                      error={campoMal === 'ubigeo' ? 'Elige el distrito de la lista.' : undefined} />

      {!sinTrabajo && <div className="pareja">
        <Campo etiqueta="Cargo" value={valor.cargo} onChange={poner('cargo')} maxLength={80} placeholder="Cajero"
               mal={campoMal === 'cargo'} list={listaCargos} autoComplete="off"
               pista={valor.cargo.trim() && cargos && !cargos.some(c => c.toLowerCase() === valor.cargo.trim().toLowerCase())
                 ? `«${valor.cargo.trim()}» es nuevo: se agrega a los cargos al guardar.` : undefined} />
        <datalist id={listaCargos}>
          {(cargos ?? []).map(c => <option key={c} value={c} />)}
        </datalist>
        <Campo etiqueta="Fecha de ingreso" type="date" value={valor.fechaIngreso} onChange={poner('fechaIngreso')}
               mal={campoMal === 'fechaIngreso'} />
      </div>}
    </>
  )
}