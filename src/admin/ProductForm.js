import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase, publicImageUrl, IMAGES_BUCKET } from '../data/supabase';

const noAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slugify = (s) => noAccents(s.toLowerCase()).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const emptyVariant = () => ({ weight: '', label: '', price: '' });

export default function ProductForm() {
  const { slug } = useParams();
  const isNew = !slug;
  const navigate = useNavigate();

  const [cats, setCats] = useState([]);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    category_id: '',
    description: '',
    origin: '',
    rating: 0,
    reviews: 0,
    badge: '',
    image: '',
    active: true,
    sort_order: 1
  });
  const [variants, setVariants] = useState([emptyVariant()]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order')
      .then(({ data, error }) => {
        if (!error && data) {
          setCats(data);
          if (isNew && data.length) setForm(f => ({ ...f, category_id: data[0].id }));
        }
      });
  }, [isNew]);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from('products').select('*').eq('slug', slug).single();
      if (!alive) return;
      if (error || !data) {
        setErr('No encontramos el producto.');
        setLoading(false);
        return;
      }
      setForm(data);
      setLoading(false);
      const vRes = await supabase.from('variants').select('*').eq('product_id', data.id);
      if (!alive) return;
      setVariants(vRes.data && vRes.data.length
        ? vRes.data.map(v => ({ weight: v.weight, label: v.label, price: String(v.price) }))
        : [emptyVariant()]);
    })();
    return () => { alive = false; };
  }, [slug, isNew]);

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: val }));
  };

  const onName = (e) => {
    const val = e.target.value;
    setForm(f => ({
      ...f,
      name: val,
      slug: f.slug === '' || !f.slugDirty ? slugify(val) : f.slug,
      slugDirty: f.slugDirty
    }));
  };

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const setVariant = (i, k) => (e) => {
    setVariants(vs => vs.map((v, idx) => (idx === i ? { ...v, [k]: e.target.value } : v)));
  };

  const upsertProduct = async () => {
    if (!form.slug.trim()) {
      const auto = slugify(form.name);
      if (auto) form.slug = auto;
    }
    if (!form.name.trim() || !form.slug.trim()) throw new Error('Faltan nombre y etiqueta (slug).');

    let image = form.image || '';
    if (file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `products/${form.slug}/${Date.now()}.${ext}`;
      const { error: upError } = await supabase.storage
        .from(IMAGES_BUCKET)
        .upload(path, file, { upsert: true });
      if (upError) throw new Error('No se pudo subir la imagen: ' + upError.message);
      image = publicImageUrl(path);
    }

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      category_id: form.category_id || null,
      description: form.description.trim(),
      origin: form.origin.trim(),
      rating: Number(form.rating) || 0,
      reviews: Number(form.reviews) || 0,
      badge: form.badge.trim() || null,
      image,
      active: Boolean(form.active),
      sort_order: Number(form.sort_order) || 1
    };

    if (isNew) {
      const { data, error } = await supabase.from('products').insert([payload]).select();
      if (error) throw new Error(error.message);
      return data[0];
    }
    const { data, error } = await supabase.from('products')
      .update(payload).eq('slug', slug).select();
    if (error) throw new Error(error.message);
    return data[0];
  };

  const saveVariants = async (productId) => {
    const { error: delError } = await supabase.from('variants').delete().eq('product_id', productId);
    if (delError) throw new Error(delError.message);

    const toInsert = variants
      .filter(v => v.label.trim() && String(v.price).trim() !== '')
      .map(v => ({
        product_id: productId,
        weight: (v.weight || String(v.label).replace(/[^0-9.]/g, '')).trim() || '100',
        label: v.label.trim(),
        price: Number(v.price) || 0
      }));
    if (toInsert.length) {
      const { error } = await supabase.from('variants').insert(toInsert);
      if (error) throw new Error('Error en precios: ' + error.message);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const prod = await upsertProduct();
      await saveVariants(prod.id);
      navigate('/admin/productos');
    } catch (er) {
      setErr(er.message || 'Ocurrió un error.');
      setSaving(false);
    }
  };

  if (loading) return <p className="adm-muted">Cargando producto…</p>;

  return (
    <section>
      <header className="adm-head">
        <div>
          <h2>{isNew ? 'Nuevo producto' : `Editar · ${form.name}`}</h2>
          <p><Link className="adm-link" to="/admin/productos">← Volver</Link></p>
        </div>
      </header>
      {err && <p className="adm-err">{err}</p>}
      <form className="adm-card adm-form" onSubmit={onSubmit}>
        <div className="adm-grid">
          <label>Nombre *
            <input value={form.name} onChange={onName} required maxLength={80} />
          </label>
          <label>Etiqueta (slug) *
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value, slugDirty: true }))} maxLength={60} placeholder="mango-ataulfo" required />
          </label>
          <label>Categoría
            <select value={form.category_id || ''} onChange={set('category_id')}>
              <option value="">— Sin categoría —</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>Origen
            <input value={form.origin} onChange={set('origin')} maxLength={60} />
          </label>
          <label>Descripción
            <textarea value={form.description} onChange={set('description')} rows={3} maxLength={240} />
          </label>
          <label>Etiqueta promocional (badge)
            <input value={form.badge} onChange={set('badge')} placeholder="Más vendido / Nuevo" maxLength={40} />
          </label>
          <label>Calificación (0–5)
            <input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={set('rating')} />
          </label>
          <label>Número de reseñas
            <input type="number" min="0" value={form.reviews} onChange={set('reviews')} />
          </label>
          <label>Orden en catálogo
            <input type="number" min="0" value={form.sort_order} onChange={set('sort_order')} />
          </label>
        </div>

        <label className="adm-check">
          <input type="checkbox" checked={Boolean(form.active)} onChange={set('active')} />
          Producto visible en la tienda
        </label>

        <div className="adm-grid">
          <label>Imagen URL
            <input value={form.image} onChange={set('image')} placeholder="https://… o ruta del bucket" />
          </label>
          <label>O sube un archivo
            <input type="file" accept="image/*" onChange={onFile} />
          </label>
        </div>
        <div className="adm-preview">
          {(preview || form.image) && (
            <img src={preview || publicImageUrl(form.image)} alt="Vista previa" />
          )}
          <span className="adm-muted small">Se muestra arriba la imagen actual o la que selecciones.</span>
        </div>

        <h3>Precios por presentación</h3>
        <div className="adm-vars">
          <div className="adm-var-head"><span>Gramos</span><span>Etiqueta</span><span>Precio $</span><span></span></div>
          {variants.map((v, i) => (
            <div className="adm-var-row" key={i}>
              <input value={v.weight} onChange={setVariant(i, 'weight')} placeholder="100" />
              <input value={v.label} onChange={setVariant(i, 'label')} placeholder="100 g" required />
              <input value={v.price} onChange={setVariant(i, 'price')} placeholder="45" required />
              <button type="button" className="adm-linkbtn danger" onClick={() => setVariants(vs => vs.filter((_, idx) => idx !== i))}>Quitar</button>
            </div>
          ))}
          <button type="button" className="adm-link" onClick={() => setVariants(vs => [...vs, emptyVariant()])}>+ Agregar presentación</button>
        </div>

        <div className="adm-form-actions">
          <button className="adm-btn" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : (isNew ? 'Crear producto' : 'Guardar cambios')}
          </button>
          <Link className="adm-btn ghost" to="/admin/productos">Cancelar</Link>
        </div>
      </form>
    </section>
  );
}