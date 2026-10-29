-- ============================================================
-- Solaria · Migración 2026-10-24
--
-- Pega este archivo COMPLETO en:
--   Supabase Dashboard → SQL Editor → New query → Run
--
-- Para qué sirve: lleva una base de datos EXISTENTE al estado
-- actual del proyecto. Si montas una BD nueva, en su lugar usa
-- schema.sql (que ya trae todo esto incluido).
--
-- Es 100% idempotente: puede ejecutarse tantas veces como quieras.
-- Es NO destructivo: no borra tablas, filas ni columnas con datos.
-- Única excepción opcional: publicar reseñas pendientes (sección 5),
-- marcada con "OPCIONAL".
--
-- Contenido:
--   1. Galería de fotos (columna images si faltara)
--   2. Suscriptores del boletín
--   3. Semillas de configuración
--   4. Historial de envíos de boletines
--   5. Reseñas automáticas (corrige RLS + default)
-- ============================================================


-- ------------------------------------------------------------
-- 1. GALERÍA · Columna images (array de rutas/URLs)
--
-- Añade las columnas SOLO si no existen. Nada destructivo.
-- (schema.sql ya las incluye; esto es por si la BD es anterior.)
-- ------------------------------------------------------------
alter table public.products
  add column if not exists images text[] not null default '{}';

alter table public.variants
  add column if not exists images text[] not null default '{}';

-- Si la columna ya existía de una versión anterior (y era anulable),
-- primero rellenamos los nulos y después la endurecemos. En ese orden
-- para que `set not null` no falle.
update public.products set images = '{}' where images is null;
update public.variants set images = '{}' where images is null;

alter table public.products alter column images set default '{}';
alter table public.variants alter column images set default '{}';
alter table public.products alter column images set not null;
alter table public.variants alter column images set not null;


-- ------------------------------------------------------------
-- 2. SUSCRIPTORES · Quién se registró en el boletín
-- ------------------------------------------------------------
create table if not exists public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text not null default 'footer',
  created_at timestamptz not null default now()
);

-- El mismo correo no se registra dos veces (sin importar mayúsculas ni espacios).
create unique index if not exists subscribers_email_unique
  on public.subscribers (lower(trim(email)));

create index if not exists subscribers_created_idx
  on public.subscribers (created_at desc);

alter table public.subscribers enable row level security;

-- Cualquiera puede registrarse desde el formulario del pie de página.
drop policy if exists "subscribers public insert" on public.subscribers;
create policy "subscribers public insert" on public.subscribers
  for insert with check (true);

-- El admin (usuario autenticado) lee, edita y borra la lista completa.
drop policy if exists "subscribers admin manage" on public.subscribers;
create policy "subscribers admin manage" on public.subscribers
  for all to authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- 3. SEMILLAS · Claves editables desde /admin → Configuración
--
-- on conflict do nothing: si ya guardaste un valor desde el panel,
-- NO se pisa. Solo se crean las que falten.
-- ------------------------------------------------------------
insert into public.settings (key, value) values
  ('email',     'hola@solaria.cu'),
  ('instagram', '@solaria.seca'),
  ('hours',     E'Lun – Vie · 9:00 – 18:00\nSábado · 9:00 – 14:00\nDomingo · el sol descansa')
on conflict (key) do nothing;

-- Multi-moneda: precios visibles en CUP, USD o EUR.
-- rateCUP/rateEUR NO son automáticos: el negocio los ajusta desde /admin.
insert into public.settings (key, value) values
  ('currencyBase', 'USD'),
  ('rateCUP',      '250'),
  ('rateEUR',      '0.92')
on conflict (key) do nothing;

-- Remitente de los emails del boletín y de las bienvenidas.
-- Se lee SIEMPRE desde aquí dentro de la Edge Function: el navegador no
-- puede cambiarlo.
--
-- Debe ser una dirección VERIFICADA en Brevo (SMTP & API → Senders).
-- Si el remitente cambia, ejecuta también upgrade-2026-10-29.sql o
-- actualízalo desde el panel (NEWSLETTER_SETUP.md, Paso 4).
insert into public.settings (key, value) values
  ('newsletter_from', 'solaria024@gmail.com')
on conflict (key) do nothing;


-- ------------------------------------------------------------
-- 4. HISTORIAL DE BOLETINES · Qué se envió y cuándo
--
-- Escrito por la Edge Function (service role: salta RLS).
-- Leído solo desde el panel con sesión iniciada.
-- ------------------------------------------------------------
create table if not exists public.newsletter_history (
  id               uuid primary key default gen_random_uuid(),
  subject          text not null,
  html             text not null,
  sent_at          timestamptz not null default now(),
  recipients_count int not null default 0,
  sent_by          text not null default 'admin'
);

create index if not exists newsletter_history_sent_idx
  on public.newsletter_history (sent_at desc);

alter table public.newsletter_history enable row level security;

-- Mismo patrón que el resto de tablas del proyecto.
-- (NADA de auth.role(): está deprecado y tumba el script completo.)
drop policy if exists "newsletter_history admin manage" on public.newsletter_history;
create policy "newsletter_history admin manage" on public.newsletter_history
  for all to authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- 5. RESEÑAS AUTOMÁTICAS · El fix de verdad
--
-- PROBLEMA QUE ESTABAS TENIENDO:
--   El frontend dejó de filtrar, PERO Row Level Security sigue
--   filtrando en el servidor. La política decía
--       for select using (status = 'approved')
--   y el INSERT se hacía sin status → caía en el default 'pending'.
--   Resultado: la reseña no daba error, pero NUNCA se veía.
--
-- SOLUCIÓN:
--   · default = 'approved'  → se publica sola al crearse
--   · lectura pública = true → todo el mundo la ve
--   · inserción abierta = true → cualquiera puede opinar
--   · el admin sigue pudiendo borrar (su política no cambia)
-- ------------------------------------------------------------

-- Asegura que la tabla existe con la forma canónica.
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  author     text not null,
  rating     int not null check (rating between 1 and 5),
  comment    text not null default '',
  status     text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

-- Lectura pública: ahora se ven TODAS las reseñas.
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews
  for select using (true);

-- Inserción abierta: el status ya no se condiciona, porque
-- la propia BD pone 'approved' por defecto.
drop policy if exists "reviews public insert" on public.reviews;
create policy "reviews public insert" on public.reviews
  for insert with check (true);

-- El admin sigue gestionando todo (borrar, etc.). No cambia.
drop policy if exists "reviews admin manage" on public.reviews;
create policy "reviews admin manage" on public.reviews
  for all to authenticated using (true) with check (true);

-- El default depende de la tabla existente: se protege con un bloque
-- defensivo para que no falle si la columna no existiera.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reviews' and column_name = 'status'
  ) then
    alter table public.reviews alter column status set default 'approved';

    -- >>> OPCIONAL: si NO quieres publicar las reseñas que ya estaban
    --     pendientes, comenta esta línea con dos guiones (--)
    update public.reviews set status = 'approved' where status = 'pending';
  end if;
END;
$$;

create index if not exists reviews_product_idx on public.reviews (product_id);
create index if not exists reviews_status_idx  on public.reviews (status);


-- ============================================================
-- FIN · Espera a que diga "Success. No rows affected".
-- Eso es CORRECTO: este script crea estructura, no filas.
-- ============================================================