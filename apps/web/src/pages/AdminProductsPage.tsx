import React, { useEffect, useMemo, useState } from 'react';

import { api } from '../lib/api';
import type { ApiError, Product } from '../lib/types';

type FormState = {
  sku: string;
  name: string;
  description: string;
  priceCents: string; // keep as string for input
  currency: string;
  isActive: boolean;
};

const initialForm: FormState = {
  sku: '',
  name: '',
  description: '',
  priceCents: '',
  currency: 'EUR',
  isActive: true,
};

function isApiError(err: unknown): err is ApiError {
  if (!err || typeof err !== 'object') return false;
  if (!('error' in err)) return false;

  const maybe = err as { error?: unknown };
  if (!maybe.error || typeof maybe.error !== 'object') return false;

  const inner = maybe.error as { code?: unknown; message?: unknown; details?: unknown };
  return typeof inner.code === 'string' && typeof inner.message === 'string';
}

function formatError(err: unknown): string {
  if (isApiError(err)) {
    const code = err.error.code;
    const msg = err.error.message;
    const details =
      err.error.details && typeof err.error.details === 'object' ? JSON.stringify(err.error.details) : '';
    return details ? `${code}: ${msg} (${details})` : `${code}: ${msg}`;
  }

  if (err instanceof Error) return err.message;
  return 'Unbekannter Fehler.';
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sortedProducts = useMemo(() => {
    const copy = [...products];
    copy.sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
    return copy;
  }, [products]);

  async function loadProducts() {
    setIsLoading(true);
    setPageError(null);
    try {
      const res = await api.products.list();
      setProducts(res.products);
    } catch (err) {
      setPageError(formatError(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const priceCents = Number(form.priceCents);
      if (!Number.isFinite(priceCents) || priceCents < 0 || !Number.isInteger(priceCents)) {
        setSubmitError('priceCents muss eine nicht-negative ganze Zahl sein.');
        return;
      }

      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description.trim() ? form.description.trim() : null,
        priceCents,
        currency: form.currency.trim().toUpperCase() || 'EUR',
        isActive: form.isActive,
      };

      const res = await api.products.create(payload);
      setProducts((prev) => [res.product, ...prev]);
      setForm(initialForm);
    } catch (err) {
      setSubmitError(formatError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function setActive(productId: number, isActive: boolean) {
    // optimistic UI
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, isActive } : p)));
    try {
      const res = await api.products.patch(productId, { isActive });
      setProducts((prev) => prev.map((p) => (p.id === productId ? res.product : p)));
    } catch (err) {
      // rollback by refetching (simple and safe)
      await loadProducts();
      setPageError(formatError(err));
    }
  }

  return (
    <div>
      <h2>Admin: Products</h2>

      <section style={{ border: '1px solid #ddd', padding: 12, marginBottom: 16 }}>
        <h3>Create Product</h3>

        {submitError ? <div style={{ color: 'crimson', marginBottom: 8 }}>{submitError}</div> : null}

        <form onSubmit={(e) => void onCreate(e)} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
          <label>
            SKU
            <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} required />
          </label>

          <label>
            Name
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </label>

          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </label>

          <label>
            Price (cents)
            <input
              value={form.priceCents}
              onChange={(e) => setForm((f) => ({ ...f, priceCents: e.target.value }))}
              inputMode="numeric"
              pattern="^\\d+$"
              placeholder="e.g. 1999"
              required
            />
          </label>

          <label>
            Currency
            <input
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              placeholder="EUR"
            />
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create'}
          </button>
        </form>
      </section>

      <section>
        <h3>Products</h3>

        {isLoading ? <div>Lade...</div> : null}
        {pageError ? <div style={{ color: 'crimson', marginBottom: 8 }}>{pageError}</div> : null}

        {!isLoading && !pageError && sortedProducts.length === 0 ? <div>Keine Produkte.</div> : null}

        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
          {sortedProducts.map((p) => (
            <li key={p.id} style={{ border: '1px solid #ddd', padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {p.sku} — {p.name}
                  </div>
                  <div style={{ opacity: 0.8 }}>
                    {p.priceCents} {p.currency}
                  </div>
                  {p.description ? <div style={{ marginTop: 6 }}>{p.description}</div> : null}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
                  <div>Status: {p.isActive ? 'active' : 'inactive'}</div>
                  <button type="button" onClick={() => void setActive(p.id, !p.isActive)}>
                    {p.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
