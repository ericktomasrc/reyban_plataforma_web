import { useState, type ReactNode } from 'react'
import { Boton } from '../../../componentes/Boton'
import { Si } from '../../../nucleo/autorizacion/Protegido'
import { Permisos } from '../../../nucleo/autorizacion/permisos'
import { useMensaje } from '../../../nucleo/mensajes/ProveedorMensajes'
import { useSesion } from '../../../nucleo/sesion/SesionContexto'
import { DialogoFacturacion } from './DialogoFacturacion'
import { DialogoModulos } from './DialogoModulos'
import { DialogoPlazo } from './DialogoPlazo'
import { DialogoSuspender } from './DialogoSuspender'
import { DialogoVerComo } from './DialogoVerComo'
import { empresasServicio } from '../servicios/empresasServicio'
import type { EmpresaEnLista, ModuloDelCatalogo, PlanesDeEmpresas } from '../tipos'

/**
 * e291 — LAS ACCIONES DE UNA EMPRESA (Ver como, Módulos, Enlaces, Facturación,
 * Suspender/Reactivar) con sus ventanas, para usarlas fuera de «Empresas»
 * (en «Cuentas», al desplegar una cuenta). Hacen lo mismo que allí.
 */
export function useAccionesEmpresa({ modulos, planes, recargar }: {
  modulos: ModuloDelCatalogo[]
  planes?: PlanesDeEmpresas
  recargar: () => void
}): { botones: (e: EmpresaEnLista) => ReactNode; dialogos: ReactNode } {
  const { refrescar } = useSesion()
  const mensaje = useMensaje()
  const [modulosDe, setModulosDe] = useState<EmpresaEnLista>()
  const [plazoDe, setPlazoDe] = useState<EmpresaEnLista>()
  const [suspenderA, setSuspenderA] = useState<EmpresaEnLista>()
  const [verComo, setVerComo] = useState<EmpresaEnLista>()
  const [facturacionDe, setFacturacionDe] = useState<EmpresaEnLista>()

  async function reactivar(e: EmpresaEnLista) {
    try {
      await empresasServicio.reactivar(e.id)
      mensaje.bien(`${e.nombre} quedó reactivada.`)
      recargar()
    } catch {
      mensaje.error(`No se pudo reactivar ${e.nombre}.`)
    }
  }

  const botones = (e: EmpresaEnLista) => {
    const suspendida = e.suspendidaEn !== null
    return (
      <>
        {!suspendida && (
          <Si puede={Permisos.Plataforma.Suplantar}>
            <Boton estilo="plano" onClick={() => setVerComo(e)}>Ver como</Boton>
          </Si>
        )}
        <Si puede={Permisos.Plataforma.ModulosGestionar}>
          <Boton estilo="plano" onClick={() => setModulosDe(e)}>Módulos</Boton>
        </Si>
        <Si puede={Permisos.Plataforma.EmpresasGestionar}>
          <Boton estilo="plano" onClick={() => setPlazoDe(e)}>Enlaces</Boton>
        </Si>
        <Si puede={Permisos.Plataforma.CredencialesGestionar}>
          <Boton estilo="plano" onClick={() => setFacturacionDe(e)}>Facturación</Boton>
        </Si>
        <Si puede={Permisos.Plataforma.EmpresasGestionar}>
          {suspendida
            ? <Boton estilo="plano" onClick={() => void reactivar(e)}>Reactivar</Boton>
            : <Boton estilo="plano" className="acc-peligro" onClick={() => setSuspenderA(e)}>Suspender</Boton>}
        </Si>
      </>
    )
  }

  const dialogos = (
    <>
      {facturacionDe && (
        <DialogoFacturacion empresa={facturacionDe} onCerrar={() => setFacturacionDe(undefined)} onCambiado={recargar} />
      )}
      {verComo && (
        <DialogoVerComo empresa={verComo} onCerrar={() => setVerComo(undefined)}
                        onEmpezada={() => { setVerComo(undefined); void refrescar() }} />
      )}
      {modulosDe && (
        <DialogoModulos empresa={modulosDe} modulos={modulos} planes={planes}
                        onCerrar={() => setModulosDe(undefined)} onCambiado={recargar} />
      )}
      {plazoDe && (
        <DialogoPlazo empresa={plazoDe} onCerrar={() => setPlazoDe(undefined)}
                      onGuardado={() => { setPlazoDe(undefined); recargar() }} />
      )}
      {suspenderA && (
        <DialogoSuspender empresa={suspenderA} onCerrar={() => setSuspenderA(undefined)}
                          onHecho={() => { setSuspenderA(undefined); recargar() }} />
      )}
    </>
  )

  return { botones, dialogos }
}