# Solaria · Deshidratados

Tienda en línea de frutas y verduras deshidratadas hecha con **React (Create React App)** + **Supabase** y publicada en **GitHub Pages**. Incluye un panel de administración propio (tipo Django admin) en la ruta `/#/admin`.

## Modelo de negocio

- **El pedido siempre se entrega en Cuba.**
- **El comprador puede estar en cualquier lugar del mundo**: muchos clientes piden desde el exterior para sus familias en la isla.
- **No hay pasarela de pago.** El pago se cierra por WhatsApp, lo que permite aceptar Transfermóvil, depósito BPA/BANMET, tarjeta MLC, efectivo, remesa y cripto (USDT/TRON) sin depender de ningún procesador internacional.

## Características

- Catálogo con categorías, búsqueda y precios por presentación (gramos).
- **Multi-moneda**: los precios se muestran en **CUP, USD o EUR**. Se detecta la moneda por el idioma del navegador y el visitante puede cambiarla con un selector. Los tipos de cambio se fijan manualmente desde el panel (no son automáticos).
- Carrito de compras con resumen del pedido, total convertido y aviso de envío gratis.
- Checkout corto: nombre + teléfono (44 países, Cuba por defecto) → registra el pedido en Supabase y abre WhatsApp con el pedido armado. El mensaje indica siempre que la entrega es en Cuba.
- Reseñas de clientes con moderación (aprueba o rechaza desde el panel).
- Boletín (newsletter) que guarda los suscriptores en la base de datos.
- **Páginas legales** enlazadas en el pie: Envíos y pagos, Términos y condiciones, Aviso de privacidad y Aviso de cookies. El contenido se reescribe desde el panel sin tocar código.
- Panel de administración: productos (galería de imágenes por presentación), categorías, presentaciones, reseñas, pedidos, suscriptores, configuración y documentos legales.
- El pie de página se alimenta de la configuración: nada de datos fijos en el código.
- Sin Supabase configurado, la tienda funciona con datos de demostración (`src/data/products.js`).

### Páginas legales

| Ruta | Documento |
|---|---|
| `/#/doc/envios` | Envíos y pagos (zonas, plazos, los 5 métodos de pago) |
| `/#/doc/terminos` | Términos y condiciones |
| `/#/doc/privacidad` | Aviso de privacidad (declara Supabase y GitHub Pages) |
| `/#/doc/cookies` | Aviso de cookies (solo `localStorage`, sin terceros) |

- El contenido por defecto vive en [`src/data/legalContent.js`](src/data/legalContent.js).
- **Configuración → Documentos legales** permite reescribirlos desde el panel. Lo que haya en la base de datos tiene prioridad; vaciar el campo restaura el texto original.
- Formato aceptado en el panel: `#` y `##` para títulos, `**negritas**`, listas con `-` y numeradas con `1.`, enlaces `[texto](https://…)`, citas `>` y texto monoespaciado con `` ` ``. El texto se escapa antes de renderizar, así que no se puede inyectar HTML.
- `public/sitemap.xml` indexa la portada y los 4 documentos; `public/robots.txt` lo referencia.

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Regístrate en <https://supabase.com> y crea un proyecto nuevo.
2. Ve a **SQL Editor → New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y ejecútalo (**Run**).
   - Esto crea las tablas (`categories`, `products`, `presentations`, `variants`, `reviews`, `subscribers`, `orders`, `settings`), activa Row Level Security, crea el bucket de imágenes `product-images` e inserta el catálogo de demostración.
3. Crear el usuario administrador del panel: **Authentication → Users → Add user** (email + contraseña).

> **Base ya existente:** si el proyecto Supabase es anterior a esta versión, ejecuta además
> [`supabase/upgrade-subscribers-settings.sql`](supabase/upgrade-subscribers-settings.sql)
> (agrega la tabla de suscriptores, las claves del pie de página y las de multi-moneda).
> Todos los archivos `supabase/upgrade-*.sql` son idempotentes: puedes correrlos más de una vez y **no pisan** los valores que ya hayas guardado.

### 2. Configurar la tienda

Una vez dentro del panel, en **Configuración**:

| Campo | Qué es |
|---|---|
| `Moneda de los precios` | En qué moneda escribes los precios en Productos (por defecto `USD`) |
| `CUP por 1 USD` | Tipo de cambio manual hacia el peso cubano. **Ajústalo cuando cambie el mercado** |
| `EUR por 1 USD` | Tipo de cambio manual hacia el euro |
| `Envío gratis a partir de` | Monto en la moneda base |

> Los tipos de cambio **no son automáticos**: el negocio los controla. La tienda muestra un aviso al visitante de que el importe final se confirma en la moneda base por WhatsApp.

### 2. Configurar el proyecto local

1. Copia `.env.example` a `.env.local` y completa los valores con los de tu proyecto (en Supabase, **Project Settings → API**):
   - `REACT_APP_SUPABASE_URL` → URL del proyecto (ej. `https://xxxx.supabase.co`).
   - `REACT_APP_SUPABASE_ANON_KEY` → anon/public key.
   - `.env.local` está en `.gitignore`: nunca se suben las claves.
2. Instala dependencias y arranca:

```bash
npm install
npm start
```

3. Abre <http://localhost:3000> para ver la tienda y <http://localhost:3000/#/admin> para el panel (inicia sesión con el usuario que creaste).

### 3. Publicar en GitHub Pages (deploy automático)

1. Sube los cambios a la rama `main` del repositorio (`git push`).
2. En el repositorio de GitHub: **Settings → Secrets and variables → Actions**, agrega los secrets:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
3. El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compila la app con esos valores y la publica automáticamente en GitHub Pages. El sitio queda en `https://<usuario>.github.io/<repositorio>/` y el panel en `.../#/admin`.

## Scripts

- `npm start` — ejecuta la app en modo desarrollo.
- `npm run build` — genera el build de producción en `build/`.
- `npm test` — ejecuta las pruebas.

## Estructura relevante

- `supabase/schema.sql` — migración completa de la base de datos (tablas, RLS, storage, seed).
- `src/data/supabase.js` — cliente de Supabase, detector de configuración y utilidades de imagen.
- `src/data/currency.js` — multi-moneda: detección por idioma, conversión y formato de precios.
- `src/data/shop.js` — estado global de la tienda (`ShopProvider`/`useShop`) y registro de pedidos (`submitOrder`).
- `src/admin/` — panel de administración (login, productos, categorías, reseñas, pedidos, suscriptores, configuración).
- `.github/workflows/deploy.yml` — despliegue automático a GitHub Pages inyectando los secrets de Supabase.