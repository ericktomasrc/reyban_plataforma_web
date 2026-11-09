import { Link } from 'react-router-dom'
import { CorreoContacto, PaginaLegal, QuienesSomos } from './Vitrina'

/**
 * 074 — LOS TEXTOS LEGALES de la página pública.
 *
 * Salen de los borradores de «fase5-borradores-privacidad-terminos-guia.md»
 * (privacidad y términos) más la política de devoluciones nueva. Los datos de
 * la empresa (razón social, RUC, dirección, correo) y la fecha vienen de
 * Planes y cobros › Precios y reglas › Página pública.
 *
 * IMPORTANTE: los tiene que revisar un abogado peruano (Ley 29733 y su
 * reglamento DS 016-2024-JUS; Código de Protección y Defensa del Consumidor).
 */

// =============================================================================
export function TerminosPublico() {
  return (
    <PaginaLegal titulo="Términos y condiciones">
      <p>Estos términos regulan el uso de Reyban Facturación, el servicio de facturación electrónica de <QuienesSomos /> («Reyban»). Al crear una cuenta, los aceptas.</p>

      <h2>1. El servicio</h2>
      <p>Reyban Facturación permite emitir facturas, boletas, notas de crédito y de débito, y guías de remisión electrónicas. Reyban las firma y las envía a SUNAT en nombre de la empresa usuaria, con el certificado digital y el usuario SOL que ella entrega. Según el plan, incluye además inventario, compras, punto de venta y reportes.</p>

      <h2>2. Tu cuenta</h2>
      <p>Hay dos tipos: la <strong>Cuenta Negocio</strong> (una empresa, la tuya) y la <strong>Cuenta Profesional</strong> (varias empresas, para contadores y estudios). Eres responsable de tu contraseña y de tu segundo factor, y de lo que hagan los usuarios que invites.</p>

      <h2>3. Lo que es tuyo (la empresa usuaria)</h2>
      <ul>
        <li>Que los datos de cada comprobante sean verdaderos y correctos.</li>
        <li>Tener vigentes tu certificado digital y tu usuario SOL.</li>
        <li>Revisar los rechazos y observaciones de SUNAT que te mostramos, y corregirlos.</li>
        <li>Contar con autorización para emitir en nombre de cada empresa que registras.</li>
      </ul>

      <h2>4. Lo que es nuestro (Reyban)</h2>
      <ul>
        <li>Enviar a SUNAT lo que emites, dentro de los plazos, y reintentar si SUNAT no responde.</li>
        <li>Guardar tus archivos (XML, constancia de SUNAT y PDF) para que los descargues cuando quieras.</li>
        <li>Avisarte de rechazos, atrasos y certificados por vencer.</li>
        <li>Proteger tus datos como dice la <Link to="/privacidad">política de privacidad</Link>.</li>
      </ul>

      <h2>5. Lo que no se puede hacer</h2>
      <p>Facturar en nombre de una empresa sin su autorización, intentar ver datos de otras empresas, automatizar registros, revender el servicio sin acuerdo, o usarlo para operaciones ilícitas. Puede llevar a la suspensión de la cuenta.</p>

      <h2>6. Prueba gratis, planes y pagos</h2>
      <ul>
        <li>Toda cuenta nueva tiene un periodo de prueba gratis, sin tarjeta. Al terminar, la cuenta pasa al plan que elegiste (Básico si no elegiste otro).</li>
        <li>Los precios están en la página de <Link to="/precios">precios</Link>, en soles e incluyen IGV. Se pagan por adelantado, al mes o al año.</li>
        <li>El pago con tarjeta lo procesa <strong>Culqi</strong>: tu tarjeta la guarda Culqi, no Reyban. Si dejas tu tarjeta, el cobro se renueva solo en la misma fecha de cada periodo hasta que canceles.</li>
        <li>Con cada pago te emitimos factura o boleta electrónica.</li>
        <li>Si un cobro falla, lo reintentamos y te avisamos. Si no se regulariza en el plazo de gracia, podrás entrar y ver todo, pero no emitir hasta pagar. No se borra nada.</li>
        <li><strong>Precio de lanzamiento:</strong> si contratas mientras hay una oferta, conservas ese precio durante los meses que indica la página de precios (12 meses pagados, salvo que diga otra cosa), aunque la oferta termine. Después pasa al precio vigente.</li>
        <li>Si cambiamos los precios, te avisaremos con al menos 30 días de anticipación; el cambio rige desde tu siguiente periodo.</li>
        <li><strong>Comprobantes al mes (uso justo):</strong> cada empresa (cada RUC) puede emitir hasta el número de facturas y boletas al mes que indica su plan en la página de <Link to="/precios">precios</Link> (si contratas con precio de lanzamiento, conservas también ese tope). Te avisamos por correo y en la plataforma al 80 %, 90 % y 95 %. Al llegar al tope, las facturas y boletas nuevas quedan en pausa hasta el primer día del mes siguiente, salvo que compres un paquete extra o subas de plan. Las notas de crédito, las anulaciones y lo ya enviado a SUNAT siguen funcionando. Los paquetes extra se pagan por adelantado, se usan solo después del tope del mes y no vencen.</li>
      </ul>

      <h2>7. Cancelación y devoluciones</h2>
      <p>Puedes cancelar cuando quieras. Las condiciones están en la <Link to="/devoluciones">política de cambios, cancelaciones y devoluciones</Link>.</p>

      <h2>8. Disponibilidad</h2>
      <p>Trabajamos para que el servicio esté disponible siempre, pero también depende de SUNAT y de internet. Si SUNAT no responde, tus comprobantes esperan en cola y se envían solos cuando vuelve.</p>

      <h2>9. Datos personales (encargo de tratamiento)</h2>
      <p>Los datos de tu personal y de tus clientes que registras en la plataforma son de tu empresa, que es la responsable de su tratamiento. Reyban actúa como encargado: los trata solo para prestar el servicio y según tus instrucciones, no los usa para fines propios, no los comunica a terceros salvo a SUNAT y a los proveedores que hacen funcionar el servicio, aplica las medidas de seguridad de la política de privacidad y te avisa de cualquier incidente. Tu empresa declara que informó a su personal y que tiene base legal para registrar sus datos.</p>

      <h2>10. Responsabilidad</h2>
      <p>Reyban responde por prestar el servicio con diligencia. No responde por datos incorrectos que ingrese la empresa usuaria, por decisiones de SUNAT, ni por fallas de terceros ajenas a su control. En ningún caso la responsabilidad de Reyban supera lo pagado por el servicio en los últimos 12 meses.</p>

      <h2>11. Fin del servicio</h2>
      <p>Si te vas, tu empresa sigue siendo tuya con todos sus comprobantes, y puedes descargarlos. Los conservamos el tiempo que exige la norma tributaria.</p>

      <h2>12. Cambios a estos términos</h2>
      <p>Si los cambiamos, te avisaremos dentro de la plataforma y por correo antes de que rijan.</p>

      <h2>13. Ley aplicable y contacto</h2>
      <p>Se rigen por las leyes del Perú. Para cualquier consulta o reclamo: <CorreoContacto />.</p>
    </PaginaLegal>
  )
}

