import { useCart } from '../context/CartContext';
import { useShop } from '../data/shop';
import CheckoutForm from './CheckoutForm';

export default function CartDrawer({ isOpen, onClose }) {
  const { cart, updateQuantity, removeFromCart, clearCart, total, itemCount } = useCart();
  const { shop } = useShop();
  const pct = Math.min(100, (total / shop.freeShip) * 100);

  return (
    <>
      <div className={'scrim' + (isOpen ? ' show' : '')} onClick={onClose} />
      <aside className={'drawer' + (isOpen ? ' open' : '')} aria-label="Canasta de compras">
        <div className="drawer-head">
          <h3>Tu canasta ({itemCount})</h3>
          <button className="drawer-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="cart-list">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <span className="big">☀</span>
              <p>Tu canasta está vacía.</p>
              <button className="btn btn-primary" onClick={onClose}>Ver catálogo</button>
            </div>
          ) : cart.map(item => (
            <div className="c-item" key={item.id + item.variant.id}>
              <img src={item.image} alt="" />
              <div>
                <div className="c-name">{item.name}</div>
                <div className="c-meta">{item.variant.label} · ${item.variant.price} c/u</div>
                <div className="c-controls">
                  <button onClick={() => updateQuantity(item.id, item.variant.id, item.quantity - 1)} aria-label="Menos">−</button>
                  <span className="qty">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.variant.id, item.quantity + 1)} aria-label="Más">+</button>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="c-total">${item.quantity * item.variant.price}</div>
                <button className="c-del" onClick={() => removeFromCart(item.id, item.variant.id)}>quitar</button>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="drawer-foot">
            <div className="ship-bar"><div className="ship-fill" style={{ width: pct + '%' }} /></div>
            <p className="ship-msg">
              {total >= shop.freeShip ? '🎉 ¡Tienes envío gratis!' : `Te faltan $${shop.freeShip - total} para envío gratis`}
            </p>
            <div className="subtotal-row"><span>Subtotal</span><b>${total}</b></div>
            <CheckoutForm items={cart} total={total} onPlaced={clearCart} />
            <button className="clear-btn" onClick={clearCart}>Vaciar canasta</button>
          </div>
        )}
      </aside>
    </>
  );
}