-- ============================================================
-- MIGRACIÓN · Galería de fotos + Reseñas
-- Ejecutar en Supabase → SQL Editor (además del schema.sql base)
-- Idempotente: puede correrse más de una vez sin daño.
-- ============================================================

-- 1. GALERÍA · Columna images (array de rutas/URLs) en products
alter table public.products
  add column if not exists images text[] not null default '{}';

-- 1b. GALERÍA POR PRESENTACIÓN · Columnas images en variants
alter table public.variants
  drop column if exists image;
alter table public.variants
  add column if not exists images text[] not null default '\{\}';
update public.variants set images = '\{\}' where images is null;
alter table public.variants alter column images set default '\{\}';
alter table public.variants alter column images set not null;

-- 2. RESEÑAS · Tabla de opiniones de clientes
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  author text not null,
  rating int not null check (rating between 1 and 5),
  comment text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

-- Lectura pública solo de aprobadas
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews
  for select using (status = 'approved');

-- Cualquiera puede enviar una reseña (queda pendiente de moderación)
drop policy if exists "reviews public insert" on public.reviews;
create policy "reviews public insert" on public.reviews
  for insert with check (status = 'pending');

-- Admin gestiona todo
drop policy if exists "reviews admin manage" on public.reviews;
create policy "reviews admin manage" on public.reviews
  for all to authenticated using (true) with check (true);

create index if not exists reviews_product_idx on public.reviews (product_id);
create index if not exists reviews_status_idx on public.reviews (status);
