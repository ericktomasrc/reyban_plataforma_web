import { useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Campo } from '../../../componentes/Campo'
import { Dialogo } from '../../../componentes/Dialogo'
import { ErrorApi } from '../../../nucleo/api/errores'
import { clientesServicio, consultasServicio } from '../servicios/facturacionServicio'
import type { DatosRuc } from '../servicios/facturacionServicio'
import type { ClienteEnLista } from '../tipos'

interface Props {
  /** Lo que se escribió en el buscador: un DNI, un RUC o un nombre. */
  inicial: string
  onCerrar: () => void
  onCreado: (c: ClienteEnLista) => void
}

const TIPOS = [
  { codigo: '1', nombre: 'DNI' },
  { codigo: '6', nombre: 'RUC' },
  { codigo: '4', nombre: 'Carné de extranjería' },
  { codigo: '7', nombre: 'Pasaporte' },
]

/** Por lo escrito: 11 cifras es un RUC, 8 un DNI; si no, un nombre. */
function adivinar(inicial: string): { tipo: string; numero: string; nombre: string } {
  const t = inicial.trim()
  if (/^\d{11}$/.test(t)) return { tipo: '6', numero: t, nombre: '' }
  if (/^\d{8}$/.test(t)) return { tipo: '1', numero: t, nombre: '' }
  if (/^\d+$/.test(t)) return { tipo: t.length > 8 ? '6' : '1', numero: t, nombre: '' }
  return { tipo: '1', numero: '', nombre: t.toUpperCase() }
}

/**
 * CREAR UN CLIENTE SIN SALIR DEL COMPROBANTE (17 oct).
 *
 *   RUC   se consulta SIEMPRE (Decolecta, datos de SUNAT): razón social y
 *         dirección salen tal cual SUNAT las tiene, para que la factura salga
 *         bien. De baja: no deja crearlo. No habido: avisa y deja seguir.
 *   DNI   se consulta el nombre (RENIEC) y se puede corregir.
 *
 * Si la consulta no está disponible (sin token, sin consultas en el mes, el
 * servicio caído), se escriben los datos a mano: nunca bloquea.
 */
