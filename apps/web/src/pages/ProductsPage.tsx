import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../auth/useAuth';
import { EmptyState, ErrorBanner, Loading } from '../components/Status';
import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import type { Product } from '../lib/types';

export default function ProductsPage() {
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState<Record<number, boolean>>({});

  const sorted = useMemo(() => {
    const copy = [...products];
    copy.sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
    return copy;
  }, [products]);

  async function loadProducts() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.products.list();
      setProducts(res.products);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  async function addToCart(productId: number) {
    if (!user) return;

    setIsAdding((prev) => ({ ...prev, [productId]: true }));
    setError(null);

    try {
      await api.cart.upsertItem(productId, 1);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsAdding((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    }
  }

  return (
    <div>
      <h2>Products</h2>

      {error ? <ErrorBanner message={error} /> : null}

      <button type="button" onClick={() => void loadProducts()} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Reload'}
      </button>

      {isLoading ? <Loading /> : null}

      {!isLoading && !error && sorted.length === 0 ? <EmptyState message="Keine Produkte." /> : null}

      <ul>
        {sorted.map((p) => (
          <li key={p.id} style={{ marginTop: 8 }}>
            <strong>{p.name}</strong> — {formatCents(p.priceCents, p.currency)} — SKU: {p.sku}
            {user ? (
              <button
                type="button"
                style={{ marginLeft: 8 }}
                disabled={Boolean(isAdding[p.id])}
                onClick={() => void addToCart(p.id)}
              >
                {isAdding[p.id] ? 'Adding...' : 'Add to cart'}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}