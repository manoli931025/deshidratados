import { createContext, useContext, useEffect, useState } from 'react';
import { configured, supabase, publicImageUrl, moneySettings, SETTINGS_KEYS } from './supabase';
import { products as seedProducts, categories as seedCategories } from './products';
import { SHOP } from './config';

const ShopContext = createContext({
  loading: true,
  products: seedProducts,
  categories: seedCategories,
  shop: SHOP
});

export function useShop() {
  return useContext(ShopContext);
}

const DEFAULT_CATS = [{ id: 'todos', label: 'Todos' }];

function mapProduct(row, catBySlug, variantsByProduct) {
  const vs = (variantsByProduct[row.id] || [])
    .sort((a, b) => Number(a.weight || '0') - Number(b.weight || '0'))
    .map(v => ({ id: v.weight || v.label, label: v.label, price: Number(v.price) }));
  return {
    id: row.slug,
    name: row.name,
    category: catBySlug[row.category_id] ? catBySlug[row.category_id].slug : '',
    description: row.description || '',
    origin: row.origin || '',
    rating: Number(row.rating) || 0,
    reviews: Number(row.reviews) || 0,
    badge: row.badge || null,
    image: publicImageUrl(row.image),
    variants: vs
  };
}

async function loadFromSupabase() {
  const [{ data: cats }, { data: prods }, { data: vars }, { data: settings }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('products').select('*').eq('active', true).order('sort_order'),
    supabase.from('variants').select('*').order('weight'),
    supabase.from('settings').select('key, value').in('key', SETTINGS_KEYS)
  ]);

  const catBySlug = {};
  (cats || []).forEach(c => { catBySlug[c.id] = c; });

  const variantsByProduct = {};
  (vars || []).forEach(v => {
    (variantsByProduct[v.product_id] = variantsByProduct[v.product_id] || []).push(v);
  });

  const list = (prods || []).map(p => mapProduct(p, catBySlug, variantsByProduct));
  return {
    products: list,
    categories: [...DEFAULT_CATS, ...(cats || []).map(c => ({ id: c.slug, label: c.label }))],
    shop: { ...SHOP, ...moneySettings(settings || []) }
  };
}

export function ShopProvider({ children }) {
  const [state, setState] = useState({ loading: true, products: seedProducts, categories: seedCategories, shop: SHOP });

  useEffect(() => {
    let alive = true;
    if (!configured || !supabase) {
      setState({ loading: false, products: seedProducts, categories: seedCategories, shop: SHOP });
      return;
    }
    loadFromSupabase()
      .then(data => {
        if (!alive) return;
        const okProducts = data.products && data.products.length > 0;
        setState({
          loading: false,
          products: okProducts ? data.products : seedProducts,
          categories: okProducts ? data.categories : seedCategories,
          shop: data.shop && data.shop.whatsapp ? data.shop : SHOP
        });
      })
      .catch(() => {
        if (alive) setState({ loading: false, products: seedProducts, categories: seedCategories, shop: SHOP });
      });
    return () => { alive = false; };
  }, []);

  return <ShopContext.Provider value={state}>{children}</ShopContext.Provider>;
}

// Registra un pedido en la base. Devuelve { ok, error }.
// Si Supabase no está configurado responde ok:false sin romper el checkout (sigue el flujo de WhatsApp).
export async function submitOrder({ customerName, phone, items, total, shopName }) {
  if (!configured || !supabase) return { ok: false };
  try {
    const { error } = await supabase.from('orders').insert({
      customer_name: customerName,
      phone,
      items,
      total,
      status: 'Nuevo'
    });
    return { ok: !error, error: error ? error.message : null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}