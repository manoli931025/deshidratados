import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ShopProvider } from './data/shop';
import Header from './components/Header';
import Hero, { Marquee } from './components/Hero';
import Catalog from './components/Catalog';
import { Process, Testimonials, Faq, Newsletter, Footer } from './components/Sections';
import CartDrawer from './components/CartDrawer';
import LegalPage from './components/LegalPage';
import AdminApp from './admin/AdminApp';
import { CurrencyProvider } from './data/currency';
import './App.css';

function Home() {
  const { pathname } = useLocation();

  // Con HashRouter el ancla "#proceso" es también la URL, así que si entramos
  // a la portada desde una ruta así (enlace directo o desde una página legal)
  // reposicionamos la vista en la sección correspondiente.
  useEffect(() => {
    const id = pathname.replace(/^\/+/, '');
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView();
  }, [pathname]);

  return (
    <>
      <Hero />
      <Marquee />
      <Catalog />
      <Process />
      <Testimonials />
      <Faq />
      <Newsletter />
    </>
  );
}

function Store() {
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <CartProvider>
      <Header onCartOpen={() => setCartOpen(true)} />
      <main>
        <Routes>
          {/* Una sola ruta comodín para toda la portada: así "/" y "#proceso"
              caen en el MISMO route y Home nunca se desmonta. Si se usara
              <Route index> + otro, cambiar de "#" a "#proceso" desmontaría la
              tienda y solo quedaría el pie de página (salto al final). */}
          <Route path="*" element={<Home />} />
          <Route path="doc/:slug" element={<LegalPage />} />
        </Routes>
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
        <CurrencyProvider>
          <Routes>
            <Route path="/admin/*" element={<AdminApp />} />
            <Route path="*" element={<Store />} />
          </Routes>
        </CurrencyProvider>
      </ShopProvider>
    </HashRouter>
  );
}

export default App;