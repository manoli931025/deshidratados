import { useEffect, useMemo, useState } from 'react';
import { supabase, configured } from '../data/supabase';
import { fmtDate, money, ORDER_STATUS, STATUS_CLASS, STATUS_HINTS } from './helpers';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [openHint, setOpenHint] = useState(null);
  const [stock, setStock] = useState(null); // Mapa de disponibilidad por id de variante
  const [editPhone, setEditPhone] = useState(null); // id del pedido cuyo teléfono se está capturando
  const [phoneVal, setPhoneVal] = useState('');      // borrador del teléfono

  const load = async () => {
    setErr('');
    const { data, error } = await supabase.from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) { setErr(error.message); return; }
    setOrders(data || []);
  };

  const loadStock = async () => {
    if (!configured || !supabase) return;
    const [{ data: prods }, { data: vars }] = await Promise.all([
      supabase.from('products').select('id, name').eq('active', true),
      supabase.from('variants').select('id, product_id')
    ]);
    // Productos activos por nombre (falle) y por id.
    const names = {};
    const activeProd = {};
    (prods || []).forEach(p => {
      names[p.name.toLowerCase()] = true;
      activeProd[p.id] = true;
    });
    // Mapa variante.id (uuid) -> product_id. El label del pedido es compuesto
    // (incluye presentación), por eso emparejamos por id y no por texto.
    const variantById = {};
    (vars || []).forEach(v => { variantById[v.id] = v.product_id; });
    setStock({ names, activeProd, variantById });
  };

  useEffect(() => { load(); loadStock(); }, []);

  // Construye la URL de WhatsApp de un pedido (confirmación o consulta).
  const waUrl = (o, { confirm = false } = {}) => {
    if (!o.phone) return null;
    const digits = o.phone.replace(/\D/g, '');
    if (!digits) return null;
    const lines = confirm
      ? [
          `Hola ${o.customer_name}! ☀`,
          `Tu pedido ha sido *confirmado*. ¡Gracias por comprar en Solaria!`,
          ...(o.items || []).map(it => `• ${it.quantity}× ${it.name}${it.variant ? ` (${it.variant.label})` : ''}`),
          `Total: ${money(o.total)}`,
          `Te avisamos cuando salga para entrega.`
        ]
      : [
          `Hola ${o.customer_name}! ☀ Te confirmamos tu pedido:`,
          ...(o.items || []).map(it => `• ${it.quantity}× ${it.name}${it.variant ? ` (${it.variant.label})` : ''} — ${money(it.quantity * (it.variant ? it.variant.price : 0))}`),
          `Total: ${money(o.total)}`
        ];
    return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  const changeStatus = async (o, status) => {
    setBusy(o.id);
    const { data, error } = await supabase.from('orders').update({ status }).eq('id', o.id).select();
    setBusy(null);

    // .select() devuelve [] si no se actualizó ninguna fila (p. ej. RLS o id inválido).
    if (error || !data || data.length === 0) {
      setErr(error ? error.message : 'No se pudo actualizar el pedido. ¿Sesión expirada?');
      load();
      return;
    }

    setErr('');
    // Actualización optimista: refleja el cambio al instante sin esperar la recarga.
    setOrders(prev => prev.map(x => (x.id === o.id ? { ...x, status } : x)));

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

  // Abre WhatsApp del pedido (true = mensaje de confirmación).
  const openWa = (o, confirm = false) => {
    const url = waUrl(o, { confirm });
    if (url) window.open(url, '_blank');
  };

  // Captura el teléfono del cliente en el pedido (lo toma el admin del chat de WhatsApp).
  const savePhone = async (o) => {
    const phone = phoneVal.trim();
    setBusy(o.id);
    const { data, error } = await supabase.from('orders').update({ phone }).eq('id', o.id).select();
    setBusy(null);
    if (error || !data || data.length === 0) {
      setErr(error ? error.message : 'No se pudo guardar el teléfono. ¿Sesión expirada?');
      return;
    }
    setErr('');
    setOrders(prev => prev.map(x => (x.id === o.id ? { ...x, phone } : x)));
    setEditPhone(null);
    setPhoneVal('');
  };

  const isAvailable = (it) => {
    if (!stock) return true;
    // Lo más fiable: el id (uuid) de la variante que viaja en el pedido.
    const vid = it.variant && it.variant.id;
    if (vid) {
      const pid = stock.variantById[vid];
      // Si la variante pertenece a un producto, checamos que siga activo.
      if (pid) return Boolean(stock.activeProd[pid]);
    }
    // Respaldo: coincide por nombre del producto.
    return Boolean(stock.names[(it.name || '').toLowerCase()]);
  };

  const counts = useMemo(() => {
    const c = { all: orders.length };
    ORDER_STATUS.forEach(s => { c[s] = orders.filter(o => o.status === s).length; });
    return c;
  }, [orders]);

  const grouped = useMemo(() => {
    const filtered = orders.filter(o => filter === 'all' || o.status === filter);
    const groups = {};
    filtered.forEach(o => { (groups[o.status] = groups[o.status] || []).push(o); });
    return ORDER_STATUS.filter(s => groups[s]).map(s => ({ status: s, list: groups[s] }));
  }, [orders, filter]);

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
      <div className="adm-filters">
        <button className={'adm-chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>Todos ({counts.all})</button>
        {ORDER_STATUS.map(s => (
          <button key={s} className={'adm-chip' + (filter === s ? ' on' : '')} onClick={() => setFilter(s)}>{s} ({counts[s] || 0})</button>
        ))}
      </div>
      {orders.length === 0 && !err && <p className="adm-muted">Aún no hay pedidos.</p>}
      {grouped.map(group => (
        <div className="adm-order-group" key={group.status}>
          <h3 className="adm-group-title">
            <span className={'adm-badge ' + STATUS_CLASS(group.status)}>{group.status}</span>
            <span className="adm-muted small">{group.list.length} pedido{group.list.length !== 1 ? 's' : ''}</span>
          </h3>
          <div className="adm-orders">
            {group.list.map(o => (
              <div className="adm-card adm-order" key={o.id}>
                <div className="adm-order-head">
                  <div>
                    <b>{o.customer_name}</b> · <span className="adm-muted">{fmtDate(o.created_at)}</span>
                    {editPhone === o.id ? (
                      <span className="adm-phone-edit">
                        {' · '}
                        <input
                          autoFocus
                          value={phoneVal}
                          onChange={e => setPhoneVal(e.target.value)}
                          placeholder="Tel. del cliente"
                          maxLength={30}
                          disabled={busy === o.id}
                        />
                        <button className="adm-linkbtn" onClick={() => savePhone(o)} disabled={busy === o.id}>Guardar</button>
                        <button className="adm-linkbtn" onClick={() => { setEditPhone(null); setPhoneVal(''); }}>Cancelar</button>
                      </span>
                    ) : (
                      <>
                        {o.phone && <a className="adm-link" href={`tel:${o.phone}`}> · {o.phone}</a>}
                        <button
                          className={'adm-linkbtn phone-add' + (o.status === 'Confirmado' && !o.phone ? ' need' : '')}
                          onClick={() => { setEditPhone(o.id); setPhoneVal(o.phone || ''); }}
                          title={o.phone ? 'Editar teléfono' : 'Captura el teléfono del cliente (lo ves en tu WhatsApp) para poder avisarle'}
                        >
                          {o.phone ? ' · editar' : ' · + teléfono'}
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    className={'adm-badge click ' + STATUS_CLASS(o.status)}
                    onClick={() => setOpenHint(openHint === o.id ? null : o.id)}
                    title="Clic para ver qué significa"
                  >
                    {o.status} ▾
                  </button>
                </div>
                {openHint === o.id && (
                  <p className="adm-status-hint">{STATUS_HINTS[o.status] || ''}</p>
                )}
                <ul className="adm-order-items">
                  {(o.items || []).map((it, i) => {
                    const avail = isAvailable(it);
                    return (
                      <li key={i} className="adm-order-item">
                        <span className="adm-item-info">
                          <b>{it.quantity}×</b> {it.name}
                          {it.variant && <span className="adm-muted"> ({it.variant.label})</span>}
                          {!avail && <span className="adm-warn-tag" title="Este producto ya no está en la tienda">⚠ Agotado</span>}
                        </span>
                        <span className="adm-item-price">{money(it.quantity * (it.variant ? it.variant.price : 0))}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="adm-order-foot">
                  <span className="adm-total">Total: <b>{money(o.total)}</b></span>
                  <select value={o.status} disabled={busy === o.id} onChange={e => changeStatus(o, e.target.value)}>
                    {ORDER_STATUS.map(s => <option key={s} value={s} title={STATUS_HINTS[s]}>{s}</option>)}
                  </select>
                  {(o.status === 'Confirmado' && o.phone) && (
                    <button className="adm-linkbtn wa-confirm" onClick={() => openWa(o, true)}>
                      ✆ Enviar WhatsApp
                    </button>
                  )}
                  <button className="adm-linkbtn" onClick={() => openWa(o)} disabled={!o.phone}>WhatsApp</button>
                  <button className="adm-linkbtn danger" onClick={() => remove(o)} disabled={busy}>Eliminar</button>
                </div>
                {o.status === 'Confirmado' && !o.phone && (
                  <p className="adm-phone-hint">Captura el teléfono del cliente (botón «+ teléfono») para poder enviarle el WhatsApp de confirmación.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
