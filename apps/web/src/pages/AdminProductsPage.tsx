// apps/web/src/pages/AdminProductsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';

import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import type { Product } from '../lib/types';
import { EmptyState, ErrorBanner, Loading } from '../components/Status';

import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

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

function parseNonNegativeInt(
  value: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const raw = value.trim();

  if (raw.length === 0) return { ok: false, message: 'priceCents ist erforderlich.' };
  if (!/^\d+$/.test(raw)) {
    return { ok: false, message: 'priceCents muss eine nicht-negative ganze Zahl sein.' };
  }

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    return { ok: false, message: 'priceCents muss eine nicht-negative ganze Zahl sein.' };
  }

  return { ok: true, value: n };
}

function StatusChip({ active }: { active: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-2xl border px-2 py-1 text-xs backdrop-blur-md',
        'border-white/10 bg-white/8',
        active ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--danger))]',
      ].join(' ')}
    >
      {active ? 'active' : 'inactive'}
    </span>
  );
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
      // Admin: alle Produkte (inkl. inactive)
      const res = await api.admin.products.list();
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

  async function onCreate(e: FormEvent) {
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

      // Admin create (POST /products, role-protected)
      const res = await api.admin.products.create(payload);
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

    // Optimistic UI
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, isActive: nextActive } : p)));
    setIsToggling((prev) => ({ ...prev, [productId]: true }));
    setPageError(null);

    try {
      const res = await api.admin.products.patch(productId, { isActive: nextActive });
      setProducts((prev) => prev.map((p) => (p.id === productId ? res.product : p)));
    } catch (err: unknown) {
      // rollback + re-sync
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs tracking-widest text-[rgb(var(--muted))]">ADMIN</div>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--fg))]">Products</h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Create new products and toggle active status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void loadProducts()} disabled={isLoading}>
            {isLoading ? 'Loading…' : 'Reload'}
          </Button>
        </div>
      </div>

      {pageError ? <ErrorBanner message={pageError} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Create Product</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {submitError ? <ErrorBanner message={submitError} /> : null}

              <form onSubmit={(e) => void onCreate(e)} className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xs text-[rgb(var(--muted))]">SKU</div>
                  <Input
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-[rgb(var(--muted))]">Name</div>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-[rgb(var(--muted))]">Description</div>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="w-full rounded-2xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] outline-none backdrop-blur-md focus:ring-2 focus:ring-[rgb(var(--ring))]/60"
                    placeholder="Optional…"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-[rgb(var(--muted))]">Price (cents)</div>
                    <Input
                      type="text"
                      name="priceCents"
                      value={form.priceCents}
                      onChange={(e) => setForm((f) => ({ ...f, priceCents: e.target.value }))}
                      inputMode="numeric"
                      pattern="^[0-9]+$"
                      placeholder="z.B. 2000"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-[rgb(var(--muted))]">Currency</div>
                    <Input
                      value={form.currency}
                      onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-[rgb(var(--fg))]/85">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="h-4 w-4 accent-white/70"
                  />
                  Active
                </label>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Creating…' : 'Create'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {isLoading ? <Loading /> : null}

          {!isLoading && !pageError && sortedProducts.length === 0 ? (
            <EmptyState message="Keine Produkte." />
          ) : null}

          {!isLoading && sortedProducts.length > 0 ? (
            <motion.div
              className="grid gap-4 sm:grid-cols-2"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
            >
              {sortedProducts.map((p) => {
                const pending = Boolean(isToggling[p.id]);

                return (
                  <motion.div
                    key={p.id}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.18 }}
                  >
                    <Card className={pending ? 'opacity-80' : ''}>
                      <CardHeader className="space-y-1">
                        <CardTitle className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate">
                              <span className="text-[rgb(var(--muted))]">{p.sku}</span> — {p.name}
                            </div>
                            <div className="mt-1 text-sm text-[rgb(var(--muted))]">
                              {formatCents(p.priceCents, p.currency)}
                            </div>
                          </div>

                          <StatusChip active={p.isActive} />
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        {p.description ? (
                          <div className="text-sm text-[rgb(var(--fg))]/80">{p.description}</div>
                        ) : (
                          <div className="text-sm text-[rgb(var(--muted))]">No description.</div>
                        )}

                        <div className="flex items-center justify-end">
                          <Button
                            variant={p.isActive ? 'danger' : 'primary'}
                            disabled={pending}
                            onClick={() => void toggleActive(p.id)}
                          >
                            {pending ? 'Saving…' : p.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
