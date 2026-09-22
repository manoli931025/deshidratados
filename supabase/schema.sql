-- ============================================================
-- Solaria · Esquema Supabase (Postgres)
-- Pega este archivo completo en: Supabase Dashboard → SQL Editor → New query → Run
-- Se puede ejecutar más de una vez sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- TABLAS
-- ------------------------------------------------------------

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  label       text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  category_id uuid references public.categories(id) on delete set null,
  description text not null default '',
  origin      text not null default '',
  rating      numeric(2,1) not null default 0,
  reviews     int  not null default 0,
  badge       text,
  image       text not null default '',
  active      boolean not null default true,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  weight      text not null default '100',
  label       text not null,
  price       numeric(10,2) not null default 0
);

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone         text not null default '',
  items         jsonb not null default '[]'::jsonb,
  total         numeric(10,2) not null default 0,
  status        text not null default 'Nuevo',
  created_at    timestamptz not null default now()
);

create table if not exists public.settings (
  key   text primary key,
  value text not null default ''
);

-- Indices útiles
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_variants_product on public.variants(product_id);
create index if not exists idx_orders_created on public.orders(created_at desc);

-- ------------------------------------------------------------
-- SEGURIDAD (Row Level Security)
-- Lectura pública del catálogo · Escritura solo admin · Insert de pedidos público
-- ------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.products   enable row level security;
alter table public.variants   enable row level security;
alter table public.settings   enable row level security;
alter table public.orders     enable row level security;

-- Catálogo: cualquiera puede leer
drop policy if exists "categories public read" on public.categories;
create policy "categories public read"         on public.categories for select using (true);
drop policy if exists "products public read"   on public.products;
create policy "products public read"           on public.products   for select using (true);
drop policy if exists "variants public read"   on public.variants;
create policy "variants public read"           on public.variants   for select using (true);
drop policy if exists "settings public read"   on public.settings;
create policy "settings public read"           on public.settings   for select using (true);

-- Catálogo: solo usuarios autenticados (el admin) escriben
drop policy if exists "categories admin write" on public.categories;
create policy "categories admin write"         on public.categories for all to authenticated using (true) with check (true);
drop policy if exists "products admin write"   on public.products;
create policy "products admin write"           on public.products   for all to authenticated using (true) with check (true);
drop policy if exists "variants admin write"   on public.variants;
create policy "variants admin write"           on public.variants   for all to authenticated using (true) with check (true);
drop policy if exists "settings admin write"   on public.settings;
create policy "settings admin write"           on public.settings   for all to authenticated using (true) with check (true);

-- Pedidos: cualquiera puede crear (checkout), solo el admin los ve o edita
drop policy if exists "orders public insert"   on public.orders;
create policy "orders public insert"           on public.orders for insert with check (true);
drop policy if exists "orders admin manage"    on public.orders;
create policy "orders admin manage"            on public.orders for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- STORAGE · Bucket de imágenes de productos
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "images public read"   on storage.objects;
drop policy if exists "images admin write"   on storage.objects;
drop policy if exists "images admin update"  on storage.objects;
drop policy if exists "images admin delete"  on storage.objects;

create policy "images public read"  on storage.objects for select using (bucket_id = 'product-images');
create policy "images admin write"  on storage.objects for insert to authenticated with check (bucket_id = 'product-images');
create policy "images admin update" on storage.objects for update to authenticated using (bucket_id = 'product-images');
create policy "images admin delete" on storage.objects for delete to authenticated using (bucket_id = 'product-images');

-- ------------------------------------------------------------
-- SEMILLA · Categorías, productos y config iniciales
-- (coinciden con los datos que hoy trae la tienda por código)
-- Nota: las imágenes quedan como placeholder; cámbialas desde /admin
-- ------------------------------------------------------------

insert into public.categories (slug, label, sort_order) values
  ('frutas',   'Frutas',   1),
  ('verduras', 'Verduras', 2),
  ('mixes',    'Mixes',    3)
on conflict (slug) do nothing;

insert into public.settings (key, value) values
  ('shopName', 'Solaria'),
  ('whatsapp', '5215500000000'),
  ('freeShip', '600')
on conflict (key) do nothing;

insert into public.products
  (slug, name, category_id, description, origin, rating, reviews, badge, image, active, sort_order)
values
  ('mango',
   'Mango Ataulfo',
   (select id from public.categories where slug = 'frutas'),
   'Láminas dulces y chiclosas, sin azúcar añadida. El favorito de la casa.',
   'Nayarit', 4.9, 312, 'Más vendido', 'https://picsum.photos/seed/mango-seco/600/600', true, 1),
  ('pina',
   'Piña Golden',
   (select id from public.categories where slug = 'frutas'),
   'Trozos con acidez brillante, perfectos para snack y repostería.',
   'Veracruz', 4.7, 198, null, 'https://picsum.photos/seed/pina-seca/600/600', true, 2),
  ('manzana',
   'Manzana y Canela',
   (select id from public.categories where slug = 'frutas'),
   'Láminas crujientes espolvoreadas con canela de verdad.',
   'Chihuahua', 4.8, 251, null, 'https://picsum.photos/seed/manzana-seca/600/600', true, 3),
  ('tomate',
   'Tomate Seco',
   (select id from public.categories where slug = 'verduras'),
   'Mitades intensas para pastas, antipasti y aceites aromatizados.',
   'Sinaloa', 4.9, 289, 'Favorito', 'https://picsum.photos/seed/tomate-seco/600/600', true, 4),
  ('chile',
   'Chile Ancho',
   (select id from public.categories where slug = 'verduras'),
   'Secado tradicional para guisos, moles y salsas con cuerpo.',
   'Zacatecas', 4.7, 122, null, 'https://picsum.photos/seed/chile-ancho/600/600', true, 5),
  ('mix',
   'Mix Senderista',
   (select id from public.categories where slug = 'mixes'),
   'Mango, arándano, almendra y pepita. Energía de montaña.',
   'Casa Solaria', 4.9, 341, 'Nuevo', 'https://picsum.photos/seed/trail-mix/600/600', true, 6)
on conflict (slug) do nothing;

insert into public.variants (product_id, weight, label, price)
select p.id, v.weight, v.label, v.price
from (values
  ('mango',   '50',  '50 g',   27),
  ('mango',   '100', '100 g',  45),
  ('mango',   '250', '250 g',  99),
  ('pina',    '50',  '50 g',   25),
  ('pina',    '100', '100 g',  42),
  ('pina',    '250', '250 g',  92),
  ('manzana', '50',  '50 g',   23),
  ('manzana', '100', '100 g',  38),
  ('manzana', '250', '250 g',  84),
  ('tomate',  '50',  '50 g',   33),
  ('tomate',  '100', '100 g',  55),
  ('tomate',  '250', '250 g',  121),
  ('chile',   '50',  '50 g',   24),
  ('chile',   '100', '100 g',  40),
  ('chile',   '250', '250 g',  88),
  ('mix',     '50',  '50 g',   37),
  ('mix',     '100', '100 g',  62),
  ('mix',     '250', '250 g',  136)
) as v(product_slug, weight, label, price)
join public.products p on p.slug = v.product_slug;