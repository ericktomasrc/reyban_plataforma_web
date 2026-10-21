import { useCallback, useEffect, useState } from 'react'
import { Aviso } from '../../../componentes/Aviso'
import { Boton } from '../../../componentes/Boton'
import { Cargando } from '../../../componentes/Cargando'
import { ErrorApi } from '../../../nucleo/api/errores'
import { fechaYHora } from '../../../nucleo/formato/fechas'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { NIVEL_TEXTO, recuperacion2faServicio } from '../../acceso/servicios/recuperacion2faServicio'
import type { RecuperacionEnCurso } from '../../acceso/servicios/recuperacion2faServicio'

/**
 * 039 — PLATAFORMA › RECUPERACIONES. Solo el super administrador.
 *
 * Las recuperaciones del segundo factor en curso, de todas las empresas. Los
 * avisos por correo no llevan enlaces: se cancela desde aquí.
 */
export function RecuperacionesPagina() {
  const mensaje = useMensaje()
  const { pedir, dialogo } = useConfirmar()
  const [lista, setLista] = useState<RecuperacionEnCurso[] | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setLista(await recuperacion2faServicio.enCurso())
      setFallo(null)
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo cargar.')
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  async function cancelar(r: RecuperacionEnCurso) {
    const seguro = await pedir({
      titulo: `Cancelar la recuperación de ${r.nombre}`,
      confirmar: 'Cancelar la recuperación',
      tono: 'peligro',
      mensaje: (
        <>
          <p>
            Su teléfono y sus códigos siguen valiendo como hasta ahora. Le avisamos por correo.
          </p>
          <p>Hazlo si la persona no la pidió, o si ya recuperó su teléfono.</p>
        </>
      ),
    })
    if (!seguro) return

    setCancelando(r.id)
    try {
      const x = await recuperacion2faServicio.cancelar(r.id)
      mensaje.bien(x.mensaje)
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo cancelar.')
    } finally {
      setCancelando(null)
      await cargar()
    }
  }

  return (
    <>
      <h1 className="titulo-pagina">Recuperaciones del segundo factor</h1>
      <p className="texto-paso">
        Personas que perdieron el teléfono y sus códigos y están recuperando el acceso solas, con espera:
        24 horas un usuario, 3 días un administrador, 7 días un super administrador.
      </p>

      {fallo && <Aviso>{fallo}</Aviso>}
      {!lista && !fallo && <Cargando />}
      {lista && (
        <table className="tabla">
          <thead>
            <tr>
              <th>Persona</th><th>Empresa</th><th>Pedida</th><th>Estado</th>
              <th><span className="solo-lector">Acción</span></th>
            </tr>
          </thead>
          <tbody>
            {lista.map(r => (
              <tr key={r.id}>
                <td>
                  <div className="principal">{r.nombre}</div>
                  <div className="secundario">{r.correo} · {NIVEL_TEXTO[r.nivel]}</div>
                </td>
                <td>{r.empresa}</td>
                <td>{fechaYHora(r.pedidaEn)}</td>
                <td>
                  {r.estado === 'por_confirmar' ? (
                    <span className="estado aviso">Sin confirmar por correo</span>
                  ) : r.lista ? (
                    <span className="estado malo">Espera terminada</span>
                  ) : (
                    <span className="estado aviso">En espera</span>
                  )}
                  {r.disponibleTexto && <div className="secundario">Disponible el {r.disponibleTexto}</div>}
                </td>
                <td className="derecha">
                  <Boton estilo="secundario" ocupado={cancelando === r.id} textoOcupado="Cancelando…"
                         disabled={cancelando !== null} onClick={() => void cancelar(r)}>
                    Cancelar
                  </Boton>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={5} className="vacio">No hay ninguna recuperación en curso.</td></tr>
            )}
          </tbody>
        </table>
      )}
      <p className="nota">
        Ante la duda, llama a la persona antes de dejar que termine la espera. Las sin confirmar caducan solas.
      </p>
      {dialogo}
    </>
  )
}