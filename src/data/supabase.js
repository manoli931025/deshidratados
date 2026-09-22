import { createClient } from '@supabase/supabase-js';

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

export const SETTINGS_KEYS = ['shopName', 'whatsapp', 'freeShip'];

export function moneySettings(rows) {
  const map = { shopName: 'Solaria', whatsapp: '', freeShip: '600' };
  rows.forEach(r => { map[r.key] = r.value; });
  return {
    name: map.shopName,
    whatsapp: map.whatsapp,
    freeShip: Number(map.freeShip) || 0
  };
}