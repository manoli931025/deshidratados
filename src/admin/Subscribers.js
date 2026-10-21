import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../data/supabase';
import { fmtDate } from './helpers';

export default function Subscribers() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setErr('');
    const { data, error } = await supabase.from('subscribers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) {
      const msg = /does not exist|schema cache/i.test(error.message || '')
        ? 'La tabla de suscriptores no existe todavía. Ejecuta supabase/upgrade-subscribers-settings.sql en Supabase.'
        : error.message;
      setErr(msg);
      return;
    }
    setRows(data || []);
    setLoaded(true);
  };

  useEffect(() => { load(); }, []);

  const remove = async (row) => {
    if (!window.confirm(`¿Quitar a ${row.email} de la lista?`)) return;
    setBusy(true);
    const { error } = await supabase.from('subscribers').delete().eq('id', row.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setRows(r => r.filter(x => x.id !== row.id));
  };

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => (r.email || '').toLowerCase().includes(q));
  }, [rows, search]);

  // Descarga la lista completa (no la filtrada) como CSV, para Excel o Mailchimp.
  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['email,fecha alta', ...rows.map(r => `${esc(r.email)},${esc(fmtDate(r.created_at))}`)];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suscriptores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <header className="adm-head">
        <div>
          <h2>Suscriptores</h2>
          <p>{rows.length} correo{rows.length !== 1 ? 's' : ''} en el boletín.</p>
        </div>
        <div className="adm-head-actions">
          <button className="adm-btn ghost" onClick={load}>Actualizar</button>
          <button className="adm-btn ghost" onClick={exportCsv} disabled={!rows.length}>Exportar CSV</button>
        </div>
      </header>
      {err && <p className="adm-err">{err}</p>}
      {loaded && rows.length > 0 && (
        <div className="adm-filters">
          <input
            className="adm-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar por correo…"
            aria-label="Buscar suscriptores"
          />
        </div>
      )}
      {!err && rows.length === 0 && (
        <p className="adm-muted">
          {loaded
            ? 'Aún no hay suscriptores. Aparecerán aquí cuando alguien se registre en el boletín de la tienda.'
            : 'Cargando…'}
        </p>
      )}
      {loaded && rows.length > 0 && searched.length === 0 && (
        <p className="adm-muted">No se encontraron correos con esa búsqueda.</p>
      )}
      <div className="adm-sub-list">
        {searched.map(r => (
          <div className="adm-sub-row" key={r.id}>
            <div>
              <b>{r.email}</b>
              <div className="adm-muted small">Alta: {fmtDate(r.created_at)}</div>
            </div>
            <button className="adm-linkbtn danger" onClick={() => remove(r)} disabled={busy}>Quitar</button>
          </div>
        ))}
      </div>
    </section>
  );
}
