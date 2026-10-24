# Guía: Envío de correos con Resend + Supabase Edge Functions

Este documento explica cómo configurar el envío de boletines y emails de
bienvenida de la tienda. **Todo se hace en el navegador: no hace falta
instalar la CLI de Supabase.**

---

## Arquitectura

```
Frontend (React)
    ↓  solo llama a la URL de la Edge Function
Supabase Edge Function  send-email
    ↓  1. Lee el remitente de la tabla `settings`
    ↓  2. Valida destinatarios y trocea en lotes de 50
    ↓  3. Llama a Resend con la API key (secret, nunca en el navegador)
Resend  →  SMTP  →  bandeja del destinatario
```

**El remitente (`newsletter_from`) se lee SIEMPRE desde la base de datos**
dentro de la función. El navegador no puede cambiarlo, así que nadie puede
suplantar al emisor desde las herramientas del desarrollador.

**Qué ve alguien que abra las herramientas del navegador:**

```
https://TU-PROYECTO.supabase.co/functions/v1/send-email
sb_publishable_...   (anon key, pública por diseño)
```

No hay ninguna API key en el JavaScript.

---

## Orden de los pasos

| # | Paso | Dónde |
|---|---|---|
| 1 | Ejecutar la migración SQL | Supabase → SQL Editor |
| 2 | Guardar la API key de Resend | Supabase → Edge Functions → Secrets |
| 3 | Desplegar la Edge Function `send-email` | Supabase → Edge Functions |
| 4 | Configurar el remitente | Tu tienda → `/admin` |
| 5 | Probar | El propio panel |

---

## Paso 1: Ejecutar la migración SQL

En **Supabase → SQL Editor**, pega y ejecuta:

```
supabase/upgrade-2026-10-24.sql
```

Solo existen dos ficheros SQL en el proyecto:

| Fichero | Cuándo |
|---|---|
| `schema.sql` | Base **nueva** → crea todo e inserta el catálogo |
| `upgrade-2026-10-24.sql` | Base **existente** (la tuya) → la lleva al estado actual |

Es 100 % idempotente (puede ejecutarse muchas veces) y **no destructivo**.

**Qué debe aparecer:** `Success. No rows affected`. Es correcto: crea
estructura, no filas.

> Nota: `newsletter_from` se siembra con `on conflict do nothing`, así que si
> ya tiene un valor no lo pisa. Si es vacío o no es el que quieres, cámbialo
> desde el panel (Paso 4).

---

## Paso 2: Guardar la API key de Resend

