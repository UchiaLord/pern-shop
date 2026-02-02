import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import RequireAuth from './auth/RequireAuth';
import RequireRole from './auth/RequireRole';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProductsPage from './pages/ProductsPage';
import CartPage from './pages/CartPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import AdminProductsPage from './pages/AdminProductsPage';

import { AppShell } from './components/layout/AppShell';

export default function App() {
  const location = useLocation();

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          <Routes location={location}>
            <Route path="/" element={<Navigate to="/products" replace />} />

            <Route path="/products" element={<ProductsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Auth-required */}
            <Route element={<RequireAuth />}>
              <Route path="/cart" element={<CartPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetailsPage />} />
            </Route>

            {/* Admin-only */}
            <Route element={<RequireRole role="admin" />}>
              <Route path="/admin/products" element={<AdminProductsPage />} />
            </Route>

            <Route path="*" element={<div>404 Not Found</div>} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}