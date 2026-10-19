import { useEffect, useId, useState } from 'react'
import { Asterisco } from '../../componentes/Campo'
import { UBIGEO } from './ubigeoPeru'

/** Lo que se guarda: el ubigeo y los tres nombres, tal cual la lista del INEI. */
export interface UbicacionFiscal {
  ubigeo: string
  distrito: string
  provincia: string
  departamento: string
}

export const UBICACION_VACIA: UbicacionFiscal = { ubigeo: '', distrito: '', provincia: '', departamento: '' }

/** Los departamentos con sus tildes, solo para mostrarlos. Se guardan sin tildes. */
const BONITOS: Record<string, string> = {
  ANCASH: 'Áncash', APURIMAC: 'Apurímac', HUANUCO: 'Huánuco', JUNIN: 'Junín', 'SAN MARTIN': 'San Martín',
}

/** «SAN JUAN DE LURIGANCHO» → «San Juan De Lurigancho»: para leer, no para guardar. */
export function legible(nombre: string): string {
  return BONITOS[nombre] ?? nombre.toLowerCase().replace(/(^|[\s(-])\S/g, c => c.toUpperCase())
}

/** De un ubigeo a sus tres nombres. Null si no está en la lista. */
export function buscarUbigeo(ubigeo: string): UbicacionFiscal | null {
  const u = ubigeo.trim()
  if (!/^\d{6}$/.test(u)) return null
  for (const [departamento, provincias] of Object.entries(UBIGEO))
    for (const [provincia, distritos] of Object.entries(provincias))
      for (const [distrito, codigo] of distritos)
        if (codigo === u) return { ubigeo: u, distrito, provincia, departamento }
  return null
}

interface Props {
  /** El ubigeo elegido ('' si todavía no hay distrito). */
  ubigeo: string
  onCambio: (v: UbicacionFiscal) => void
  /** El error del servidor para la dirección, si lo hubo. */
  error?: string
}

/**
 * DEPARTAMENTO ▸ PROVINCIA ▸ DISTRITO, en tres desplegables (17 oct).
 *
 * El ubigeo NO se teclea: sale del distrito elegido. Así no puede dejar de
 * cuadrar con el departamento, que era el error de cada alta escrita a mano.
 * Cambiar el departamento o la provincia deja el distrito sin elegir (y el
 * ubigeo vacío) hasta que se elija otro.
 *
 * Si la empresa trae un ubigeo que no está en la lista (uno antiguo o mal
 * escrito), abre vacío y lo dice.
 */
export function SelectorUbigeo({ ubigeo, onCambio, error }: Props) {
  const id = useId()
  const inicial = buscarUbigeo(ubigeo)
  const [departamento, setDepartamento] = useState(inicial?.departamento ?? '')
  const [provincia, setProvincia] = useState(inicial?.provincia ?? '')

  // 18 OCT: SI EL UBIGEO LLEGA DE FUERA (la ficha RUC de SUNAT), las listas
  // se ponen en su departamento y provincia. Elegir a mano no cambia nada:
  // el distrito elegido ya está en la provincia que se ve.
  useEffect(() => {
    const u = buscarUbigeo(ubigeo)
    if (!u) return
    setDepartamento(u.departamento)
    setProvincia(u.provincia)
  }, [ubigeo])

  const provincias = departamento ? Object.keys(UBIGEO[departamento] ?? {}) : []
  const distritos = departamento && provincia ? (UBIGEO[departamento]?.[provincia] ?? []) : []
  const elegido = buscarUbigeo(ubigeo)
  const desconocido = ubigeo.trim() !== '' && !elegido

  function elegirDepartamento(v: string) {
    setDepartamento(v)
    setProvincia('')
    onCambio(UBICACION_VACIA)
  }

  function elegirProvincia(v: string) {
    setProvincia(v)
    onCambio(UBICACION_VACIA)
  }

  function elegirDistrito(codigo: string) {
    const d = distritos.find(([, c]) => c === codigo)
    onCambio(d ? { ubigeo: codigo, distrito: d[0], provincia, departamento } : UBICACION_VACIA)
  }

  return (
    <>
      <div className="rejilla-direccion">
        <div className="campo">
          <label htmlFor={`${id}-dep`}>Departamento<Asterisco /></label>
          <select id={`${id}-dep`} aria-required value={departamento}
                  onChange={e => elegirDepartamento(e.target.value)}>
            <option value="">Elige…</option>
            {Object.keys(UBIGEO).map(d => <option key={d} value={d}>{legible(d)}</option>)}
          </select>
        </div>

        <div className="campo">
          <label htmlFor={`${id}-pro`}>Provincia<Asterisco /></label>
          <select id={`${id}-pro`} aria-required value={provincia} disabled={!departamento}
                  onChange={e => elegirProvincia(e.target.value)}>
            <option value="">{departamento ? 'Elige…' : 'Primero el departamento'}</option>
            {provincias.map(p => <option key={p} value={p}>{legible(p)}</option>)}
          </select>
        </div>

        <div className="campo">
          <label htmlFor={`${id}-dis`}>Distrito<Asterisco /></label>
          <select id={`${id}-dis`} aria-required value={elegido ? elegido.ubigeo : ''} disabled={!provincia}
                  aria-invalid={!!error || desconocido || undefined}
                  onChange={e => elegirDistrito(e.target.value)}>
            <option value="">{provincia ? 'Elige…' : 'Primero la provincia'}</option>
            {distritos.map(([n, c]) => <option key={c} value={c}>{legible(n)}</option>)}
          </select>
        </div>

        <div className="campo">
          <label>Ubigeo</label>
          <span className="mono" style={{ padding: '9px 0' }}>{elegido ? elegido.ubigeo : '—'}</span>
          <span className="pista">Se pone solo con el distrito.</span>
        </div>
      </div>

      {desconocido && (
        <p className="pista mal">
          El ubigeo guardado ({ubigeo.trim()}) no está en la lista del INEI: elige el distrito otra vez.
        </p>
      )}
      {error && <p className="pista mal">{error}</p>}
    </>
  )
}