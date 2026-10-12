import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase, publicImageUrl, IMAGES_BUCKET } from '../data/supabase';

const noAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slugify = (s) => noAccents(s.toLowerCase()).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const emptyVariant = () => ({ weight: '', unit: 'g', label: '', price: '', presentation_id: '', images: [] });

export default function ProductForm() {
  const { slug } = useParams();
  const isNew = !slug;
  const navigate = useNavigate();

  const [cats, setCats] = useState([]);
  const [presList, setPresList] = useState([]);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    category_id: '',
    description: '',
    origin: '',
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
    supabase.from('presentations').select('*').order('sort_order')
      .then(({ data, error }) => {
        if (!error && data) setPresList(data);
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
      setForm(f => ({
        ...f,
        ...data,
        name: data.name ?? '',
        slug: data.slug ?? '',
        category_id: data.category_id ?? '',
        description: data.description ?? '',
        origin: data.origin ?? '',
        badge: data.badge ?? '',
        image: data.image ?? '',
        sort_order: data.sort_order ?? 1,
        active: data.active ?? true
      }));
      setLoading(false);
      const vRes = await supabase.from('variants').select('*').eq('product_id', data.id);
      if (!alive) return;
      setVariants(vRes.data && vRes.data.length
        ? vRes.data.map(v => {
            const lbl = v.label ?? '';
            const m = lbl.match(/^([\d.,]+)\s*(\S+)$/);
            return {
              weight: v.weight ?? (m ? m[1] : ''),
              unit: m ? m[2] : 'g',
              label: lbl,
              price: String(v.price ?? ''),
              presentation_id: v.presentation_id ?? '',
              images: Array.isArray(v.images) ? v.images : []
            };
          })
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

  const onVariantImage = async (i, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const slugClean = (form.slug || slugify(form.name || '')).trim() || 'temp';
    const uploaded = [];
    for (const f of files) {
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `products/${slugClean}/var-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upError } = await supabase.storage.from(IMAGES_BUCKET).upload(path, f, { upsert: true });
      if (upError) { setErr('No se pudo subir una imagen: ' + upError.message); continue; }
      uploaded.push(publicImageUrl(path));
    }
    if (uploaded.length) {
      setVariants(vs => vs.map((v, idx) => (idx === i ? { ...v, images: [...(v.images || []), ...uploaded] } : v)));
    }
    e.target.value = '';
  };

  const removeVariantImage = (i, j) => {
    setVariants(vs => vs.map((v, idx) => (idx === i ? { ...v, images: (v.images || []).filter((_, k) => k !== j) } : v)));
  };

  // Mueve una imagen de posición (dir = -1 izquierda, +1 derecha) para organizar el orden.
  const moveVariantImage = (i, j, dir) => {
    setVariants(vs => vs.map((v, idx) => {
      if (idx !== i) return v;
      const imgs = [...(v.images || [])];
      const k = j + dir;
      if (k < 0 || k >= imgs.length) return v;
      [imgs[j], imgs[k]] = [imgs[k], imgs[j]];
      return { ...v, images: imgs };
    }));
  };

  const setVariant = (i, k) => (e) => {
    setVariants(vs => vs.map((v, idx) => (idx === i ? { ...v, [k]: e.target.value } : v)));
  };

  const upsertProduct = async () => {
    if (!(form.slug || '').trim()) {
      const auto = slugify(form.name || '');
      if (auto) form.slug = auto;
    }
    if (!(form.name || '').trim() || !(form.slug || '').trim()) throw new Error('Faltan nombre y etiqueta (slug).');
    const slugClean = form.slug.trim();

    let image = form.image || '';
    if (file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `products/${slugClean}/${Date.now()}.${ext}`;
      const { error: upError } = await supabase.storage
        .from(IMAGES_BUCKET)
        .upload(path, file, { upsert: true });
      if (upError) throw new Error('No se pudo subir la imagen: ' + upError.message);
      image = publicImageUrl(path);
    }
    if (!image) {
      const firstWithImg = variants.find(v => (v.images || []).length);
      if (firstWithImg) image = firstWithImg.images[0];
    }

    const payload = {
      name: (form.name || '').trim(),
      slug: slugClean,
      category_id: form.category_id || null,
      description: (form.description || '').trim(),
      origin: (form.origin || '').trim(),
      badge: (form.badge || '').trim() || null,
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
    const hasAnyData = variants.some(v =>
      v.presentation_id || String(v.weight ?? '').trim() !== '' || String(v.price ?? '').trim() !== ''
    );
    if (!hasAnyData) {
      throw new Error('Debe agregar al menos un precio con presentación, cantidad y precio.');
    }
    const incomplete = variants.find(v => {
      const partial = v.presentation_id || String(v.weight ?? '').trim() !== '' || String(v.price ?? '').trim() !== '';
      return partial && (!v.presentation_id || !(Number(v.weight) > 0) || !(Number(v.price) > 0));
    });
    if (incomplete) {
      throw new Error('Cada fila de precio requiere presentación, cantidad mayor a cero y precio mayor a cero.');
    }

    const { error: delError } = await supabase.from('variants').delete().eq('product_id', productId);
    if (delError) throw new Error(delError.message);

    const toInsert = variants
      .filter(v => v.presentation_id && Number(v.weight) > 0 && Number(v.price) > 0)
      .map(v => {
        const w = Number(v.weight);
        const unit = v.unit || 'g';
        const label = `${w} ${unit}`;
        return {
          product_id: productId,
          weight: String(w),
          label,
          price: Number(v.price) || 0,
          presentation_id: v.presentation_id,
          images: Array.isArray(v.images) ? v.images : []
        };
      });
    const { error } = await supabase.from('variants').insert(toInsert);
    if (error) throw new Error('Error en precios: ' + error.message);
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
          <span className="adm-muted small">Imagen principal del producto.</span>
        </div>

        <h3>Precios por presentación</h3>
        <p className="adm-muted small">Cada fila requiere presentación, cantidad con unidad y precio. La etiqueta se genera automáticamente.</p>
        <div className="adm-vars">
          <div className="adm-var-head"><span>Foto</span><span>Presentación</span><span>Cantidad</span><span>Unidad</span><span>Precio $</span><span></span></div>
          {variants.map((v, i) => {
            const imgs = v.images || [];
            return (
              <div className="adm-var-block" key={i}>
                <div className="adm-var-row">
                  <label className="adm-var-img" title="Agregar fotos de esta presentación">
                    {imgs.length
                      ? <img src={publicImageUrl(imgs[0])} alt="" />
                      : <span className="adm-var-img-ph">📷</span>}
                    <input type="file" accept="image/*" multiple onChange={e => onVariantImage(i, e)} />
                  </label>
                  <select value={v.presentation_id} onChange={setVariant(i, 'presentation_id')} required>
                    <option value="">— Elegir —</option>
                    {presList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" min="1" step="any" value={v.weight} onChange={setVariant(i, 'weight')} placeholder="100" required />
                  <select value={v.unit} onChange={setVariant(i, 'unit')}>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="L">L</option>
                    <option value="ud">ud</option>
                  </select>
                  <input type="number" min="1" step="any" value={v.price} onChange={setVariant(i, 'price')} placeholder="45" required />
                  <button type="button" className="adm-linkbtn danger" onClick={() => setVariants(vs => vs.filter((_, idx) => idx !== i))}>Quitar</button>
                </div>
                {imgs.length > 0 && (
                  <div className="adm-var-thumbs">
                    {imgs.map((img, j) => (
                      <span className="adm-var-thumb" key={j}>
                        <img src={publicImageUrl(img)} alt="" />
                        <span className="adm-thumb-ctrl">
                          <button type="button" onClick={() => moveVariantImage(i, j, -1)} disabled={j === 0} title="Mover a la izquierda">‹</button>
                          <button type="button" onClick={() => moveVariantImage(i, j, 1)} disabled={j === imgs.length - 1} title="Mover a la derecha">›</button>
                          <button type="button" className="x" onClick={() => removeVariantImage(i, j)} title="Quitar foto">✕</button>
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" className="adm-link" onClick={() => setVariants(vs => [...vs, emptyVariant()])}>+ Agregar precio</button>
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