1. [supabase.com/dashboard](https://supabase.com/dashboard) → tu proyecto
2. Sidebar → **Edge Functions → Secrets**
   (directo: `https://supabase.com/dashboard/project/_/functions/secrets`)
3. **Add secret** con estos valores:

| Key | Value |
|---|---|
| `RESEND_API_KEY` | tu API key de [resend.com](https://resend.com) → **API Keys** |

4. Pulsa **Save**

> Los secrets tardan hasta **1 minuto** en propagarse. No hace falta
> redesplegar la función: los lee en cada llamada.
>
> **Regla:** el nombre de un secret no puede empezar por `SUPABASE_`.

**Dónde está tu API key:** en el dashboard de Resend → **API Keys** →
botón **Create API Key**. Copia el valor (empieza por `re_...`).

---

## Paso 3: Desplegar la Edge Function

**Opción A · Desde el dashboard (recomendada, sin instalar nada)**

1. Sidebar → **Edge Functions**
2. **"Deploy a new function"** → **"Via Editor"**
3. **Name:** `send-email` ← **con guion**
4. Borra la plantilla y pega **todo** el contenido de
   `supabase/functions/send-email/index.ts`
5. **"Deploy function"** al pie del editor

Quedará vivo en:

```
https://TU-PROYECTO.supabase.co/functions/v1/send-email
```

> El editor del dashboard no tiene control de versiones. El código fuente de
> verdad está en tu repo: si lo editas desde el dashboard, copia el cambio
> de vuelta a `supabase/functions/send-email/index.ts`.

**Opción B · Con la CLI**

```bash
supabase login
supabase link --project-ref tu-project-ref
supabase functions deploy send-email
```

---

## Paso 4: Configurar el remitente

1. Inicia sesión en `/admin` → **Configuración**
2. **"Email remitente del boletín"** → rellena
3. Guarda

### ⚠️ Aquí está lo importante: qué remitente usar

Comprobado empíricamente con la API de Resend:

| Remitente | Resultado |
|---|---|
| `onboarding@resend.dev` | ✅ **HTTP 200 — se envía** |
| `manoli931025@gmail.com` | ❌ 403 `domain is not verified` |
| `algo@manoli931025.github.io` | ❌ 403 — GitHub controla ese DNS |
| Cualquier dominio sin verificar en Resend | ❌ 403 |

Resend **exige un dominio propio verificado** (registra un TXT en su DNS).
Los tres ficheros con credenciales de este repo no contienen ningún dominio
propio, porque no lo hay todavía.

**Por tanto, para que funcione HOY:**

```
onboarding@resend.dev
```

Ese es el valor por defecto que siembra la migración. Admite nombre visible:

```
Solaria · Deshidratados <onboarding@resend.dev>
```

### El coste: los correos van a Spam

`onboarding@resend.dev` **es un dominio de pruebas compartido de Resend**,
usado por miles de desarrolladores. Su reputación para contenido tipo
boletín es mala, y los filtros la clasifican como sospechosa.

**Lo que NO depende de ti** (no hay nada que configurar para arreglarlo):

- No puedes firmar SPF/DKIM en nombre de `resend.dev` — lo firma Resend
- No puedes calentar esa reputación: no es tuya
- Marcar el remitente como "no es spam" solo mejora **la reputación del
  remitente hacia ese buzón concreto**, nada más

**Lo que sí puedes hacer:**

1. **Que el destinatario te guarde en contactos.** Es lo más eficaz sin
   dominio propio: una vez guardado, los siguientes suelen entrar a
   Inbox directamente.
2. **Que marquen "No es spam" la primera vez.** Ayuda para ese buzón.
3. **Evitar spamas: imágenes sin texto, mayúsculas, exceso de signos
   "¡!".** El filtro mira el contenido y el comportamiento.
4. **No enviar rápidamente varios correos idénticos** — eso es exactamente
   lo que dispara los filtros (es lo que hicieron las 3 pruebas seguidas
   del desarrollo, y por eso cayeron en Spam).

**La única solución real: un dominio propio** (~8–15 $/año, `.cu` suele
ser más caro y burocrático). Con él:

1. Se registra en Resend → aparece en **Domains**
2. Resend da unos registros DNS a añadir en tu registradora
3. Estado → **Verified**
4. El remitente pasa a ser `hola@tudominio.com`
5. SPF/DKIM/DMARC quedan firmados **por tu dominio** → fuera de Spam

Hasta entonces, el sistema **funciona**: los correos se envían, llegan, se
guardan en `newsletter_history` y el panel muestra cuántos salieron. Solo
es la carpeta de destino la que no es ideal.

---

## Paso 5: Probar

### Desde el panel

1. `/admin` → **Configuración** → sección **Boletín**
2. Edita asunto y HTML. La **vista previa de la derecha** muestra, en vivo,
   lo que verá el suscriptor (misma plantilla, mismo ancho de 600px).
3. **"Guardar borrador"** si solo quieres conservar los cambios:
   **no envía nada nunca**, se limita a guardar en `settings`.
4. **"Enviar boletín a N suscriptores"** no envía directamente: primero
   valida el HTML y abre una **confirmación en línea** con el recuento de
   destinatarios y cualquier aviso. Hay que pulsar de nuevo para mandarlo.

**Qué bloquea el envío** (errores, no se puede continuar):

- Asunto o contenido vacío, o contenido sin texto visible.

**Qué solo avisa** (aparece en la confirmación, y tú decides):

- Etiquetas sin cerrar — Gmail suele tragar el resto del contenido.
- Falta el bloque `<style>` — llegará sin diseño.
- Falta el enlace de baja — afecta a la reputación y a la normativa.
- El contenido es mucho más corto que la última versión guardada —
  el típico `Ctrl+A` accidental.

Si algo sale mal, la sección **Historial de envíos** guarda los últimos
boletines enviados y tiene un botón **"Restaurar"** que los carga de vuelta
en el editor. También hay **"Restaurar plantilla original"** para volver a
la plantilla de fábrica.

Para probar sin listas, suscríbete tú primero desde el pie de la tienda.

### Desde el dashboard de Supabase

1. Entra en la función `send-email` → pestaña **Test** → **POST**
2. Headers: `Content-Type: application/json`
3. Body:

```json
{ "to": ["tucuenta@gmail.com"], "subject": "Prueba Solaria", "html": "<h1>Hola</h1>", "type": "welcome" }
```

4. **Send Request**

Respuesta correcta:

```json
{ "ok": true, "sent": 1, "failed": 0, "remaining": 0, "errors": [] }
```

**Mira también en la pestaña Logs**: cada fallo concreto de Resend se
registra con `console.error` e incluye la respuesta real de la API.

---

## Solución de problemas

### «Falta el secret RESEND_API_KEY»
- Añádelo en **Edge Functions → Secrets** (Paso 2). Espera 1 minuto.

### `403 domain is not verified`
- El remitente no es `onboarding@resend.dev` ni un dominio verificado en
  Resend. Corrígelo en `/admin` → Configuración (Paso 4).

### `401`
- La API key no es válida o fue revocada. Regenera una en el dashboard de
  Resend y actualiza el secret.

### `429` / rate limit
- Demasiadas peticiones seguidas. Espera unos segundos y reintenta.
  La función ya trocea en lotes de 50 para evitarlo.

### `Error leyendo configuración: relation "settings" does not exist`
- Falta la migración. Ejecuta `supabase/upgrade-2026-10-24.sql` (Paso 1).

### Los correos van a Spam
- Es esperable con `onboarding@resend.dev`. Ver **Paso 4** arriba.
- Para salir de Spam hace falta dominio propio.

### El panel dice "Enviados X de Y"
- Es un envío **parcialmente** fallido. La lista `errors` que devuelve la
  función indica exactamente qué correos fallaron y por qué.

### «El boletín aún no está habilitado» en el pie de la tienda
- Faltan las tablas `subscribers` o `settings`. Ejecuta la migración.

### Revisar el historial
- `newsletter_history` guarda cada boletín enviado (asunto, HTML y
  número de destinatarios). Útil para auditar desde el panel.

---

## Variables de entorno (frontend)

El frontend solo necesita dos, y son **públicas** (no son secretos):

```env
REACT_APP_SUPABASE_URL=https://TU-PROYECTO.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sb_publishable_...
```

Van en `.env.local` (ignorado por git) y en los **secrets de GitHub Actions**
para el despliegue en GitHub Pages.

**Nunca** pongas aquí la API key de Resend: esa vive en Supabase.

---

## Seguridad

### ¿Qué ve alguien que abra las herramient del navegador?

Solo dos cosas:

```
https://TU-PROYECTO.supabase.co/functions/v1/send-email
sb_publishable_...   (anon key, pública por diseño)
```

No hay ninguna API key en el JavaScript. Para abusar de la función
necesitaría la anon key **y** aún así solo podría enviar correos desde tu
configuración, sin poder leer nada.

### ¿Y si alguien manda envíos masivos desde fuera?

Tres defensas:

1. **Verify JWT** — Supabase exige un JWT válido en la cabecera `Authorization`.
2. **Límite de 50 por invocación** — no puede vaciar una lista de un golpe
   (y es el máximo que Resend acepta por request).
3. **Resend es el último filtro** — su rate limit y tu cuota diaria.

Cada suscriptor recibe **su propio mensaje**: nunca se pone a todos en el
mismo `To`, así que nadie ve la lista de los demás (algo que sí pasaría
si se mandara en un solo envío).

---

## Límites

| Concepto | Valor |
|---|---|
| Destinatarios por request (máximo Resend) | **50** |
| Destinatarios por invocación de la función | **50** |
| Envío de un boletín grande | Se trocea desde el frontend, sin límite práctico |
| Plan gratuito de Resend | 3 000 correos/mes, 100/día |

---

## Checklist final

**Base de datos**
- [ ] `supabase/upgrade-2026-10-24.sql` ejecutado → `Success. No rows affected`
- [ ] Escrita una reseña en la tienda → aparece sola al recargar
- [ ] Los comentarios de las reseñas aparecen

**Supabase**
- [ ] Secret `RESEND_API_KEY` guardado
- [ ] Función `send-email` desplegada (con guion)
- [ ] Prueba desde el dashboard devuelve `"ok": true`

**Panel**
- [ ] Email remitente = `onboarding@resend.dev` (o dominio verificado)
- [ ] Suscribirse en el pie → llega el email de bienvenida
- [ ] Enviar el boletín → llega a los suscriptores
- [ ] Revisar `newsletter_history` → aparece el envío

**Entrega**
- [ ] Avisado al destinatario de que el correo está en Spam
- [ ] Guardado en contactos → los siguientes entran a Inbox

---

## Soporte

Si tienes problemas:

1. Supabase Dashboard → **Edge Functions → send-email → Logs** (ahí están
   todos los `console.error` con la respuesta real de Resend)
2. Revisa que el secret esté bien copiado (sin espacios al final)
3. Consola del navegador (F12) para ver errores del frontend
