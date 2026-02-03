import { Navigate, Route, Routes } from 'react-router-dom';

import { Navbar } from './components/layout/Navbar';

import RequireAuth from './auth/RequireAuth';
import RequireRole from './auth/RequireRole';

import ProductsPage from './pages/ProductsPage';
import CartPage from './pages/CartPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage';

import AdminProductsPage from './pages/AdminProductsPage';
import AdminOrdersPage from './pages/AdminOrdersPage';
import AdminOrderDetailsPage from './pages/AdminOrderDetailsPage';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForbiddenPage from './pages/ForbiddenPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <div className="min-h-dvh">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Routes>
          {/* Default */}
          <Route path="/" element={<Navigate to="/products" replace />} />

          {/* Public */}
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />

          {/* Authenticated */}
          <Route element={<RequireAuth />}>
            <Route path="/cart" element={<CartPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailsPage />} />

            {/* Admin */}
            <Route element={<RequireRole role="admin" />}>
              <Route path="/admin/products" element={<AdminProductsPage />} />
              <Route path="/admin/orders" element={<AdminOrdersPage />} />
              <Route path="/admin/orders/:id" element={<AdminOrderDetailsPage />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}