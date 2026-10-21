import { useState } from 'react';
import { useShop, submitOrder } from '../data/shop';
import { useCurrency } from '../data/currency';

// Países con su código ISO, prefijo telefónico y bandera.
// Cuba va primero: es el mercado principal y el punto de entrega siempre.
const COUNTRIES = [
  { region: 'CU', dial: '53', flag: '🇨🇺', name: 'Cuba' },
  { region: 'MX', dial: '52', flag: '🇲🇽', name: 'México' },
  { region: 'US', dial: '1', flag: '🇺🇸', name: 'Estados Unidos' },
  { region: 'ES', dial: '34', flag: '🇪🇸', name: 'España' },
  { region: 'GT', dial: '502', flag: '🇬🇹', name: 'Guatemala' },
  { region: 'SV', dial: '503', flag: '🇸🇻', name: 'El Salvador' },
  { region: 'HN', dial: '504', flag: '🇭🇳', name: 'Honduras' },
  { region: 'NI', dial: '505', flag: '🇳🇮', name: 'Nicaragua' },
  { region: 'CR', dial: '506', flag: '🇨🇷', name: 'Costa Rica' },
  { region: 'PA', dial: '507', flag: '🇵🇦', name: 'Panamá' },
  { region: 'DO', dial: '1809', flag: '🇩🇴', name: 'R. Dominicana' },
  { region: 'CO', dial: '57', flag: '🇨🇴', name: 'Colombia' },
  { region: 'VE', dial: '58', flag: '🇻🇪', name: 'Venezuela' },
  { region: 'EC', dial: '593', flag: '🇪🇨', name: 'Ecuador' },
  { region: 'PE', dial: '51', flag: '🇵🇪', name: 'Perú' },
  { region: 'BO', dial: '591', flag: '🇧🇴', name: 'Bolivia' },
  { region: 'CL', dial: '56', flag: '🇨🇱', name: 'Chile' },
  { region: 'AR', dial: '54', flag: '🇦🇷', name: 'Argentina' },
  { region: 'UY', dial: '598', flag: '🇺🇾', name: 'Uruguay' },
  { region: 'PY', dial: '595', flag: '🇵🇾', name: 'Paraguay' },
  { region: 'BR', dial: '55', flag: '🇧🇷', name: 'Brasil' },
  { region: 'CA', dial: '1', flag: '🇨🇦', name: 'Canadá' },
  { region: 'PT', dial: '351', flag: '🇵🇹', name: 'Portugal' },
  { region: 'FR', dial: '33', flag: '🇫🇷', name: 'Francia' },
  { region: 'DE', dial: '49', flag: '🇩🇪', name: 'Alemania' },
  { region: 'IT', dial: '39', flag: '🇮🇹', name: 'Italia' },
  { region: 'GB', dial: '44', flag: '🇬🇧', name: 'Reino Unido' },
  { region: 'IE', dial: '353', flag: '🇮🇪', name: 'Irlanda' },
  { region: 'NL', dial: '31', flag: '🇳🇱', name: 'Países Bajos' },
  { region: 'BE', dial: '32', flag: '🇧🇪', name: 'Bélgica' },
  { region: 'CH', dial: '41', flag: '🇨🇭', name: 'Suiza' },
  { region: 'SE', dial: '46', flag: '🇸🇪', name: 'Suecia' },
  { region: 'NO', dial: '47', flag: '🇳🇴', name: 'Noruega' },
  { region: 'PL', dial: '48', flag: '🇵🇱', name: 'Polonia' },
  { region: 'GR', dial: '30', flag: '🇬🇷', name: 'Grecia' },
  { region: 'MA', dial: '212', flag: '🇲🇦', name: 'Marruecos' },
  { region: 'AE', dial: '971', flag: '🇦🇪', name: 'Emiratos Árabes' },
  { region: 'IL', dial: '972', flag: '🇮🇱', name: 'Israel' },
  { region: 'IN', dial: '91', flag: '🇮🇳', name: 'India' },
  { region: 'JP', dial: '81', flag: '🇯🇵', name: 'Japón' },
  { region: 'AU', dial: '61', flag: '🇦🇺', name: 'Australia' },
  { region: 'NZ', dial: '64', flag: '🇳🇿', name: 'Nueva Zelanda' },
  { region: 'ZA', dial: '27', flag: '🇿🇦', name: 'Sudáfrica' }
];

