import React, { useEffect, useMemo, useState } from 'react';

import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import type { Product } from '../lib/types';
import { EmptyState, ErrorBanner, Loading } from '../components/Status';

type FormState = {
  sku: string;
  name: string;
  description: string;
  priceCents: string;
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

function normalizeCurrency(input: string): string {
  const c = input.trim().toUpperCase();
  return c || 'EUR';
}

function parseNonNegativeInt(value: string): { ok: true; value: number } | { ok: false; message: string } {
  const raw = value.trim();
  if (raw.length === 0) return { ok: false, message: 'priceCents ist erforderlich.' };
  if (!/^\d+$/.test(raw)) return { ok: false, message: 'priceCents muss eine nicht-negative ganze Zahl sein.' };

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    return { ok: false, message: 'priceCents muss eine nicht-negative ganze Zahl sein.' };
  }

  return { ok: true, value: n };
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [isToggling, setIsToggling] = useState<Record<number, boolean>>({});

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
    } catch (err: unknown) {
      setPageError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setPageError(null);

    const sku = form.sku.trim();
    const name = form.name.trim();
    const description = form.description.trim();
    const currency = normalizeCurrency(form.currency);

    if (!sku) {
      setSubmitError('SKU ist erforderlich.');
      setIsSubmitting(false);
      return;
    }
    if (!name) {
      setSubmitError('Name ist erforderlich.');
      setIsSubmitting(false);
      return;
    }

    const parsed = parseNonNegativeInt(form.priceCents);
    if (!parsed.ok) {
      setSubmitError(parsed.message);
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        sku,
        name,
        description: description ? description : null,
        priceCents: parsed.value,
        currency,
        isActive: form.isActive,
      };

      const res = await api.products.create(payload);
      setProducts((prev) => [res.product, ...prev]);
      setForm(initialForm);
    } catch (err: unknown) {
      setSubmitError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleActive(productId: number) {
    if (isToggling[productId]) return;

    const current = products.find((p) => p.id === productId);
    if (!current) return;

    const nextActive = !current.isActive;

    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, isActive: nextActive } : p)));
    setIsToggling((prev) => ({ ...prev, [productId]: true }));
    setPageError(null);

    try {
      const res = await api.products.patch(productId, { isActive: nextActive });
      setProducts((prev) => prev.map((p) => (p.id === productId ? res.product : p)));
    } catch (err: unknown) {
      setProducts((prev) => prev.map((p) => (p.id === productId ? current : p)));
      setPageError(extractErrorMessage(err));
      await loadProducts();
    } finally {
      setIsToggling((prev) => {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      });
    }
  }

  return (
    <div>
      <h2>Admin: Products</h2>

      <section style={{ border: '1px solid #ddd', padding: 12, marginBottom: 16 }}>
        <h3>Create Product</h3>

        {submitError ? <ErrorBanner message={submitError} /> : null}

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
              pattern="^\d+$"
              placeholder="e.g. 1999"
              required
            />
          </label>

          <label>
            Currency
            <input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
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

        {isLoading ? <Loading /> : null}
        {pageError ? <ErrorBanner message={pageError} /> : null}

        {!isLoading && !pageError && sortedProducts.length === 0 ? <EmptyState message="Keine Produkte." /> : null}

        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
          {sortedProducts.map((p) => {
            const pending = Boolean(isToggling[p.id]);

            return (
              <li key={p.id} style={{ border: '1px solid #ddd', padding: 12, opacity: pending ? 0.75 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {p.sku} — {p.name}
                    </div>
                    <div style={{ opacity: 0.8 }}>{formatCents(p.priceCents, p.currency)}</div>
                    {p.description ? <div style={{ marginTop: 6 }}>{p.description}</div> : null}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
                    <div>
                      Status:{' '}
                      <strong style={{ color: p.isActive ? 'green' : 'crimson' }}>
                        {p.isActive ? 'active' : 'inactive'}
                      </strong>
                    </div>

                    <button type="button" disabled={pending} onClick={() => void toggleActive(p.id)}>
                      {pending ? 'Saving...' : p.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}