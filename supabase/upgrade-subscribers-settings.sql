-- ============================================================
-- MIGRACIÓN · Suscriptores del boletín + datos editables del pie de página
-- Ejecutar en Supabase → SQL Editor (además del schema.sql base)
-- Idempotente: puede correrse más de una vez sin daño.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SUSCRIPTORES · Quién se registró en el boletín
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
-- No hay política de lectura pública: los correos de los clientes no se exponen.
drop policy if exists "subscribers public insert" on public.subscribers;
create policy "subscribers public insert" on public.subscribers
  for insert with check (true);

-- El admin (usuario autenticado) lee, edita y borra la lista completa.
drop policy if exists "subscribers admin manage" on public.subscribers;
create policy "subscribers admin manage" on public.subscribers
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- 2. PIE DE PÁGINA · Nuevas claves editables desde /admin → Configuración
-- (email, Instagram y horario dejaron de estar escritos en el código)
-- ------------------------------------------------------------

insert into public.settings (key, value) values
  ('email',     'hola@solaria.cu'),
  ('instagram', '@solaria.seca'),
  ('hours',     E'Lun – Vie · 9:00 – 18:00\nSábado · 9:00 – 14:00\nDomingo · el sol descansa')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 3. MULTI-MONEDA · Precios visibles en CUP, USD o EUR
--
-- Los precios del catálogo se guardan en `currencyBase` (por defecto USD).
-- rateCUP = cuántos pesos cubanos vale 1 USD. rateEUR = cuántos euros vale 1 USD.
-- IMPORTANTE: NO son automáticos. El negocio los ajusta desde /admin →
-- Configuración porque en Cuba el tipo de cambio real no es el oficial.
-- Añadir estas claves NO pisa ningún valor que ya hayas guardado.
-- ------------------------------------------------------------

insert into public.settings (key, value) values
  ('currencyBase', 'USD'),
  ('rateCUP',      '250'),
  ('rateEUR',      '0.92')
on conflict (key) do nothing;
