import { useMemo, useState } from 'react';
import { products, categories } from '../data/products';
import { useCart } from '../context/CartContext';
import Reveal from './Reveal';

function ProductCard({ product }) {
  const { addToCart } = useCart();
  const [vid, setVid] = useState('100');
  const [added, setAdded] = useState(false);
  const variant = product.variants.find(v => v.id === vid) || product.variants[0];

  const handleAdd = () => {
    addToCart(product, variant, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <article className="p-card">
      <div className="p-media">
        <img src={product.image} alt={product.name} loading="lazy" />
        {product.badge && <span className="p-badge">{product.badge}</span>}
        <span className="p-origin">{product.origin}</span>
      </div>
      <div className="p-body">
        <div className="p-top">
          <h3>{product.name}</h3>
          <span className="p-rating">★ {product.rating} ({product.reviews})</span>
        </div>
        <p className="p-desc">{product.description}</p>
        <div className="p-variants">
          {product.variants.map(v => (
            <button key={v.id} className={'vchip' + (v.id === vid ? ' on' : '')} onClick={() => setVid(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="p-foot">
          <span className="p-price">${variant.price}</span>
          <button className={'btn add-btn' + (added ? ' ok' : '')} onClick={handleAdd}>
            {added ? '✓ Agregado' : '+ Agregar'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Catalog() {
  const [cat, setCat] = useState('todos');
  const [q, setQ] = useState('');
  const list = useMemo(() => products.filter(p =>
    (cat === 'todos' || p.category === cat) &&
    (p.name + ' ' + p.description).toLowerCase().includes(q.toLowerCase())
  ), [cat, q]);

  return (
    <section id="catalogo" className="section">
      <div className="wrap">
        <header className="sec-head">
          <span className="sec-idx">01</span>
          <div>
            <p className="eyebrow">Catálogo</p>
            <h2>La despensa</h2>
          </div>
          <p className="sec-note">Bolsa compostable con sello hermético. Precios de mostrador.</p>
        </header>
        <div className="toolbar">
          {categories.map(c => (
            <button key={c.id} className={'chip' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>
              {c.label}
            </button>
          ))}
          <input className="search" placeholder="Buscar mango, chile, té…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {list.length === 0 ? (
          <p className="empty">Sin resultados para “{q}”. Prueba con otra palabra ☀</p>
        ) : (
          <div className="prod-grid">
            {list.map((p, i) => (
              <Reveal key={p.id} className="reveal-cell" delay={(i % 4) * 70}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}