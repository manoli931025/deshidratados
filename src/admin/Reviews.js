import { useEffect, useState } from 'react';
import { supabase } from '../data/supabase';
import { fmtDate } from './helpers';

const STATUS_LABEL = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };
const STATUS_CLASS = { pending: 'st-conf', approved: 'st-done', rejected: 'st-cancel' };

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr('');
    const { data, error } = await supabase.from('reviews')
      .select('*, products(name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) { setErr(error.message); return; }
    setReviews(data || []);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (r, status) => {
    setBusy(true);
    const { error } = await supabase.from('reviews').update({ status }).eq('id', r.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    load();
  };

  const remove = async (r) => {
    if (!window.confirm('¿Eliminar esta reseña?')) return;
    setBusy(true);
    const { error } = await supabase.from('reviews').delete().eq('id', r.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    load();
  };

  const shown = reviews.filter(r => filter === 'all' || r.status === filter);

  return (
    <section>
      <header className="adm-head">
        <div>
          <h2>Reseñas</h2>
          <p>{reviews.filter(r => r.status === 'pending').length} pendientes de revisar.</p>
        </div>
        <button className="adm-btn ghost" onClick={load}>Actualizar</button>
      </header>
      {err && <p className="adm-err">{err}</p>}
      <div className="adm-filters">
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <button
            key={f}
            className={'adm-chip' + (filter === f ? ' on' : '')}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Todas' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>
      {shown.length === 0 && !err && <p className="adm-muted">No hay reseñas con este filtro.</p>}
      <div className="adm-orders">
        {shown.map(r => (
          <div className="adm-card adm-order" key={r.id}>
            <div className="adm-order-head">
              <div>
                <b>{r.author}</b> · <span className="adm-muted">{r.products ? r.products.name : 'General'}</span>
                <div className="adm-muted small">{fmtDate(r.created_at)}</div>
              </div>
              <span className={'adm-badge ' + STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span>
            </div>
            <div className="quote-stars" style={{ color: '#C4531F', marginBottom: 6 }}>
              {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
            </div>
            <p style={{ margin: '0 0 10px' }}>{r.comment}</p>
            <div className="adm-order-foot">
              {r.status !== 'approved' && (
                <button className="adm-linkbtn" onClick={() => setStatus(r, 'approved')} disabled={busy}>Aprobar</button>
              )}
              {r.status !== 'rejected' && (
                <button className="adm-linkbtn" onClick={() => setStatus(r, 'rejected')} disabled={busy}>Rechazar</button>
              )}
              <button className="adm-linkbtn danger" onClick={() => remove(r)} disabled={busy}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
