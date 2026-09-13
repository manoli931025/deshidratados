import { useState } from 'react';
import { CartProvider } from './context/CartContext';
import Header from './components/Header';
import Hero, { Marquee } from './components/Hero';
import Catalog from './components/Catalog';
import { Process, Testimonials, Faq, Newsletter, Footer } from './components/Sections';
import CartDrawer from './components/CartDrawer';
import './App.css';

function App() {
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <CartProvider>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main>
        <Hero />
        <Marquee />
        <Catalog />
        <Process />
        <Testimonials />
        <Faq />
        <Newsletter />
      </main>
      <Footer />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </CartProvider>
  );
}

export default App;