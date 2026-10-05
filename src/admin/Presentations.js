import { useEffect, useState } from 'react';
import { supabase } from '../data/supabase';

const empty = () => ({ slug: '', name: '', sort_order: 99 });

export default function Presentations() {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [form, setForm] = useState(empty());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr('');
    const [{ data: pres, error }, { data: vars }] = await Promise.all([
      supabase.from('presentations').select('*').order('sort_order'),
      supabase.from('variants').select('presentation_id')
    ]);
    if (error) return setErr(error.message);
    const agg = {};
    (vars || []).forEach(v => {
      if (v.presentation_id) agg[v.presentation_id] = (agg[v.presentation_id] || 0) + 1;
    });
    setCounts(agg);
    setRows(pres || []);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!(form.slug || '').trim() || !(form.name || '').trim()) { setErr('Faltan nombre y etiqueta.'); return; }
    const { error } = await supabase.from('presentations').insert([{
      slug: form.slug.trim().toLowerCase(),
      name: form.name.trim(),
      sort_order: Number(form.sort_order) || 99
    }]);
    if (error) { setErr(error.message); return; }
    setForm(empty());
    load();
  };

  const rename = async (row) => {
    const { error } = await supabase.from('presentations')
      .update({ name: row.name, sort_order: Number(row.sort_order) || 99 })
      .eq('id', row.id);
    if (error) { setErr(error.message); return; }
    load();
  };

  const remove = async (row) => {
    if (counts[row.id] > 0) { setErr(`La presentación "${row.name}" está en uso por ${counts[row.id]} precio(s). Quiéralos o edítalos antes de eliminar.`); return; }
    if (!window.confirm(`¿Eliminar la presentación "${row.name}"?`)) return;
    setBusy(true);
    const { error } = await supabase.from('presentations').delete().eq('id', row.id);
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
        <div><h2>Presentaciones</h2><p>Formas de venta de un producto: rodaja, media lida, polvo…</p></div>
      </header>
      {err && <p className="adm-err">{err}</p>}

      <form className="adm-card adm-form" onSubmit={submit}>
        <h3>Nueva presentación</h3>
        <div className="adm-grid three">
          <label>Etiqueta (slug)
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="rodaja" required />
          </label>
          <label>Nombre
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rodaja" required />
          </label>
          <label>Orden
            <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
          </label>
        </div>
        <button className="adm-btn" type="submit">Agregar</button>
      </form>

      <div className="adm-card">
        <h3>Presentaciones actuales</h3>
        {rows.length === 0 && <p className="adm-muted">Aún no hay presentaciones.</p>}
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Nombre</th><th>Slug</th><th>Orden</th><th>Precios</th><th></th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td><input value={r.name} onChange={setRow(i, 'name')} /></td>
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
      </div>
    </section>
  );
}
