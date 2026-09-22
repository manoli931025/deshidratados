import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../data/supabase';
import { fmtDate, money, STATUS_CLASS } from './helpers';

export default function Dashboard() {
  const [stats, setStats] = useState({ products: 0, active: 0, orders: 0, revenue: 0 });
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.from('products').select('active'),
      supabase.from('orders').select('total').order('created_at', { ascending: false }).limit(5)
    ]).then(([pRes, oRes]) => {
      if (!alive) return;
      const products = pRes.data || [];
      const recentOrders = oRes.data || [];
      const allTotal = recentOrders.reduce((s, o) => s + Number(o.total), 0);
      setStats({
        products: products.length,
        active: products.filter(p => p.active).length,
        orders: recentOrders.length,
        revenue: allTotal
      });
      setRecent(recentOrders);
    }).catch(() => {
      if (alive) setErr('No se pudieron cargar los datos.');
    });
    return () => { alive = false; };
  }, []);

  return (
    <section>
      <header className="adm-head">
        <h2>Panel</h2>
        <p>Resumen rápido de la tienda.</p>
      </header>
      {err && <p className="adm-err">{err}</p>}
      <div className="adm-cards">
        <div className="adm-stat"><b>{stats.products}</b><span>Productos</span></div>
        <div className="adm-stat"><b>{stats.active}</b><span>Activos</span></div>
        <div className="adm-stat"><b>{stats.orders}</b><span>Pedidos recientes (5)</span></div>
        <div className="adm-stat"><b>{money(stats.revenue)}</b><span>Monto de esos pedidos</span></div>
      </div>

      <div className="adm-card">
        <h3>Pedidos recientes</h3>
        {recent.length === 0 ? (
          <p className="adm-muted">Aún no hay pedidos.</p>
        ) : (
          <ul className="adm-list">
            {recent.map(o => (
              <li key={o.id}>
                <div>
                  <b>{o.customer_name}</b> · {fmtDate(o.created_at)}
                  <div className="adm-muted small">{money(o.total)} · {o.status}</div>
                </div>
                <span className={'adm-badge ' + STATUS_CLASS(o.status)}>{o.status}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="adm-muted small"><Link className="adm-link" to="/admin/pedidos">Ver todos los pedidos →</Link></p>
      </div>
    </section>
  );
}