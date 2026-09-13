import { useState } from 'react';
import Reveal from './Reveal';
import { SHOP } from '../data/config';

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
  { txt: 'El mango sabe a mango de verdad. Mis hijos lo piden más que las gomitas.', who: 'Mariana G. · cliente desde 2021', r: '-1.6deg' },
  { txt: 'Compro el mix senderista cada mes para mis rutas. Aguanta calor, lluvia y mochila revuelta.', who: 'Luis A. · guía de montaña', r: '1.4deg' },
  { txt: 'Uso sus tomates secos en el restaurante. Una concentración de sabor que no encuentro en ningún proveedor.', who: 'Chef Renata V. · cocina de autor', r: '-1deg' },
];

export function Testimonials() {
  return (
    <section id="opiniones" className="section">
      <div className="wrap">
        <header className="sec-head">
          <span className="sec-idx">02</span>
          <div><p className="eyebrow">Opiniones</p><h2>Lo que dicen los que ya probaron</h2></div>
        </header>
        <div className="quotes">
          {QUOTES.map((q, i) => (
            <Reveal key={q.who} delay={i * 120}>
              <blockquote className="quote" style={{ '--r': q.r }}>
                <div className="quote-stars">★★★★★</div>
                <p>{q.txt}</p>
                <cite className="quote-author">{q.who}</cite>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  { q: '¿Los productos llevan azúcar o conservadores?', a: 'No. Solo el producto y, en algunos mixes, especias. Nada de sulfitos, colorantes ni azúcar añadida. Por eso los colores son los reales: más apagados que un producto industrial, pero con sabor de verdad.' },
  { q: '¿Cuánto tarda el envío?', a: 'Despachamos en 24–48 horas después de confirmar tu pedido. La entrega local es al día siguiente y los envíos nacionales tardan de 2 a 5 días según la paquetería.' },
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
  const [done, setDone] = useState(false);
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
          <form className="news-form" onSubmit={e => { e.preventDefault(); setDone(true); }}>
            <input type="email" placeholder="tu@correo.com" required aria-label="Tu correo" />
            <button type="submit">Unirme</button>
          </form>
        )}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="foot-mark" aria-hidden="true">{SHOP.name.toUpperCase()}</div>
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
            <a href={`https://wa.me/${SHOP.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <a href="mailto:hola@solaria.mx">hola@solaria.mx</a>
            <p>Instagram @solaria.seca</p>
          </div>
          <div>
            <h4>Horario</h4>
            <p>Lun – Vie · 9:00 – 18:00</p>
            <p>Sábado · 9:00 – 14:00</p>
            <p>Domingo · el sol descansa</p>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} {SHOP.name} · Deshidratados artesanales</span>
          <span>Secado lento, sin prisa ☀</span>
        </div>
      </div>
    </footer>
  );
}