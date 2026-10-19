import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boton } from '../../../componentes/Boton'
import { ErrorApi } from '../../../nucleo/api/errores'
import { useConfirmar } from '../../../nucleo/hooks/useConfirmar'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion, useYo } from '../../../nucleo/sesion/SesionContexto'
import { carteraServicio } from '../servicios/carteraServicio'

/**
 * «¿Ahora facturas para más de una empresa?» (fase 3): convertir la Cuenta
 * Negocio en Profesional. Misma persona, misma empresa y todo su historial;
 * solo se le abren Mis empresas, el selector y los colaboradores.
 *
 * Vive en «Mi cuenta» (lienzo «Cuenta Negocio», pantalla 3). El inicio solo
 * lleva una pista con el enlace hasta aquí.
 */
export function ConvertirCuenta() {
  const { refrescar } = useSesion()
  const { empresa } = useYo()
  const mensaje = useMensaje()
  const { pedir, dialogo: confirmacion } = useConfirmar()
  const navegar = useNavigate()
  const [ocupado, setOcupado] = useState(false)

  const convertir = async () => {
    const seguro = await pedir({
      titulo: 'Convertir en Cuenta Profesional',
      confirmar: 'Convertir',
      mensaje: <p>Tu empresa, tus usuarios y todo su historial se quedan igual. No se puede deshacer desde aquí.</p>,
    })
    if (!seguro) return
    setOcupado(true)
    try {
      mensaje.bien((await carteraServicio.convertir()).mensaje)
      await refrescar()
      navegar('/empresas')
    } catch (e) {
      mensaje.error(e instanceof ErrorApi ? e.message : 'No se pudo convertir la cuenta.')
      setOcupado(false)
    }
  }

  return (
    <section className="bloque convertir-cuenta" id="convertir">
      <h2>¿Ahora facturas para más de una empresa?</h2>
      <p className="texto-paso">
        Convierte tu cuenta en <strong>Cuenta Profesional</strong>. Sigues con el mismo correo, la misma
        empresa y todo su historial; solo se te abren <strong>Mis empresas</strong>, el selector y los
        colaboradores.
      </p>
      <ul className="lista-nota">
        {empresa && <li><strong>{empresa.nombre}</strong> queda como tu primera empresa.</li>}
        <li>Tus usuarios siguen igual, con los mismos roles.</li>
        <li>No se puede deshacer desde aquí: si te arrepientes, escríbenos.</li>
      </ul>
      <p>
        <Boton onClick={() => void convertir()} ocupado={ocupado} textoOcupado="Convirtiendo…">
          Convertir en Cuenta Profesional
        </Boton>
      </p>
      {confirmacion}
    </section>
  )
}