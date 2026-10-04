import { useEffect, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useShop } from '../data/shop';

export default function Header({ onCartOpen }) {
  const { itemCount, total } = useCart();
  const { shop } = useShop();
  const [msg, setMsg] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const countRef = useRef(null);

  const MSGS = [
    `Envío gratis en pedidos mayores a $${shop.freeShip}`,
    'Nueva cosecha: mango ataulfo de Nayarit',
    'Pedidos por WhatsApp · respuesta el mismo día',
  ];

  useEffect(() => {
    const t = setInterval(() => setMsg(m => (m + 1) % MSGS.length), 4000);
    return () => clearInterval(t);
  }, [MSGS.length]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const el = countRef.current;
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }, [itemCount]);

  return (
    <>
      <div className="announce" aria-hidden="true"><span key={msg}>{MSGS[msg]}</span></div>
      <header className={'site-header' + (scrolled ? ' scrolled' : '')}>
        <div className="wrap head-in">
          <a href="#top" className="logo">☀ {shop.name}<small>deshidratados · est. 2019</small></a>
          <nav className="main">
            <a href="#catalogo">Catálogo</a>
            <a href="#proceso">Proceso</a>
            <a href="#opiniones">Opiniones</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <button className="cart-btn" onClick={onCartOpen}>
            🧺 {itemCount > 0 && <span className="cart-total">${total}</span>}
            <span className="cart-count" ref={countRef}>{itemCount}</span>
          </button>
          <button className={'burger' + (menu ? ' open' : '')} onClick={() => setMenu(!menu)} aria-label="Menú">
            <span /><span /><span />
          </button>
        </div>
        <nav className={'mnav' + (menu ? ' open' : '')}>
          <a href="#catalogo" onClick={() => setMenu(false)}>Catálogo</a>
          <a href="#proceso" onClick={() => setMenu(false)}>Proceso</a>
          <a href="#opiniones" onClick={() => setMenu(false)}>Opiniones</a>
          <a href="#preguntas" onClick={() => setMenu(false)}>Preguntas</a>
        </nav>
      </header>
    </>
  );
}