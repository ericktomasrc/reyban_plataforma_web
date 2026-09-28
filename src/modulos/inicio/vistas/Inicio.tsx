import { Vacio } from '../../../componentes/Cargando'
import { useYo } from '../../../nucleo/sesion/SesionContexto'

/**
 * La pantalla de inicio, que por ahora enseña lo que devuelve /api/yo.
 *
 * Es deliberado y temporal: mientras no haya módulos, lo útil es ver de un
 * vistazo con qué permisos entró cada uno y qué menú le calculó la base.
 * Cuando exista facturación, esto se convierte en un resumen de verdad.
 */
export function Inicio() {
  const { usuario, empresa, permisos, menu } = useYo()

  return (
    <>
      <h1 className="titulo-pagina">Hola, {usuario.nombre.split(' ')[0]}</h1>

      <section className="bloque">
        <h2>Tu cuenta</h2>
        <dl className="datos">
          <div className="fila"><dt>Nombre</dt><dd>{usuario.nombre}</dd></div>
          <div className="fila"><dt>Correo</dt><dd>{usuario.correo}</dd></div>
          <div className="fila">
            <dt>Segundo factor</dt>
            <dd>{usuario.dosfaActivo ? 'Activo' : 'Sin configurar'}</dd>
          </div>
          <div className="fila">
            <dt>Tipo de cuenta</dt>
            <dd>{usuario.esSuperAdmin
              ? 'Super administrador de la plataforma'
              : 'Usuario de empresa'}</dd>
          </div>
        </dl>
      </section>

      <section className="bloque">
        <h2>Empresa</h2>
        {empresa ? (
          <dl className="datos">
            <div className="fila"><dt>Razón social</dt><dd>{empresa.razonSocial}</dd></div>
            <div className="fila"><dt>RUC</dt><dd className="mono">{empresa.ruc}</dd></div>
          </dl>
        ) : (
          <Vacio>
            No perteneces a ninguna empresa. El super administrador vive fuera
            de ellas, porque su trabajo es cruzarlas.
          </Vacio>
        )}
      </section>

      <section className="bloque">
        <h2>Módulos disponibles</h2>
        {menu.length > 0 ? (
          <div className="etiquetas">
            {menu.map(m => (
              <span key={m.codigo} className="etiqueta acento">{m.nombre}</span>
            ))}
          </div>
        ) : (
          <Vacio>
            {usuario.esSuperAdmin
              ? 'Los módulos se activan por empresa; el super administrador no tiene ninguno propio.'
              : 'Tu empresa todavía no tiene módulos contratados.'}
          </Vacio>
        )}
      </section>

      <section className="bloque">
        <h2>Tus permisos</h2>
        {usuario.esSuperAdmin ? (
          <Vacio>
            Como super administrador los tienes todos, así que la lista sale
            vacía: no hacen falta roles para lo que ya puedes hacer.
          </Vacio>
        ) : permisos.length > 0 ? (
          <div className="etiquetas">
            {permisos.map(p => <span key={p} className="etiqueta">{p}</span>)}
          </div>
        ) : (
          <Vacio>Nadie te ha asignado un rol todavía.</Vacio>
        )}
      </section>
    </>
  )
}