// =============================================================================
export function PrivacidadPublico() {
  return (
    <PaginaLegal titulo="Política de privacidad">
      <h2>1. Quiénes somos</h2>
      <p><QuienesSomos /> («Reyban»). Para cualquier asunto de datos personales escríbenos a <CorreoContacto />.</p>

      <h2>2. Qué datos tratamos y para qué</h2>
      <ul>
        <li><strong>De quien se registra y de sus colaboradores:</strong> nombre, correo, alias, contraseña (guardada solo como hash, nunca legible), segundo factor (cifrado) y DNI o RUC del titular. <em>Para</em> crear y proteger la cuenta, saber quién hace cada acción y avisarte de lo que pasa con tu facturación.</li>
        <li><strong>Del personal de cada empresa (ficha):</strong> documento, nombres, correo y, si la empresa los anota, celular, fecha de nacimiento, dirección, cargo y fecha de ingreso. No pedimos foto ni copia del documento. Los tratamos por encargo de la empresa, solo para dar acceso al sistema.</li>
        <li><strong>De las empresas que facturan:</strong> RUC, razón social, dirección fiscal, certificado digital y usuario SOL (estos dos, cifrados: nadie en Reyban puede leerlos). <em>Para</em> emitir y enviar los comprobantes a SUNAT.</li>
        <li><strong>De los clientes de esas empresas:</strong> lo que figura en el comprobante (documento, nombre o razón social, dirección, correo). Los tratamos por encargo de la empresa que factura.</li>
        <li><strong>Para tus pagos:</strong> los datos de tu comprobante (RUC o DNI, nombre, dirección, correo, celular). <strong>No guardamos el número de tu tarjeta:</strong> lo escribe en el formulario de Culqi, que la guarda; nosotros solo vemos la marca y los últimos 4 números.</li>
        <li><strong>Para recuperar una empresa:</strong> copia del DNI y de la ficha RUC, solo para comprobar quién es el titular.</li>
        <li><strong>Registros técnicos:</strong> dirección IP, navegador y fecha de cada acción, para seguridad y para responder si algo falla.</li>
      </ul>

      <h2>3. Base legal</h2>
      <p>La ejecución del servicio que contratas, las obligaciones tributarias y de comprobantes de pago, y tu consentimiento al registrarte (Ley 29733, de Protección de Datos Personales, y su reglamento).</p>

      <h2>4. Con quién se comparten</h2>
      <p>Con <strong>SUNAT</strong>, porque la ley lo exige para cada comprobante. Con los proveedores que hacen funcionar el servicio, solo para eso: servidores (Amazon Web Services), almacenamiento de archivos y verificación anti-robots (Cloudflare), pagos con tarjeta (Culqi), correo electrónico y, si eliges entrar con Google, Google. No vendemos ni cedemos tus datos para publicidad.</p>

      <h2>5. Transferencia internacional</h2>
      <p>Nuestros servidores están en Brasil (São Paulo) y algunos proveedores procesan datos fuera del Perú. Lo hacemos con proveedores que ofrecen niveles adecuados de protección.</p>

      <h2>6. Cuánto tiempo</h2>
      <p>Los comprobantes y su historial, el tiempo que exige la norma tributaria. Las cuentas, mientras estén activas y luego el tiempo que exija la ley. Los documentos de un reclamo de empresa, hasta 6 meses después de resuelto. Los registros técnicos, el tiempo necesario para la seguridad del servicio.</p>

      <h2>7. Cómo los protegemos</h2>
      <p>Contraseñas con hash; certificados, claves SOL y secretos cifrados con llaves que no viven en la base de datos; aislamiento entre empresas dentro de la propia base de datos; conexiones cifradas (https); copias de seguridad fuera del servidor; y registro de quién hace cada cosa.</p>

      <h2>8. Tus derechos</h2>
      <p>Puedes pedir <strong>acceso, rectificación, cancelación u oposición</strong> (y los demás que reconoce la ley) escribiendo a <CorreoContacto />. Respondemos en los plazos de la ley. Si no estás conforme, puedes acudir a la Autoridad Nacional de Protección de Datos Personales (Ministerio de Justicia y Derechos Humanos). Si tus datos están en un comprobante de otra empresa o en la ficha de la empresa donde trabajas, te ayudaremos a dirigir tu pedido a esa empresa.</p>

      <h2>9. Cookies</h2>
      <p>Solo usamos una cookie de sesión, necesaria para mantenerte conectado. No usamos cookies de publicidad ni de seguimiento.</p>

      <h2>10. Si algo sale mal</h2>
      <p>Si ocurre un incidente que afecte tus datos, te lo avisaremos a ti y a la Autoridad en un máximo de 48 horas desde que lo sepamos, con lo ocurrido y lo que hicimos.</p>

      <h2>11. Cambios</h2>
      <p>Si cambia esta política, te avisaremos dentro de la plataforma y por correo antes de que rija.</p>
    </PaginaLegal>
  )
}

