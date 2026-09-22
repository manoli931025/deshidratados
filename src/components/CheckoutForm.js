import { useState } from 'react';
import { useShop, submitOrder } from '../data/shop';

function buildWaUrl(shop, items, total, customer) {
  const lines = [
    `¡Hola ${shop.name}! ☀️ Quiero hacer este pedido:`,
    ...items.map(i => `• ${i.quantity}× ${i.name} (${i.variant.label}) — $${i.quantity * i.variant.price}`),
    ` Total: $${total}`
  ];
  if (customer.name) lines.push(`\nEnviar a: ${customer.name}${customer.phone ? ' · ' + customer.phone : ''}`);
  lines.push('\n¿Me confirman disponibilidad y costo de envío? ¡Gracias!');
  return `https://wa.me/${shop.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export default function CheckoutForm({ items, total, onPlaced }) {
  const { shop } = useShop();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('idle'); // idle | saving | done | error
  const [note, setNote] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (state === 'saving') return;
    setState('saving');
    setNote('');

    const customer = { name: name.trim(), phone: phone.trim() };
    const waUrl = buildWaUrl(shop, items, total, customer);

    const res = await submitOrder({
      customerName: customer.name || 'Cliente sin nombre',
      phone: customer.phone,
      items: items.map(i => ({ id: i.id, name: i.name, variant: i.variant, quantity: i.quantity })),
      total
    });

    window.open(waUrl, '_blank', 'noopener,noreferrer');

    if (res.ok) {
      setState('done');
    } else {
      setState('error');
      setNote('No pudimos guardar tu pedido en línea, pero tu mensaje de WhatsApp ya está listo.');
    }
    onPlaced();
  };

  if (state === 'done' || state === 'error') {
    return (
      <div className="co-done">
        <p className="co-ok">☀ ¡Pedido registrado!</p>
        <p>Te redirigimos a WhatsApp para confirmar {items.reduce((s, i) => s + i.quantity, 0) === 1 ? 'tu pedido' : 'tu pedido'}.</p>
        {state === 'error' && <p className="co-warn">{note}</p>}
      </div>
    );
  }

  return (
    <form className="co-form" onSubmit={handleSubmit}>
      <p className="co-hint">Cuéntanos a dónde te contactamos para confirmar:</p>
      <div className="co-row">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Tu nombre"
          aria-label="Tu nombre"
          required
          maxLength={80}
        />
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="Tu teléfono (opcional)"
          aria-label="Tu teléfono"
          maxLength={30}
        />
      </div>
      <button className="wa-btn" type="submit" disabled={state === 'saving'}>
        {state === 'saving' ? 'Registrando…' : 'Registrar y pedir por WhatsApp →'}
      </button>
    </form>
  );
}