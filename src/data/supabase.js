import { createClient } from '@supabase/supabase-js';
import { SHOP } from './config';

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const configured = Boolean(url && anonKey);
export const supabase = configured ? createClient(url, anonKey) : null;
export const IMAGES_BUCKET = 'product-images';

// Convierte la ruta de una imagen (local del bucket o URL) en una URL visible.
export function publicImageUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (!configured) return path;
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${IMAGES_BUCKET}/${path}`;
}

// Claves editables desde /admin → Configuración. Si agregas una aquí,
// recuerda: (1) su valor por defecto en config.js, (2) su fila en supabase/schema.sql.
export const SETTINGS_KEYS = [
  'shopName', 'whatsapp', 'freeShip',
  'email', 'instagram', 'hours',
  'heroPromo',
  'currencyBase', 'rateCUP', 'rateEUR'
];

// Convierte las filas de la tabla settings en el objeto que usa la tienda.
// Los valores por defecto salen de config.js, así la tienda nunca queda vacía
// aunque la base todavía no tenga las filas nuevas.
export function moneySettings(rows) {
  const map = {
    shopName: SHOP.name,
    whatsapp: SHOP.whatsapp,
    freeShip: String(SHOP.freeShip),
    email: SHOP.email,
    instagram: SHOP.instagram,
    hours: SHOP.hours,
    heroPromo: SHOP.heroPromo || '',
    currencyBase: SHOP.currencyBase,
    rateCUP: SHOP.rateCUP,
    rateEUR: SHOP.rateEUR
  };
  rows.forEach(r => { if (r.key in map) map[r.key] = r.value; });
  return {
    name: map.shopName,
    whatsapp: map.whatsapp,
    freeShip: Number(map.freeShip) || 0,
    email: map.email,
    instagram: map.instagram,
    hours: map.hours,
    heroPromo: map.heroPromo || '',
    currencyBase: map.currencyBase,
    rateCUP: map.rateCUP,
    rateEUR: map.rateEUR
  };
}