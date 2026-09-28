# Plataforma — Web

React 19 + TypeScript + Vite. El front de `reyban_plataforma`.

---

## Cómo se levanta

Con la base y la API corriendo:

```powershell
npm install
npm run dev
```

Y se abre en `http://localhost:5173`.

Para producción, `npm run build` compila a `../Plataforma.Api/wwwroot`, que es
desde donde lo sirve la API.

> **El proxy de desarrollo no es comodidad.** Vite sirve en el 5173 y la API en
> el 5255: sin proxy son dos orígenes distintos y el navegador **no manda la
> cookie de sesión**. Todo respondería 401 y parecería que el ingreso está
> roto. Está configurado en `vite.config.ts` y no se quita.

---

## La estructura

```
src/
├─ main.tsx                 arranque
├─ App.tsx                  decide qué se pinta según el estado de la sesión
│
├─ nucleo/                  lo transversal. Espejo de Plataforma.Core
│  ├─ api/                  el único sitio que habla con la API
│  ├─ sesion/               quién está dentro
│  ├─ autorizacion/         permisos y rutas protegidas
│  └─ estilos/              los tokens y las clases base
│
├─ componentes/             piezas sin negocio, reutilizables
│
├─ disposicion/             el marco: cabecera, menú, hueco de contenido
│
├─ rutas/                   el mapa de rutas
│
└─ modulos/                 una carpeta por módulo, igual que en el back
   ├─ acceso/               ingreso, cambio de contraseña, 2FA
   ├─ inicio/
   ├─ administracion/       empresas, usuarios, roles
   └─ facturacion/          cuando exista
```

### Dentro de cada módulo

```
modulos/administracion/
├─ servicios/    las llamadas a la API, con tipos
├─ vistas/       las pantallas
├─ componentes/  piezas propias de este módulo (si las necesita)
└─ tipos.ts      las formas que devuelve su parte de la API
```

---

## Las cuatro reglas

**1. Una vista nunca llama a `fetch`.** Llama a un servicio de su módulo, y el
servicio llama a `nucleo/api/cliente`. Así, el día que haya que añadir una
cabecera, un reintento o un registro a todas las llamadas, hay un solo sitio
donde tocar.

**2. Un módulo no importa de otro módulo.** Si dos módulos necesitan lo mismo,
eso sube a `nucleo/` o a `componentes/`. Es la misma regla del back, y por el
mismo motivo: es lo que permite repartir módulos entre personas.

**3. El menú sale de `/api/yo`, no del código.** Lo calcula la base cruzando
módulo contratado, rol y permiso. El front lo pinta.

**4. Ocultar un botón no es seguridad.** Esconder lo que el usuario no puede
hacer es comodidad; la comprobación real está en cada endpoint. Si alguien
escribe la URL a mano, el back devuelve 403.

---

## Lo que no está aquí, y es a propósito

**Ningún token, ni en `localStorage` ni en ningún sitio.** La sesión viaja en
una cookie `HttpOnly` que este código **no puede leer** — que es justamente lo
que impide que un XSS se la lleve. El navegador la manda porque
`credentials: 'include'` se lo pide.

**Ninguna copia del usuario ni de sus permisos.** La fuente de verdad es
`/api/yo`. Guardar una copia haría que, si el administrador revoca la sesión o
suspende la empresa, el front siguiera pintando el menú como si nada.

**Ningún cálculo de totales que se dé por bueno.** Cuando llegue facturación,
el editor de líneas podrá ir sumando mientras el usuario escribe, pero eso es
una vista previa: la cifra que se firma sale del servicio de facturación.

---

## Añadir un módulo

1. `src/modulos/<nombre>/` con `servicios/`, `vistas/` y su `tipos.ts`
2. Sus rutas en `src/rutas/rutas.tsx`, envueltas en `<Protegido permiso={...}>`
3. Los códigos de permiso nuevos en `src/nucleo/autorizacion/permisos.ts`,
   copiados del `Permisos.cs` del back

El menú no se toca: la entrada aparece sola cuando la empresa contrata el
módulo, porque sale de `/api/yo`.
