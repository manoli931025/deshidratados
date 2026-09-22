import { useEffect, useState } from 'react';
import { supabase } from '../data/supabase';
import { fmtDate, money, ORDER_STATUS, STATUS_CLASS } from './helpers';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr('');
    const { data, error } = await supabase.from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) { setErr(error.message); return; }
    setOrders(data || []);
  };

  useEffect(() => { load(); }, []);

  const changeStatus = async (o, status) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', o.id);
    if (error) { setErr(error.message); return; }
    load();
  };

  const remove = async (o) => {
    if (!window.confirm('¿Eliminar este pedido?')) return;
    setBusy(true);
    const { error } = await supabase.from('orders').delete().eq('id', o.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    load();
  };

  const openWa = (o) => {
    if (!o.phone) return;
    const digits = o.phone.replace(/\D/g, '');
    if (!digits) return;
    const lines = [`Hola ${o.customer_name}! ☀ Te confirmamos tu pedido:`, ...(o.items || []).map(it => `• ${it.quantity}× ${it.name} (${it.variant && it.variant.label}) — $${it.quantity * (it.variant ? it.variant.price : 0)}`), ` Total: $${o.total}`];
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  return (
    <section>
      <header className="adm-head">
        <div>
          <h2>Pedidos</h2>
          <p>{orders.length} pedidos registrados.</p>
        </div>
        <button className="adm-btn ghost" onClick={load}>Actualizar</button>
      </header>
      {err && <p className="adm-err">{err}</p>}
      {orders.length === 0 && !err && <p className="adm-muted">Aún no hay pedidos.</p>}
      <div className="adm-orders">
        {orders.map(o => (
          <div className="adm-card adm-order" key={o.id}>
            <div className="adm-order-head">
              <div>
                <b>{o.customer_name}</b> · <span className="adm-muted">{fmtDate(o.created_at)}</span>
                {o.phone && <a className="adm-link" href={`tel:${o.phone}`}> · {o.phone}</a>}
              </div>
              <span className={'adm-badge ' + STATUS_CLASS(o.status)}>{o.status}</span>
            </div>
            <ul className="adm-order-items">
              {(o.items || []).map((it, i) => (
                <li key={i}>{it.quantity}× {it.name} <span className="adm-muted">({it.variant && it.variant.label})</span>
                  <b>{money(it.quantity * (it.variant ? it.variant.price : 0))}</b>
                </li>
              ))}
            </ul>
            <div className="adm-order-foot">
              <span className="adm-total">Total: <b>{money(o.total)}</b></span>
              <select value={o.status} onChange={e => changeStatus(o, e.target.value)}>
                {ORDER_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="adm-linkbtn" onClick={() => openWa(o)} disabled={!o.phone}>WhatsApp</button>
              <button className="adm-linkbtn danger" onClick={() => remove(o)} disabled={busy}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}