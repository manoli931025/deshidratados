import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, publicImageUrl } from '../data/supabase';
import { money, fmtDate } from './helpers';

export default function Products() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setErr('');
    const [{ data: prods, error: pe }, { data: vars }] = await Promise.all([
      supabase.from('products').select('*, categories(label)').order('sort_order'),
      supabase.from('variants').select('*').order('weight')
    ]);
    if (pe) return setErr(pe.message);
    const byProduct = {};
    (vars || []).forEach(v => {
      (byProduct[v.product_id] = byProduct[v.product_id] || []).push(v);
    });
    const mapped = (prods || []).map(p => {
      const vs = byProduct[p.id] || [];
      const prices = vs.map(v => Number(v.price));
      return {
        ...p,
        categoryLabel: p.categories ? p.categories.label : '—',
        priceRange: prices.length ? `${money(Math.min(...prices))} · ${money(Math.max(...prices))}` : '—',
        vCount: vs.length
      };
    });
    setRows(mapped);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (p) => {
    const { error } = await supabase.from('products').update({ active: !p.active }).eq('id', p.id);
    if (error) { setErr(error.message); return; }
    load();
  };

  const remove = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.name}" y sus precios?`)) return;
    setBusy(true);
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    load();
  };

  // Filtra por búsqueda (nombre, categoría o etiqueta).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.categoryLabel || '').toLowerCase().includes(q) ||
      (p.badge || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <section>
      <header className="adm-head">
        <div>
          <h2>Productos</h2>
          <p>{rows.length} en el catálogo.</p>
        </div>
        <Link className="adm-btn" to="/admin/productos/nuevo">+ Nuevo producto</Link>
      </header>
      {err && <p className="adm-err">{err}</p>}
      <div className="adm-filters">
        <input
          className="adm-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nombre, categoría o etiqueta…"
          aria-label="Buscar productos"
        />
      </div>
      {rows.length === 0 && !err ? (
        <p className="adm-muted">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="adm-muted">No se encontraron productos con esa búsqueda.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th></th><th>Nombre</th><th>Categoría</th><th>Precios</th><th>Estado</th><th>Actualizado</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <img className="adm-thumb" src={publicImageUrl(p.image)} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                  </td>
                  <td>
                    <b>{p.name}</b>
                    <div className="adm-muted small">{p.badge ? `Etiqueta: ${p.badge}` : ''}</div>
                  </td>
                  <td>{p.categoryLabel}</td>
                  <td>{p.priceRange}</td>
                  <td><span className={'adm-badge ' + (p.active ? 'st-done' : 'st-cancel')}>{p.active ? 'Activo' : 'Oculto'}</span></td>
                  <td>{fmtDate(p.created_at)}</td>
                  <td className="adm-actions">
                    <Link className="adm-link" to={`/admin/productos/${p.slug}`}>Editar</Link>
                    <button className="adm-linkbtn" onClick={() => toggleActive(p)}>{p.active ? 'Ocultar' : 'Activar'}</button>
                    <button className="adm-linkbtn danger" onClick={() => remove(p)} disabled={busy}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}