import { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ShopProvider } from './data/shop';
import Header from './components/Header';
import Hero, { Marquee } from './components/Hero';
import Catalog from './components/Catalog';
import { Process, Testimonials, Faq, Newsletter, Footer } from './components/Sections';
import CartDrawer from './components/CartDrawer';
import AdminApp from './admin/AdminApp';
import './App.css';

function Store() {
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

function App() {
  return (
    <HashRouter>
      <ShopProvider>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Store />} />
        </Routes>
      </ShopProvider>
    </HashRouter>
  );
}

export default App;