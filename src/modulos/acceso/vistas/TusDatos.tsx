import { useState } from 'react'
import { Boton } from '../../../componentes/Boton'
import { FormularioMiFicha } from '../../perfil/componentes/FormularioMiFicha'

/** 048: «Ahora no» vale para esta pestaña; al volver a entrar se pregunta otra vez. */
export const CLAVE_TUS_DATOS_LUEGO = 'reyban.tusDatosLuego'

/**
 * 048 — EL ÚLTIMO PASO AL ENTRAR POR PRIMERA VEZ: «TUS DATOS».
 *
 * Sale a quien lo invitaron (Personal de la empresa o Mi equipo) mientras no
 * haya revisado su ficha. Si quien lo invitó ya la llenó, la revisa y la
 * confirma; si no, la completa.
 *
 * NO ES UNA PUERTA CERRADA: «Ahora no» deja entrar (y en la próxima sesión
 * se vuelve a preguntar). Lo que sí exige la ficha es emitir, anular, hacer
 * notas y agregar una empresa: eso lo decide la API.
 */
export function TusDatos({ onListo }: { onListo: () => void }) {
  const [completa, setCompleta] = useState<boolean>()
  const [guardando, setGuardando] = useState(false)

  function luego() {
    try { sessionStorage.setItem(CLAVE_TUS_DATOS_LUEGO, '1') } catch { /* sin almacenamiento: vale para esta página */ }
    onListo()
  }

  return (
    <div className="pantalla-centrada">
      <div className="tarjeta-acceso tarjeta-ficha">
        <p className="marca">Reyban Consulting</p>
        <p className="paso-de">Último paso</p>
        <h1>{completa ? 'Revisa tus datos' : 'Tus datos'}</h1>
        <p className="bajada">
          {completa
            ? 'Quien te invitó ya los llenó. Revisa que estén bien y confírmalos.'
            : 'Cada comprobante que emitas queda a tu nombre: necesitamos tu documento, nombres y apellidos.'}
        </p>

        <FormularioMiFicha id="tus-datos" onCargada={setCompleta} onGuardado={() => onListo()} onOcupado={setGuardando} />

        <div className="acciones-tus-datos">
          <Boton estilo="plano" onClick={luego}>Ahora no</Boton>
          <Boton type="submit" form="tus-datos" ocupado={guardando} textoOcupado="Guardando…">{completa ? 'Confirmar y entrar' : 'Guardar y entrar'}</Boton>
        </div>
        <p className="nota">
          Si lo dejas para después, te lo volveremos a pedir al entrar. Sin estos datos podrás mirar, pero no emitir
          ni anular comprobantes.
        </p>
      </div>
    </div>
  )
}