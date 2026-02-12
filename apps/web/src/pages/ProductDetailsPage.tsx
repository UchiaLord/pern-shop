// apps/web/src/pages/ProductDetailsPage.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../lib/api';
import type { Product } from '../lib/types';
import { extractErrorMessage } from '../lib/errors';
import { useAuth } from '../auth/useAuth';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency }).format(cents / 100);
}

export default function ProductDetailsPage() {
  const { user } = useAuth();

  const params = useParams();
  const id = Number(params.id);
  const isValidId = Number.isFinite(id) && id > 0;

  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const currency = useMemo(() => product?.currency ?? 'EUR', [product]);

  const fetchProduct = useCallback(async () => {
    if (!isValidId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.products.get(id);
      setProduct(res.product);
    } catch (err: unknown) {
      setProduct(null);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, isValidId]);

  useEffect(() => {
    void fetchProduct();
  }, [fetchProduct]);

  const addToCart = useCallback(async () => {
    if (!user) {
      setError('Bitte einloggen, um Produkte in den Warenkorb zu legen.');
      return;
    }
    if (!product) return;
    if (adding) return;

    setAdding(true);
    setError(null);

    try {
      await api.cart.upsertItem(product.id, 1);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setAdding(false);
    }
  }, [adding, product, user]);

  if (!isValidId) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Product</h2>
        <Card className="p-4">
          <div className="text-sm text-red-600">Ungültige Produkt-ID.</div>
        </Card>
        <Link className="underline" to="/products">
          Back to products
        </Link>
      </div>
    );
  }

  if (loading && !product) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Product</h2>
        <Card className="p-4">
          <div className="text-sm">Loading…</div>
        </Card>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Product</h2>
        <Card className="p-4">
          <div className="text-sm text-red-600">{error}</div>
        </Card>
        <Link className="underline" to="/products">
          Back to products
        </Link>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{product.name}</h2>
        <Link className="underline" to="/products">
          Back
        </Link>
      </div>

      {error ? (
        <Card className="p-4">
          <div className="text-sm text-red-600">{error}</div>
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <div className="text-sm opacity-80">SKU: {product.sku}</div>
        <div className="text-lg font-semibold">{formatMoney(product.priceCents, currency)}</div>

        {product.description ? (
          <div className="whitespace-pre-wrap text-sm opacity-90">{product.description}</div>
        ) : (
          <div className="text-sm opacity-70">No description.</div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={addToCart} disabled={adding}>
            {adding ? 'Adding…' : 'Add to cart'}
          </Button>

          <Link to="/cart">
            <Button variant="ghost">Go to cart</Button>
          </Link>

          <Button variant="ghost" onClick={() => void fetchProduct()} disabled={loading}>
            {loading ? 'Loading…' : 'Reload'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