export function DialogoClienteRapido({ inicial, onCerrar, onCreado }: Props) {
  const primero = adivinar(inicial)
  const [tipo, setTipo] = useState(primero.tipo)
  const [numero, setNumero] = useState(primero.numero)
  const [nombre, setNombre] = useState(primero.nombre)
  const [direccion, setDireccion] = useState('')
  const [ubigeo, setUbigeo] = useState('')
  const [correo, setCorreo] = useState('')

  const [ruc, setRuc] = useState<DatosRuc>()
  const [consultando, setConsultando] = useState(false)
  const [nota, setNota] = useState<{ tono: 'bien' | 'ojo' | 'error'; texto: string }>()
  const [manual, setManual] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string>()

  const largo = tipo === '6' ? 11 : tipo === '1' ? 8 : 0
  const completo = largo > 0 && numero.length === largo

  // Se consulta solo al completar el número: ni antes (gasta consultas) ni
  // con un botón aparte (es un clic que todo el mundo daría igual).
  useEffect(() => {
    setRuc(undefined); setNota(undefined); setManual(false)
    if (!completo) return

    let vivo = true
    setConsultando(true)
    void (async () => {
      try {
        if (tipo === '6') {
          const d = await consultasServicio.ruc(numero)
          if (!vivo) return
          setRuc(d)
          setNombre(d.razonSocial ?? '')
          setDireccion([d.direccion, d.distrito, d.provincia, d.departamento].filter(Boolean).join(' - '))
          setUbigeo(d.ubigeo ?? '')
          const activo = (d.estado ?? '').toUpperCase() === 'ACTIVO'
          const habido = (d.condicion ?? '').toUpperCase() === 'HABIDO'
          setNota(!activo
            ? { tono: 'error', texto: `Según SUNAT este RUC está ${d.estado ?? 'sin estado'}. No se le puede emitir factura: revisa el número con tu cliente.` }
            : !habido
              ? { tono: 'ojo', texto: `SUNAT lo tiene como ${d.condicion ?? 'sin condición'}. Se le puede facturar, pero ese cliente no podrá usar el crédito fiscal.` }
              : { tono: 'bien', texto: 'Encontrado en SUNAT · ACTIVO · HABIDO.' })
        } else if (tipo === '1') {
          const d = await consultasServicio.dni(numero)
          if (!vivo) return
          if (d.nombreCompleto) setNombre(d.nombreCompleto)
          setNota({ tono: 'bien', texto: 'Nombre traído de RENIEC. Puedes corregirlo.' })
        }
      } catch (e) {
        if (!vivo) return
        setManual(true)
        setNota({ tono: 'ojo', texto: e instanceof ErrorApi ? e.message : 'No se pudo consultar. Escribe los datos a mano y revísalos con tu cliente.' })
      } finally {
        if (vivo) setConsultando(false)
      }
    })()
    return () => { vivo = false }
  }, [tipo, numero, completo])

  const deBaja = tipo === '6' && !!ruc && (ruc.estado ?? '').toUpperCase() !== 'ACTIVO'
  // Con los datos de SUNAT, razón social y dirección no se tocan: son las del RUC.
  const deSunat = tipo === '6' && !!ruc && !manual

  async function aceptar() {
    setError(undefined)
    if (largo > 0 && numero.length !== largo) { setError(`Un ${tipo === '6' ? 'RUC' : 'DNI'} son ${largo} dígitos.`); return }
    if (!numero.trim()) { setError('Falta el número de documento.'); return }
    if (!nombre.trim()) { setError(tipo === '6' ? 'Falta la razón social.' : 'Falta el nombre.'); return }
    if (tipo === '6' && !correo.trim()) { setError('Falta el correo: es a donde se le manda su factura.'); return }
    if (deBaja) { setError('Ese RUC no está activo en SUNAT.'); return }

    setGuardando(true)
    try {
      const r = await clientesServicio.crear({
        tipoDocumento: tipo,
        numeroDocumento: numero.trim(),
        razonSocial: nombre.trim(),
        direccion: direccion.trim() || null,
        ubigeo: /^\d{6}$/.test(ubigeo) ? ubigeo : null,
        correo: correo.trim() || null,
      })
      const lista = await clientesServicio.listar(numero.trim())
      const nuevo = lista.find(c => c.id === r.id)
      if (nuevo) onCreado(nuevo)
      else onCerrar()
    } catch (e) {
      // YA EXISTÍA (409): se usa el que hay, que es lo que se quería.
      if (e instanceof ErrorApi && e.codigoHttp === 409) {
        const lista = await clientesServicio.listar(numero.trim()).catch(() => [])
        const ya = lista.find(c => c.numeroDocumento === numero.trim() && c.tipoDocumento === tipo)
        if (ya) { onCreado(ya); return }
      }
      setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar el cliente.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      titulo="Nuevo cliente"
      abierto
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton estilo="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => void aceptar()} ocupado={guardando} textoOcupado="Guardando…">
            Aceptar y usar en el comprobante
          </Boton>
        </>
      }
    >
      <div className="pareja">
        <label className="campo">
          <span className="etiqueta">Tipo de documento</span>
          <select value={tipo} onChange={e => { setTipo(e.target.value); setNumero('') }}>
            {TIPOS.map(t => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
          </select>
        </label>

        <Campo
          etiqueta="Número"
          obligatorio
          value={numero}
          onChange={e => setNumero(e.target.value.replace(/[^0-9A-Za-z]/g, '').slice(0, largo || 15))}
          inputMode={largo ? 'numeric' : 'text'}
          pista={consultando ? 'Consultando…' : largo ? `${numero.length} de ${largo} dígitos` : 'Sin guiones ni espacios'}
          mal={largo > 0 && numero.length > 0 && numero.length !== largo}
          autoFocus
        />
      </div>

      {nota && <Aviso tono={nota.tono}>{nota.texto}</Aviso>}

      <Campo
        etiqueta={tipo === '6' ? 'Razón social' : 'Nombres y apellidos'}
        obligatorio
        value={nombre}
        onChange={e => setNombre(e.target.value.toUpperCase())}
        readOnly={deSunat}
        pista={deSunat ? 'De SUNAT, tal cual sale en su ficha RUC.' : undefined}
      />

      <Campo
        etiqueta={tipo === '6' ? 'Dirección fiscal' : 'Dirección'}
        value={direccion}
        onChange={e => setDireccion(e.target.value)}
        readOnly={deSunat}
        pista={deSunat ? 'De SUNAT.' : 'Opcional.'}
      />

      <Campo
        etiqueta="Correo"
        type="email"
        obligatorio={tipo === '6'}
        value={correo}
        onChange={e => setCorreo(e.target.value)}
        pista={tipo === '6' ? 'A donde se le manda su factura.' : 'Opcional: para mandarle su comprobante.'}
      />

      {error && <Aviso>{error}</Aviso>}
    </Dialogo>
  )
}