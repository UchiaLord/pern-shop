import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import type { Product } from '../lib/types';
import { useAuth } from '../auth/useAuth';

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setError(null);
    try {
      const res = await api.products.list();
      setProducts(res.products);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await api.products.list();
        if (mounted) setProducts(res.products);
      } catch (err: unknown) {
        if (mounted) setError(extractErrorMessage(err));
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <h2>Products</h2>

      {error && <div style={{ color: 'crimson' }}>{error}</div>}

      <button type="button" onClick={() => void reload()}>
        Reload
      </button>

      <ul>
        {products.map((p) => (
          <li key={p.id}>
            <strong>{p.name}</strong> — {p.priceCents} {p.currency} — SKU: {p.sku}
            {user && (
              <button
                type="button"
                style={{ marginLeft: 8 }}
                onClick={() => void api.cart.upsertItem(p.id, 1)}
              >
                Add to cart
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
