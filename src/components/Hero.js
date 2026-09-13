import { products } from '../data/products';

export default function Hero() {
  const desde = Math.min(...products.flatMap(p => p.variants.map(v => v.price)));
  return (
    <section className="hero" id="top">
      <div className="wrap hero-grid">
        <div>
          <p className="eyebrow">Tienda de deshidratados · sin azúcar añadida</p>
          <h1 className="hero-title">
            <span className="line"><span className="line-inner" style={{ animationDelay: '.1s' }}>El agua se va,</span></span>
            <span className="line"><span className="line-inner" style={{ animationDelay: '.26s' }}>El sabor</span></span>
            <span className="line"><span className="line-inner em" style={{ animationDelay: '.42s' }}>se queda.</span></span>
          </h1>
          <p className="hero-sub">
            Deshidratamos a baja temperatura lo mejor de cada cosecha: frutas, verduras y
            hierbas sin conservadores. Listas para tu alacena, tu mochila o tu taza.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-primary" href="#catalogo">Ver catálogo ↓</a>
            <a className="btn" href="#proceso">Nuestro proceso</a>
          </div>
          <div className="hero-mini">
            <span>Est. 2019</span><span>Sin conservadores</span><span>Envíos a todo el país</span>
          </div>
        </div>
        <div className="collage">
          <figure className="polaroid p1">
            <img src={products[0].image} alt={products[0].name} />
            <figcaption>mango · laminado fino</figcaption>
          </figure>
          <figure className="polaroid p2">
            <img src={products[1].image} alt={products[1].name} />
            <figcaption>piña · dulce natural</figcaption>
          </figure>
          <figure className="polaroid p3">
            <img src={products[2].image} alt={products[2].name} />
            <figcaption>manzana · con canela</figcaption>
          </figure>
          <div className="sun-badge" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <defs><path id="circ" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" /></defs>
              <text style={{ fontFamily: "'Space Mono', monospace", fontSize: '8.6px', letterSpacing: '2px', fill: '#1E1710' }}>
                <textPath href="#circ">SECADO LENTO · SIN CONSERVADORES · </textPath>
              </text>
              <circle cx="60" cy="60" r="13" fill="#C4531F" />
              <g stroke="#1E1710" strokeWidth="2" strokeLinecap="round">
                <line x1="60" y1="38" x2="60" y2="43" /><line x1="60" y1="77" x2="60" y2="82" />
                <line x1="38" y1="60" x2="43" y2="60" /><line x1="77" y1="60" x2="82" y2="60" />
                <line x1="44.4" y1="44.4" x2="48" y2="48" /><line x1="72" y1="72" x2="75.6" y2="75.6" />
                <line x1="75.6" y1="44.4" x2="72" y2="48" /><line x1="48" y1="72" x2="44.4" y2="75.6" />
              </g>
            </svg>
          </div>
          <span className="sticker">desde ${desde}</span>
        </div>
      </div>
    </section>
  );
}

const ITEMS = ['Mango', 'Piña', 'Manzana', 'Tomate seco', 'Chile ancho', 'Jengibre', 'Albahaca', 'Té limón', 'Mix senderista'];

export function Marquee() {
  const group = (
    <div className="mgroup">
      {ITEMS.map(i => <span key={i}>{i} <i>✳</i></span>)}
    </div>
  );
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">{group}{group}</div>
    </div>
  );
}