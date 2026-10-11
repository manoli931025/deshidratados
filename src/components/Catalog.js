import { useMemo, useState } from 'react';
import { useShop } from '../data/shop';
import { useCart } from '../context/CartContext';
import Reveal from './Reveal';

function ProductCard({ product }) {
  const { addToCart } = useCart();
  const [vid, setVid] = useState(null);
  const [added, setAdded] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const variant = product.variants.find(v => v.id === vid)
    || product.variants.find(v => v.id === '100' || v.label === '100 g')
    || product.variants[0]
    || null;

  const variantImgs = (variant && Array.isArray(variant.images) && variant.images.length) ? variant.images : null;
  const activeGallery = variantImgs || (product.image ? [product.image] : []);
  const showNav = activeGallery.length > 1;
  const curImg = activeGallery.length ? activeGallery[imgIdx % activeGallery.length] : product.image;

  const handleAdd = () => {
    if (!variant) return;
    addToCart(product, variant, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  const pickVariant = (id) => { setVid(id); setImgIdx(0); };
  const prevImg = () => setImgIdx(i => (i - 1 + activeGallery.length) % activeGallery.length);
  const nextImg = () => setImgIdx(i => (i + 1) % activeGallery.length);

  return (
    <article className="p-card">
      <div className="p-media">
        <img src={curImg} alt={product.name} loading="lazy" />
        {product.badge && <span className="p-badge">{product.badge}</span>}
        <span className="p-origin">{product.origin}</span>
        {showNav && (
          <>
            <button className="p-nav prev" onClick={prevImg} aria-label="Foto anterior">‹</button>
            <button className="p-nav next" onClick={nextImg} aria-label="Foto siguiente">›</button>
            <div className="p-dots">
              {activeGallery.map((_, i) => (
                <span key={i} className={'p-dot' + (i === imgIdx ? ' on' : '')} onClick={() => setImgIdx(i)} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="p-body">
        <div className="p-top">
          <h3>{product.name}</h3>
          <span className="p-rating">★ {product.rating} ({product.reviews})</span>
        </div>
        <p className="p-desc">{product.description}</p>
        <div className="p-variants">
          {product.variants.map(v => (
            <button key={v.id} className={'vchip' + (variant && v.id === variant.id ? ' on' : '')} onClick={() => pickVariant(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="p-foot">
          <span className="p-price">{variant ? `$${variant.price}` : '—'}</span>
          <button className={'btn add-btn' + (added ? ' ok' : '')} onClick={handleAdd} disabled={!variant}>
            {added ? '✓ Agregado' : '+ Agregar'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Catalog() {
  const { products, categories } = useShop();
  const [cat, setCat] = useState('todos');
  const [q, setQ] = useState('');
  const list = useMemo(() => products.filter(p =>
    (cat === 'todos' || p.category === cat) &&
    (p.name + ' ' + p.description).toLowerCase().includes(q.toLowerCase())
  ), [cat, q, products]);

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