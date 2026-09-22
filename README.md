# Solaria · Deshidratados

Tienda en línea de frutas y verduras deshidratadas hecha con **React (Create React App)** + **Supabase** y publicada en **GitHub Pages**. Incluye un panel de administración propio (tipo Django admin) en la ruta `/#/admin`.

## Características

- Catálogo con categorías, búsqueda y precios por presentación (gramos).
- Carrito de compras con resumen del pedido y total.
- Checkout corto: nombre + teléfono → registra el pedido en Supabase y abre WhatsApp para confirmar.
- Panel de administración: productos (subir imágenes), categorías, pedidos y configuración (nombre, WhatsApp, envío gratis).
- Sin Supabase configurado, la tienda funciona con datos de demostración (`src/data/products.js`).

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Regístrate en <https://supabase.com> y crea un proyecto nuevo.
2. Ve a **SQL Editor → New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y ejecútalo (**Run**).
   - Esto crea las tablas (`categories`, `products`, `variants`, `orders`, `settings`), activa Row Level Security, crea el bucket de imágenes `product-images` e inserta el catálogo de demostración.
3. Crear el usuario administrador del panel: **Authentication → Users → Add user** (email + contraseña).

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
- `src/data/shop.js` — estado global de la tienda (`ShopProvider`/`useShop`) y registro de pedidos (`submitOrder`).
- `src/admin/` — panel de administración (login, productos, categorías, pedidos, configuración).
- `.github/workflows/deploy.yml` — despliegue automático a GitHub Pages inyectando los secrets de Supabase.