// =============================================================================
export function DevolucionesPublico() {
  return (
    <PaginaLegal titulo="Cambios, cancelaciones y devoluciones">
      <p>Queremos que pagues solo cuando estés seguro. Por eso toda cuenta nueva empieza con un periodo de prueba gratis, sin tarjeta, para probarlo todo antes de pagar.</p>

      <h2>1. Cambiar de plan</h2>
      <ul>
        <li><strong>Subir de plan:</strong> se aplica en el momento. Pagas la diferencia por los días que faltan de tu periodo.</li>
        <li><strong>Bajar de plan:</strong> se aplica desde tu siguiente periodo. Tus datos no se pierden: solo se esconden los menús que el plan nuevo no trae.</li>
      </ul>

      <h2>2. Cancelar</h2>
      <ul>
        <li>Puedes cancelar cuando quieras desde «Mi plan» o escribiéndonos. No hay penalidad ni permanencia mínima.</li>
        <li>Sigues usando el servicio hasta el final del periodo que ya pagaste, y no se te vuelve a cobrar.</li>
        <li>Después de esa fecha puedes seguir entrando para ver y descargar todo, pero no emitir. Puedes reactivar tu plan cuando quieras desde «Mi plan».</li>
        <li>Tus comprobantes siguen siendo tuyos: puedes descargarlos, y los conservamos el tiempo que exige la ley.</li>
      </ul>

      <h2>3. Devoluciones</h2>
      <ul>
        <li><strong>Cobro por error o duplicado:</strong> te devolvemos el monto completo.</li>
        <li><strong>Pago mensual:</strong> como tuviste el periodo de prueba gratis, el mes pagado no se devuelve, salvo que el servicio no haya funcionado por causa nuestra.</li>
        <li><strong>Pago anual:</strong> si cancelas dentro de los primeros 30 días desde el pago, te devolvemos lo pagado menos el mes en curso. Después de ese plazo, sigues usando el servicio hasta el final del año pagado.</li>
        <li><strong>Si el servicio falla por causa nuestra</strong> y no lo resolvemos, te devolvemos la parte proporcional del periodo afectado.</li>
      </ul>

      <h2>4. Cómo pedir una devolución</h2>
      <ol>
        <li>Escríbenos a <CorreoContacto /> desde el correo de tu cuenta, con el número de pago (P-000123), el motivo y tu documento.</li>
        <li>Te respondemos en un máximo de 5 días hábiles.</li>
        <li>Si corresponde, devolvemos por el mismo medio con que pagaste: a tu tarjeta (a través de Culqi) o a tu cuenta bancaria si pagaste por transferencia. El tiempo en que el dinero aparece en tu tarjeta depende de tu banco (normalmente de 7 a 15 días hábiles).</li>
        <li>Si te habíamos emitido factura o boleta, emitimos la nota de crédito que corresponde.</li>
      </ol>

      <h2>5. Reclamos</h2>
      <p>Si no estás conforme, escríbenos a <CorreoContacto /> con tu nombre, documento, lo que pasó y lo que pides. Te respondemos en un máximo de 15 días hábiles. También puedes acudir al Indecopi.</p>
    </PaginaLegal>
  )
}