// Detecta el país del navegador (ej. "es-CU" → CU, "es-ES" → ES) y regresa su código.
// Si no reconoce el país, deja Cuba: es el mercado principal de la tienda.
function detectRegion() {
  try {
    const loc = (navigator.language || '').toUpperCase();
    const region = loc.split('-')[1];
    if (region && COUNTRIES.some(c => c.region === region)) return region;
  } catch { /* sin navegador */ }
  return 'CU';
}

// El mensaje va en la moneda en que el comprador ve la tienda, y aclara que
// el envío es siempre a Cuba (aunque el comprador esté en el exterior).
function buildWaUrl(shop, items, total, customer, buyer, fmt) {
  const lines = [
    `¡Hola ${shop.name}! ☀️ Quiero hacer este pedido:`,
    ...items.map(i => `• ${i.quantity}× ${i.name} (${i.variant.label}) — ${fmt(i.quantity * i.variant.price)}`),
    ` Total: ${fmt(total)}`,
    '',
    `Comprador: ${customer.name}${customer.phone ? ' · ' + customer.phone : ''}`,
    'Entrega en Cuba · dirección a confirmar'
  ];
  if (buyer && buyer.region !== 'CU') lines.push(`(Hiciste el pedido desde ${buyer.name})`);
  lines.push('', '¿Me confirman disponibilidad, dirección de entrega y forma de pago? ¡Gracias!');
  return `https://wa.me/${shop.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export default function CheckoutForm({ items, total, onPlaced }) {
  const { shop } = useShop();
  const { fmt } = useCurrency();
  const [name, setName] = useState('');
  const [region, setRegion] = useState(detectRegion);
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('idle'); // idle | saving | done | error
  const [note, setNote] = useState('');

  const digits = phone.replace(/\D/g, '');
  const buyer = COUNTRIES.find(c => c.region === region) || COUNTRIES[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (state === 'saving') return;
    if (digits.length < 7) {
      setState('error');
      setNote('Escribe un número de teléfono válido (al menos 7 dígitos).');
      return;
    }
    setState('saving');
    setNote('');

    const customer = { name: name.trim(), phone: `+${buyer.dial}${digits}` };
    const waUrl = buildWaUrl(shop, items, total, customer, buyer, fmt);

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

  if (state === 'done') {
    return (
      <div className="co-done">
        <p className="co-ok">☀ ¡Pedido registrado!</p>
        <p>Te redirigimos a WhatsApp para confirmar tu pedido.</p>
      </div>
    );
  }

  return (
    <form className="co-form" onSubmit={handleSubmit}>
      <p className="co-hint">
        El pedido se entrega en <b>Cuba</b>. Deja tu contacto y lo confirmamos por WhatsApp.
      </p>
      <div className="co-row">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Tu nombre"
          aria-label="Tu nombre"
          required
          maxLength={80}
        />
      </div>
      <div className="co-phone">
        <select value={region} onChange={e => setRegion(e.target.value)} aria-label="País">
          {COUNTRIES.map(c => (
            <option key={c.region} value={c.region}>{c.flag} +{c.dial} {c.name}</option>
          ))}
        </select>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="33 1234 5678"
          aria-label="Tu teléfono"
          inputMode="tel"
          required
          maxLength={20}
        />
      </div>
      {buyer.region !== 'CU' && (
        <p className="co-hint co-from">
          🌍 Comprando desde {buyer.name}. El envío se entrega en Cuba; lo coordinamos por WhatsApp.
        </p>
      )}
      {state === 'error' && note && digits.length < 7 && <p className="co-warn">{note}</p>}
      <button className="wa-btn" type="submit" disabled={state === 'saving'}>
        {state === 'saving' ? 'Registrando…' : 'Registrar y pedir por WhatsApp →'}
      </button>
    </form>
  );
}
