import { useEffect, useState } from 'react';
import { supabase } from '../data/supabase';

const empty = () => ({ slug: '', label: '', sort_order: 99 });

export default function Categories() {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [form, setForm] = useState(empty());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr('');
    const [{ data: cats, error }, { data: prods }] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('products').select('category_id')
    ]);
    if (error) return setErr(error.message);
    const agg = {};
    (prods || []).forEach(p => { agg[p.category_id] = (agg[p.category_id] || 0) + 1; });
    setCounts(agg);
    setRows(cats || []);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.slug.trim() || !form.label.trim()) { setErr('Faltan etiqueta y nombre.'); return; }
    const { error } = await supabase.from('categories').insert([{
      slug: form.slug.trim().toLowerCase(),
      label: form.label.trim(),
      sort_order: Number(form.sort_order) || 99
    }]);
    if (error) { setErr(error.message); return; }
    setForm(empty());
    load();
  };

  const rename = async (row) => {
    const { error } = await supabase.from('categories')
      .update({ label: row.label, sort_order: Number(row.sort_order) || 99 })
      .eq('id', row.id);
    if (error) { setErr(error.message); return; }
    load();
  };

  const remove = async (row) => {
    if (counts[row.id] > 0) { setErr(`La categoría "${row.label}" tiene ${counts[row.id]} producto(s). Muévelos antes de eliminar.`); return; }
    if (!window.confirm(`¿Eliminar la categoría "${row.label}"?`)) return;
    setBusy(true);
    const { error } = await supabase.from('categories').delete().eq('id', row.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    load();
  };

const setRow = (i, k) => (e) => {
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [k]: e.target.value } : r)));
  };

  return (
    <section>
      <header className="adm-head">
        <div><h2>Categorías</h2><p>Agrupan los productos en la tienda.</p></div>
      </header>
      {err && <p className="adm-err">{err}</p>}

      <form className="adm-card adm-form" onSubmit={submit}>
        <h3>Nueva categoría</h3>
        <div className="adm-grid three">
          <label>Etiqueta (slug)
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="frutas" required />
          </label>
          <label>Nombre
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Frutas" required />
          </label>
          <label>Orden
            <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
          </label>
        </div>
        <button className="adm-btn" type="submit">Agregar</button>
      </form>

      <div className="adm-card">
        <h3>Categorías actuales</h3>
        {rows.length === 0 && <p className="adm-muted">Aún no hay categorías.</p>}
        <table className="adm-table">
          <thead><tr><th>Nombre</th><th>Slug</th><th>Orden</th><th>Productos</th><th></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td><input value={r.label} onChange={setRow(i, 'label')} /></td>
                <td className="adm-muted">{r.slug}</td>
                <td><input type="number" value={r.sort_order} onChange={setRow(i, 'sort_order')} /></td>
                <td>{counts[r.id] || 0}</td>
                <td className="adm-actions">
                  <button className="adm-linkbtn" onClick={() => rename(r)}>Guardar</button>
                  <button className="adm-linkbtn danger" onClick={() => remove(r)} disabled={busy}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}