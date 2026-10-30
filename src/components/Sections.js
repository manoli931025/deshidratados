import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from './Reveal';
import { useShop } from '../data/shop';
import { LEGAL, LEGAL_ORDER } from '../data/legalContent';
import { supabase, configured } from '../data/supabase';
import { sendWelcomeEmail } from '../services/newsletter';

const STEPS = [
  { n: '01', t: 'Cosecha', d: 'Compramos fruta y verdura de temporada directo a productores locales, en su punto exacto de maduración.' },
  { n: '02', t: 'Selección y lavado', d: 'Cada pieza se revisa a mano. Lo que no sirve para venderse fresco, tampoco sirve para secarse.' },
  { n: '03', t: 'Corte a mano', d: 'Cortamos en láminas y trozos parejos para que el secado sea uniforme en toda la charola.' },
  { n: '04', t: 'Deshidratado lento', d: 'Entre 45 y 60 °C durante 8 a 20 horas. Baja temperatura y mucho tiempo: así se conservan color, aroma y nutrientes.' },
  { n: '05', t: 'Empaque', d: 'Al vacío o en bolsa compostable con sello hermético. Sin conservadores, sin sulfitos, sin trucos.' },
];

export function Process() {
  return (
    <section id="proceso" className="process">
      <div className="wrap process-grid">
        <div className="process-left">
          <p className="eyebrow light">El proceso</p>
          <h2>Del huerto a la bolsa, <em>sin prisa</em> y sin química.</h2>
          <p>No usamos sulfitos, colorantes ni azúcar. Solo temperatura baja, aire constante y paciencia. Así el sabor se concentra y la fruta sigue siendo fruta.</p>
          <div className="process-fact">☀ 45–60 °C · 8 a 20 horas por lote</div>
        </div>
        <div>
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <div className="step">
                <span className="step-num">{s.n}</span>
                <div><h3>{s.t}</h3><p>{s.d}</p></div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const QUOTES = [
  { txt: 'El mango sabe a mango de verdad. Mis hijos lo piden más que las gomitas.', who: 'Mariana G. · cliente desde 2021', r: '-1.6deg', rating: 5 },
  { txt: 'Compro el mix senderista cada mes para mis rutas. Aguanta calor, lluvia y mochila revuelta.', who: 'Luis A. · guía de montaña', r: '1.4deg', rating: 5 },
  { txt: 'Uso sus tomates secos en el restaurante. Una concentración de sabor que no encuentro en ningún proveedor.', who: 'Chef Renata V. · cocina de autor', r: '-1deg', rating: 5 },
];

export function Testimonials() {
  const { products } = useShop();
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState({ author: '', comment: '', rating: 5, product_id: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!configured || !supabase) return;
    // Ya no se filtra por 'approved' — todas las reseñas se muestran automáticamente.
    // El admin solo puede eliminarlas.
    supabase.from('reviews').select('*, products(name)')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data && data.length) setReviews(data); });
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!configured || !supabase) { setSent(true); return; }
    setErr('');
    setSending(true);
    const { error } = await supabase.from('reviews').insert({
      author: form.author.trim(),
      comment: form.comment.trim(),
      rating: Number(form.rating),
      product_id: form.product_id || null
    });
    setSending(false);
    if (error) {
      console.error('Error al enviar reseña:', error);
      const msg = /does not exist|schema cache/i.test(error.message || '')
        ? 'Las reseñas aún no están habilitadas. Ejecuta el archivo supabase/upgrade-2026-10-24.sql en Supabase.'
        : `No se pudo enviar. (${error.message || 'Error desconocido'})`;
      setErr(msg);
      return;
    }
    setSent(true);
    setOpen(false);
  };

  const items = reviews.length
    ? reviews.map((r, i) => ({
        txt: r.comment,
        who: r.author,
        rating: r.rating,
        product: r.products ? r.products.name : null,
        r: `${(i % 2 ? 1.2 : -1.4)}deg`
      }))
    : QUOTES;

  // Portada: solo las 3 reseñas más recientes; el resto tras «Ver más…».
  const shown = showMore ? items : items.slice(0, 3);

  return (
    <section id="opiniones" className="section">
      <div className="wrap">
        <header className="sec-head">
          <span className="sec-idx">02</span>
          <div><p className="eyebrow">Opiniones</p><h2>Lo que dicen los que ya probaron</h2></div>
        </header>
        <div className="quotes">
          {shown.map((q, i) => (
            <Reveal key={q.who + i} delay={i * 120}>
              <blockquote className="quote" style={{ '--r': q.r }}>
                {q.product && <span className="quote-product">{q.product}</span>}
                <div className="quote-stars">{'★'.repeat(q.rating || 5)}{'☆'.repeat(5 - (q.rating || 5))}</div>
                <p>{q.txt}</p>
                <cite className="quote-author">{q.who}</cite>
              </blockquote>
            </Reveal>
          ))}
        </div>
        {items.length > 3 && (
          <div className="quotes-more">
            <button className="btn" type="button" onClick={() => setShowMore(m => !m)}>
              {showMore ? 'Ver menos' : `Ver más reseñas (${items.length - 3})…`}
            </button>
          </div>
        )}
        <div className="review-cta">
          {sent ? (
            <p className="news-ok">☀ ¡Gracias! Tu reseña será visible tras su aprobación.</p>
          ) : open ? (
            <form className="review-form" onSubmit={onSubmit}>
              <h3>Deja tu reseña</h3>
              <div className="review-row">
                <input placeholder="Tu nombre" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} required maxLength={60} />
                <select className="review-stars-sel" value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
                </select>
              </div>
              <div className="review-row">
                <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
                  <option value="">— Opinión general —</option>
                  {products.filter(p => p.dbId).map(p => <option key={p.dbId} value={p.dbId}>{p.name}</option>)}
                </select>
              </div>
              <textarea placeholder="Cuéntanos cómo te pareció…" value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} required rows={3} maxLength={400} />
              {err && <p className="review-err">{err}</p>}
              <div className="review-actions">
                <button className="btn btn-primary" type="submit" disabled={sending}>{sending ? 'Enviando…' : 'Enviar reseña'}</button>
                <button className="btn" type="button" onClick={() => setOpen(false)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <button className="btn review-open-btn" onClick={() => setOpen(true)}>
              <svg className="review-ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Escribir una reseña
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  { q: '¿Los productos llevan azúcar o conservadores?', a: 'No. Solo el producto y, en algunos mixes, especias. Nada de sulfitos, colorantes ni azúcar añadida. Por eso los colores son los reales: más apagados que un producto industrial, pero con sabor de verdad.' },
  { q: '¿Puedo pedir si estoy fuera de Cuba?', a: 'Sí. Hacemos envíos a toda la isla y muchos clientes piden desde el exterior para sus familias en Cuba. Tú eliges los productos, dejas tu teléfono de contacto y coordinamos la entrega en Cuba por WhatsApp. Si compras desde fuera te indicamos las opciones de pago disponibles en tu país.' },
  { q: '¿En qué moneda están los precios?', a: 'Puedes verlos en pesos cubanos (CUP), dólares (USD) o euros (EUR) con el selector de moneda de la página. Los precios se convierten al tipo de cambio que fija la tienda y el importe final siempre se acuerda y confirma por WhatsApp.' },
  { q: '¿Cómo se paga el pedido?', a: 'Transfermóvil o depósito bancario (BPA, BANMET), tarjeta MLC, efectivo al recibir, o remesa y transferencia desde el exterior (Zelle, USDT/TRON). Lo combinamos según estés en Cuba o fuera y te lo confirmamos por WhatsApp antes de enviar.' },
  { q: '¿Cuánto tarda y cuánto cuesta el envío?', a: 'Despachamos en 24–48 horas después de confirmar el pedido. La entrega local es al día siguiente y en el resto del país tarda de 2 a 5 días. El envío es gratis desde el monto indicado en la tienda; por debajo, se cobra según la provincia.' },
  { q: '¿Hacen pedidos al por mayor?', a: 'Sí: atendemos tiendas, restaurantes, cafeterías y eventos. Escríbenos por WhatsApp con los productos y cantidades que necesitas y te armamos una cotización con precio especial.' },
  { q: '¿Cómo conservo mis deshidratados al llegar?', a: 'Guárdalos en un lugar fresco, seco y oscuro, con el sello bien cerrado. Sin abrir duran hasta 12 meses; una vez abiertos, te recomendamos consumirlos en 2–3 semanas.' },
  { q: '¿La fruta deshidratada conserva sus nutrientes?', a: 'La mayor parte sí. Al secar a baja temperatura se conserva la fibra, los minerales y gran parte de las vitaminas. Lo único que se va es el agua.' },
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="preguntas" className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <header className="sec-head">
          <span className="sec-idx">03</span>
          <div><p className="eyebrow">Preguntas</p><h2>Antes de que preguntes…</h2></div>
        </header>
        <div className="faq-wrap">
          {FAQS.map((f, i) => (
            <div className={'faq-item' + (open === i ? ' open' : '')} key={f.q}>
              <button className="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                {f.q}<span className="faq-ico">+</span>
              </button>
              <div className="faq-a"><div className="faq-a-inner"><p>{f.a}</p></div></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    // Sin Supabase (modo demo) solo confirmamos en pantalla, como antes.
    if (!configured || !supabase) { setDone(true); return; }
    setBusy(true);

    // 1. Guardar el suscriptor
    const { error: subError } = await supabase.from('subscribers').insert({
      email: email.trim().toLowerCase()
    });

    // 2. Enviar email de bienvenida (si el suscriptor se guardó correctamente)
    if (!subError) {
      try {
        await sendWelcomeEmail(email.trim().toLowerCase());
      } catch (e) {
        console.warn('[newsletter] Error al enviar email de bienvenida (no se descarta el suscriptor):', e);
      }
    }

    setBusy(false);
    if (subError) {
      // 23505 = email ya registrado → mismo mensaje de éxito, sin asustar al usuario.
      if (subError.code === '23505' || /duplicate|unique/i.test(subError.message || '')) {
        setDone(true);
        return;
      }
      console.error('Error al suscribir:', subError);
      const msg = /does not exist|schema cache/i.test(subError.message || '')
        ? 'El boletín aún no está habilitado. Ejecuta el archivo supabase/upgrade-2026-10-24.sql en Supabase.'
        : 'No se pudo registrar. Intenta de nuevo en unos segundos.';
      setErr(msg);
      return;
    }
    setDone(true);
  };

  return (
    <section className="news">
      <div className="wrap news-grid">
        <div>
          <h2>El boletín del horneado</h2>
          <p>Un correo al mes: qué estamos secando, recetas de temporada y descuentos de cosecha.</p>
        </div>
        {done ? (
          <p className="news-ok">☀ ¡Listo! Te avisaremos del próximo horneado.</p>
        ) : (
          <form className="news-form" onSubmit={onSubmit}>
            <input
              type="email"
              placeholder="tu@correo.com"
              required
              aria-label="Tu correo"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={busy}
            />
            <button type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Unirme'}</button>
          </form>
        )}
        {err && <p className="news-err">{err}</p>}
      </div>
    </section>
  );
}

export function Footer() {
  const { shop } = useShop();
  const lines = String(shop.hours || '').split('\n').map(s => s.trim()).filter(Boolean);
  // "@usuario" → enlace directo al perfil; una URL completa se respeta tal cual.
  const igRaw = String(shop.instagram || '').trim();
  const igHandle = igRaw.replace(/^@/, '');
  const igHref = igRaw
    ? (/^https?:\/\//i.test(igRaw) ? igRaw : `https://instagram.com/${igHandle}`)
    : '';
  const email = String(shop.email || '').trim();

  return (
    <footer className="footer">
      <div className="wrap">
        <div className="foot-mark" aria-hidden="true">{shop.name.toUpperCase()}</div>
        <div className="foot-grid">
          <div>
            <h4>Tienda</h4>
            <a href="#catalogo">Catálogo</a>
            <a href="#proceso">Nuestro proceso</a>
            <a href="#opiniones">Opiniones</a>
            <a href="#preguntas">Preguntas frecuentes</a>
          </div>
          <div>
            <h4>Contacto</h4>
            <a href={`https://wa.me/${shop.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            {email && <a href={`mailto:${email}`}>{email}</a>}
            {igHref && (
              <a href={igHref} target="_blank" rel="noopener noreferrer">
                Instagram {igHandle ? `@${igHandle}` : ''}
              </a>
            )}
          </div>
          {lines.length > 0 && (
            <div>
              <h4>Horario</h4>
              {lines.map(l => <p key={l}>{l}</p>)}
            </div>
          )}
          <div>
            <h4>Legal</h4>
            {LEGAL_ORDER.map(s => (
              <Link key={s} to={`/doc/${s}`}>{LEGAL[s].title}</Link>
            ))}
          </div>
        </div>
        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} {shop.name} · Deshidratados artesanales</span>
          <span>Secado lento, sin prisa ☀</span>
        </div>
      </div>
    </footer>
  );
}