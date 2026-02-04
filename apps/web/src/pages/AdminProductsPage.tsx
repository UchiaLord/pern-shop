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

type CreateFormState = {
  sku: string;
  name: string;
  description: string;
  priceCents: string;
  currency: string;
  isActive: boolean;
};

type EditFormState = {
  sku: string;
  name: string;
  description: string;
  priceCents: string;
  currency: string;
};

const initialCreateForm: CreateFormState = {
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
  if (!/^\d+$/.test(raw)) return { ok: false, message: 'priceCents muss eine nicht-negative ganze Zahl sein.' };

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    return { ok: false, message: 'priceCents muss eine nicht-negative ganze Zahl sein.' };
  }

  return { ok: true, value: n };
}

function validateIso4217(currency: string): { ok: true; value: string } | { ok: false; message: string } {
  const c = normalizeCurrency(currency);
  if (!/^[A-Z]{3}$/.test(c)) return { ok: false, message: 'currency muss ISO 4217 (z.B. EUR) sein.' };
  return { ok: true, value: c };
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

function toEditForm(p: Product): EditFormState {
  return {
    sku: String(p.sku ?? ''),
    name: String(p.name ?? ''),
    description: String(p.description ?? ''),
    priceCents: String(p.priceCents ?? 0),
    currency: String(p.currency ?? 'EUR'),
  };
}

function buildPatch(original: Product, draft: EditFormState): {
  ok: true;
  patch: Partial<Pick<Product, 'sku' | 'name' | 'description' | 'priceCents' | 'currency'>>;
} | { ok: false; message: string } {
  const sku = draft.sku.trim();
  const name = draft.name.trim();
  const description = draft.description.trim();
  const parsedPrice = parseNonNegativeInt(draft.priceCents);
  if (!sku) return { ok: false, message: 'SKU ist erforderlich.' };
  if (!name) return { ok: false, message: 'Name ist erforderlich.' };
  if (!parsedPrice.ok) return { ok: false, message: parsedPrice.message };

  const cur = validateIso4217(draft.currency);
  if (!cur.ok) return { ok: false, message: cur.message };

  // Patch nur mit echten Änderungen (sonst 400 empty patch)
  const patch: Partial<Pick<Product, 'sku' | 'name' | 'description' | 'priceCents' | 'currency'>> = {};

  if (sku !== original.sku) patch.sku = sku;
  if (name !== original.name) patch.name = name;

  // Contract: description kann null sein
  const originalDesc = original.description ?? null;
  const nextDesc = description.length > 0 ? description : null;
  if (nextDesc !== originalDesc) patch.description = nextDesc;

  if (parsedPrice.value !== original.priceCents) patch.priceCents = parsedPrice.value;
  const nextCurrency = cur.value;
  if (nextCurrency !== original.currency) patch.currency = nextCurrency;

  return { ok: true, patch };
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<CreateFormState>(initialCreateForm);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [isToggling, setIsToggling] = useState<Record<number, boolean>>({});

  // --- Edit UX State ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditFormState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState<Record<number, boolean>>({});

  const sortedProducts = useMemo(() => {
    const copy = [...products];
    copy.sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
    return copy;
  }, [products]);

  async function loadProducts() {
    setIsLoading(true);
    setPageError(null);
    try {
      // Admin: alle Produkte (damit inactive sichtbar bleibt)
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

  function startEdit(p: Product) {
    setEditError(null);
    setEditingId(p.id);
    setEditDraft(toEditForm(p));
  }

  function cancelEdit() {
    setEditError(null);
    setEditingId(null);
    setEditDraft(null);
  }

  function isDirty(original: Product, draft: EditFormState | null): boolean {
    if (!draft) return false;
    const sku = draft.sku.trim();
    const name = draft.name.trim();
    const desc = draft.description.trim();
    const currency = normalizeCurrency(draft.currency);
    const priceRaw = draft.priceCents.trim();

    const originalDesc = original.description ?? '';
    return (
      sku !== original.sku ||
      name !== original.name ||
      desc !== originalDesc ||
      currency !== original.currency ||
      priceRaw !== String(original.priceCents)
    );
  }

  async function saveEdit(productId: number) {
    const original = products.find((p) => p.id === productId);
    if (!original) return;
    if (!editDraft) return;

    setEditError(null);

    const built = buildPatch(original, editDraft);
    if (!built.ok) {
      setEditError(built.message);
      return;
    }

    const patch = built.patch;

    // Keine Änderungen -> einfach schließen (kein leeres PATCH)
    if (Object.keys(patch).length === 0) {
      cancelEdit();
      return;
    }

    if (isSavingEdit[productId]) return;

    setIsSavingEdit((prev) => ({ ...prev, [productId]: true }));

    // Optimistic: apply patch locally
    const optimistic: Product = {
      ...original,
      ...patch,
      // description könnte undefined im patch sein; dann bleibt original
      description: patch.description !== undefined ? patch.description : original.description,
      priceCents: patch.priceCents !== undefined ? patch.priceCents : original.priceCents,
      currency: patch.currency !== undefined ? patch.currency : original.currency,
      sku: patch.sku !== undefined ? patch.sku : original.sku,
      name: patch.name !== undefined ? patch.name : original.name,
    };

    setProducts((prev) => prev.map((p) => (p.id === productId ? optimistic : p)));

    try {
      const res = await api.products.patch(productId, patch);
      setProducts((prev) => prev.map((p) => (p.id === productId ? res.product : p)));
      cancelEdit();
    } catch (err: unknown) {
      // rollback
      setProducts((prev) => prev.map((p) => (p.id === productId ? original : p)));
      setEditError(extractErrorMessage(err));
      await loadProducts();
    } finally {
      setIsSavingEdit((prev) => {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      });
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setPageError(null);

    const sku = createForm.sku.trim();
    const name = createForm.name.trim();
    const description = createForm.description.trim();

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

    const parsed = parseNonNegativeInt(createForm.priceCents);
    if (!parsed.ok) {
      setSubmitError(parsed.message);
      setIsSubmitting(false);
      return;
    }

    const currencyValidated = validateIso4217(createForm.currency);
    if (!currencyValidated.ok) {
      setSubmitError(currencyValidated.message);
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        sku,
        name,
        description: description ? description : null,
        priceCents: parsed.value,
        currency: currencyValidated.value,
        isActive: createForm.isActive,
      };

      const res = await api.products.create(payload);
      setProducts((prev) => [res.product, ...prev]);
      setCreateForm(initialCreateForm);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs tracking-widest text-[rgb(var(--muted))]">ADMIN</div>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--fg))]">Products</h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">Create, edit and toggle active status.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void loadProducts()} disabled={isLoading}>
            {isLoading ? 'Loading…' : 'Reload'}
          </Button>
        </div>
      </div>

      {pageError ? <ErrorBanner message={pageError} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Create */}
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
                    value={createForm.sku}
                    onChange={(e) => setCreateForm((f) => ({ ...f, sku: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-[rgb(var(--muted))]">Name</div>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-[rgb(var(--muted))]">Description</div>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
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
                      value={createForm.priceCents}
                      onChange={(e) => setCreateForm((f) => ({ ...f, priceCents: e.target.value }))}
                      inputMode="numeric"
                      pattern="^[0-9]+$"
                      placeholder="z.B. 2000"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-[rgb(var(--muted))]">Currency</div>
                    <Input
                      value={createForm.currency}
                      onChange={(e) => setCreateForm((f) => ({ ...f, currency: e.target.value }))}
                      placeholder="EUR"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-[rgb(var(--fg))]/85">
                  <input
                    type="checkbox"
                    checked={createForm.isActive}
                    onChange={(e) => setCreateForm((f) => ({ ...f, isActive: e.target.checked }))}
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

        {/* List */}
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
                const pendingToggle = Boolean(isToggling[p.id]);
                const isEditing = editingId === p.id;
                const savingEdit = Boolean(isSavingEdit[p.id]);
                const draft = isEditing ? editDraft : null;
                const dirty = isEditing && draft ? isDirty(p, draft) : false;

                return (
                  <motion.div
                    key={p.id}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.18 }}
                  >
                    <Card className={(pendingToggle || savingEdit) ? 'opacity-80' : ''}>
                      <CardHeader className="space-y-2">
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

                        {isEditing && editError ? <ErrorBanner message={editError} /> : null}
                      </CardHeader>

                      <CardContent className="space-y-3">
                        {!isEditing ? (
                          <>
                            {p.description ? (
                              <div className="text-sm text-[rgb(var(--fg))]/80">{p.description}</div>
                            ) : (
                              <div className="text-sm text-[rgb(var(--muted))]">No description.</div>
                            )}

                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                onClick={() => startEdit(p)}
                                disabled={pendingToggle || savingEdit}
                              >
                                Edit
                              </Button>

                              <Button
                                variant={p.isActive ? 'danger' : 'primary'}
                                disabled={pendingToggle || savingEdit}
                                onClick={() => void toggleActive(p.id)}
                              >
                                {pendingToggle ? 'Saving…' : p.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="grid gap-3">
                              <div className="space-y-1">
                                <div className="text-xs text-[rgb(var(--muted))]">SKU</div>
                                <Input
                                  value={draft?.sku ?? ''}
                                  onChange={(e) =>
                                    setEditDraft((d) => (d ? { ...d, sku: e.target.value } : d))
                                  }
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="text-xs text-[rgb(var(--muted))]">Name</div>
                                <Input
                                  value={draft?.name ?? ''}
                                  onChange={(e) =>
                                    setEditDraft((d) => (d ? { ...d, name: e.target.value } : d))
                                  }
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="text-xs text-[rgb(var(--muted))]">Description</div>
                                <textarea
                                  value={draft?.description ?? ''}
                                  onChange={(e) =>
                                    setEditDraft((d) => (d ? { ...d, description: e.target.value } : d))
                                  }
                                  rows={3}
                                  className="w-full rounded-2xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] outline-none backdrop-blur-md focus:ring-2 focus:ring-[rgb(var(--ring))]/60"
                                  placeholder="Optional… (leer = null)"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <div className="text-xs text-[rgb(var(--muted))]">Price (cents)</div>
                                  <Input
                                    type="text"
                                    value={draft?.priceCents ?? ''}
                                    onChange={(e) =>
                                      setEditDraft((d) => (d ? { ...d, priceCents: e.target.value } : d))
                                    }
                                    inputMode="numeric"
                                    pattern="^[0-9]+$"
                                    placeholder="z.B. 2000"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <div className="text-xs text-[rgb(var(--muted))]">Currency</div>
                                  <Input
                                    value={draft?.currency ?? ''}
                                    onChange={(e) =>
                                      setEditDraft((d) => (d ? { ...d, currency: e.target.value } : d))
                                    }
                                    placeholder="EUR"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <div className="text-xs text-[rgb(var(--muted))]">
                                {dirty ? 'Unsaved changes' : 'No changes'}
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  onClick={cancelEdit}
                                  disabled={savingEdit}
                                >
                                  Cancel
                                </Button>

                                <Button
                                  onClick={() => void saveEdit(p.id)}
                                  disabled={savingEdit}
                                >
                                  {savingEdit ? 'Saving…' : 'Save'}
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
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
