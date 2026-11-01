/**
 * 073 — EL FORMULARIO DE TARJETA DE CULQI.
 *
 * La tarjeta se escribe en el formulario de Culqi (Checkout Custom), que se
 * abre encima de la página. Culqi nos devuelve un TOKEN de un solo uso (dura
 * 5 minutos): eso es lo único que llega a nuestro servidor. El número, la
 * fecha y el CVV nunca pasan por Reyban.
 *
 * Si el banco pide confirmar que es el dueño (3DS), se abre la ventana de
 * Culqi3DS y nos da unos datos de autenticación que se mandan con el token.
 *
 * Los scripts se cargan solo cuando hacen falta (al pulsar «Agregar tarjeta»),
 * y solo en los modos prueba y real.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const CHECKOUT = 'https://js.culqi.com/checkout-js'
const TRES_DS = 'https://3ds.culqi.com'

const cargados = new Map<string, Promise<void>>()

function cargar(src: string): Promise<void> {
  let p = cargados.get(src)
  if (!p) {
    p = new Promise<void>((ok, mal) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => ok()
      s.onerror = () => { cargados.delete(src); mal(new Error('No se pudo cargar el formulario de Culqi. Revisa tu internet.')) }
      document.head.appendChild(s)
    })
    cargados.set(src, p)
  }
  return p
}

export interface OpcionesCheckout {
  llavePublica: string
  correo: string
  /** En céntimos. Solo para que el formulario lo enseñe; el monto real lo pone el servidor. */
  montoCentimos?: number
  onToken: (token: string) => void
  onError: (mensaje: string) => void
}

/** Abre el formulario de Culqi para guardar una tarjeta. */
export async function abrirCheckout(o: OpcionesCheckout): Promise<void> {
  await cargar(CHECKOUT)
  const w = window as any
  if (typeof w.CulqiCheckout !== 'function') throw new Error('El formulario de Culqi no está disponible ahora.')

  const config = {
    settings: {
      title: 'Reyban Facturación',
      currency: 'PEN',
      ...(o.montoCentimos && o.montoCentimos > 0 ? { amount: o.montoCentimos } : {}),
    },
    client: { email: o.correo },
    options: {
      lang: 'auto',
      installments: false,
      modal: true,
      paymentMethods: { tarjeta: true, yape: false, billetera: false, bancaMovil: false, agente: false, cuotealo: false },
      paymentMethodsSort: ['tarjeta'],
    },
    appearance: {
      theme: 'default',
      menuType: 'sidebar',
      buttonCardPayText: 'Guardar mi tarjeta',
      defaultStyle: { bannerColor: '#0f6f6c', buttonBackground: '#0f6f6c', menuColor: '#0f6f6c', linksColor: '#0f6f6c', priceColor: '#0f6f6c' },
    },
  }
  const culqi = new w.CulqiCheckout(o.llavePublica, config)
  culqi.culqi = () => {
    if (culqi.token?.id) {
      const token = culqi.token.id as string
      culqi.close()
      o.onToken(token)
    } else if (culqi.error) {
      o.onError(culqi.error.user_message || culqi.error.merchant_message || 'Culqi no aceptó la tarjeta.')
    }
  }
  culqi.open()
}

export interface Datos3ds {
  eci?: string; xid?: string; cavv?: string; protocolVersion?: string; directoryServerTransactionId?: string
}

/**
 * El banco pidió confirmar: abre Culqi3DS con el mismo token y devuelve los
 * datos de autenticación (o null si la persona cerró la ventana).
 */
export async function autenticar3ds(llavePublica: string, token: string, correo: string, montoCentimos: number): Promise<Datos3ds | null> {
  await cargar(TRES_DS)
  const w = window as any
  const c3 = w.Culqi3DS
  if (!c3) throw new Error('La confirmación del banco no está disponible ahora.')
  c3.reset?.()
  c3.publicKey = llavePublica

  return new Promise<Datos3ds | null>(resolver => {
    const alRecibir = (e: MessageEvent) => {
      const d = e.data as any
      if (!d || typeof d !== 'object') return
      if (d.parameters3DS) { quitar(); resolver(d.parameters3DS as Datos3ds) }
      else if (d.error) { quitar(); resolver(null) }
    }
    const quitar = () => window.removeEventListener('message', alRecibir)
    window.addEventListener('message', alRecibir)

    c3.settings = {
      charge: { totalAmount: Math.max(100, montoCentimos), returnUrl: window.location.href, currency: 'PEN' },
      card: { email: correo },
    }
    c3.options = {
      showModal: true, showLoading: true, showIcon: true,
      closeModalAction: () => { quitar(); resolver(null) },
      style: { btnColor: '#0f6f6c', btnTextColor: '#ffffff' },
    }
    void c3.initAuthentication(token)
  })
}