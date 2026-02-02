import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';

import { useAuth } from './auth/useAuth';
import RequireAuth from './auth/RequireAuth';
import RequireRole from './auth/RequireRole';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProductsPage from './pages/ProductsPage';
import CartPage from './pages/CartPage';
import OrdersPage from './pages/OrdersPage';
import AdminProductsPage from './pages/AdminProductsPage';

export default function App() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: 16 }}>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Link to="/products">Products</Link>
        <Link to="/cart">Cart</Link>
        <Link to="/orders">Orders</Link>

        {user?.role === 'admin' ? <Link to="/admin/products">Admin</Link> : null}

        {!user ? (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        ) : (
          <>
            <span>
              {user.email} ({user.role})
            </span>
            <button type="button" onClick={() => void logout()}>
              Logout
            </button>
          </>
        )}
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/products" replace />} />

        <Route path="/products" element={<ProductsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Auth-required */}
        <Route element={<RequireAuth />}>
          <Route path="/cart" element={<CartPage />} />
          <Route path="/orders" element={<OrdersPage />} />
        </Route>

        {/* Admin-only */}
        <Route element={<RequireRole role="admin" />}>
          <Route path="/admin/products" element={<AdminProductsPage />} />
        </Route>

        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </div>
  );
}