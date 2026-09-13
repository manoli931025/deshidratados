import { createContext, useContext, useReducer, useEffect } from 'react';

const CartContext = createContext();

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD': {
      const existing = state.find(item => 
        item.id === action.payload.id && item.variant.id === action.payload.variant.id
      );
      if (existing) {
        return state.map(item =>
          item.id === action.payload.id && item.variant.id === action.payload.variant.id
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item
        );
      }
      return [...state, { ...action.payload, quantity: 1 }];
    }
    case 'UPDATE_QTY':
      return state.map(item =>
        item.id === action.payload.id && item.variant.id === action.payload.variant.id
          ? { ...item, quantity: action.payload.quantity }
          : item
      ).filter(item => item.quantity > 0);
    case 'REMOVE':
      return state.filter(item =>
        !(item.id === action.payload.id && item.variant.id === action.payload.variant.id)
      );
    case 'CLEAR':
      return [];
    default:
      return state;
  }
};

export const CartProvider = ({ children }) => {
  const [cart, dispatch] = useReducer(cartReducer, [], () => {
    try {
      const saved = localStorage.getItem('solaria-cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('solaria-cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product, variant, quantity = 1) => {
    dispatch({ type: 'ADD', payload: { ...product, variant, quantity } });
  };

  const updateQuantity = (id, variantId, quantity) => {
    if (quantity <= 0) {
      dispatch({ type: 'REMOVE', payload: { id, variant: { id: variantId } } });
    } else {
      dispatch({ type: 'UPDATE_QTY', payload: { id, variant: { id: variantId }, quantity } });
    }
  };

  const removeFromCart = (id, variantId) => {
    dispatch({ type: 'REMOVE', payload: { id, variant: { id: variantId } } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR' });
  };

  const total = cart.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cart, addToCart, updateQuantity, removeFromCart, clearCart, total, itemCount
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe usarse dentro de CartProvider');
  return context;
};