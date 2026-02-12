// apps/web/src/pages/ProductsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { motion } from 'framer-motion';
import { useAuth } from '../auth/useAuth';
import { ErrorBanner, Loading } from '../components/Status';
import EmptyState from '../components/ui/EmptyState';

import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { api } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import type { Product } from '../lib/types';

function ProductSkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/6 backdrop-blur-md shadow-xl shadow-black/20"
        />
      ))}
    </div>
  );
}

export default function ProductsPage() {
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState<Record<number, boolean>>({});

  const [searchParams, setSearchParams] = useSearchParams();
  const qRaw = (searchParams.get('q') ?? '').trim();
  const q = qRaw.toLowerCase();

  const filteredSorted = useMemo(() => {
    const copy = [...products];

    const filtered =
      q.length === 0
        ? copy
        : copy.filter((p) => {
            const hay = `${p.sku} ${p.name}`.toLowerCase();
            return hay.includes(q);
          });

    filtered.sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
    return filtered;
  }, [products, q]);

  const hasSearch = qRaw.length > 0;
  const isEmpty = !isLoading && !error && filteredSorted.length === 0;

  function clearSearch() {
    const params = new URLSearchParams(searchParams);
    params.delete('q');
    setSearchParams(params, { replace: true });
  }

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs tracking-widest text-[rgb(var(--muted))]">CATALOG</div>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--fg))]">Products</h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Browse products. Add-to-cart requires login. Click a card for details.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => void loadProducts()} disabled={isLoading}>
              {isLoading ? 'Loading…' : 'Reload'}
            </Button>
            {!user ? (
              <div className="text-sm text-[rgb(var(--muted))]">Login to purchase.</div>
            ) : (
              <div className="text-sm text-[rgb(var(--muted))]">Signed in as {user.email}</div>
            )}
          </div>

          {hasSearch ? (
            <div className="text-xs text-[rgb(var(--muted))]">
              Filter: <span className="text-[rgb(var(--fg))]/80">“{qRaw}”</span>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Content */}
      {isLoading ? (
        <>
          <Loading />
          <ProductSkeletonGrid />
        </>
      ) : null}

      {isEmpty ? (
        hasSearch ? (
          <EmptyState
            title="Keine Treffer"
            description="Für deine Suche wurden keine Produkte gefunden. Ändere den Suchbegriff oder entferne den Filter."
            action={
              <Button onClick={clearSearch} variant="ghost">
                Suche zurücksetzen
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Keine Produkte"
            description="Aktuell sind keine Produkte verfügbar. Bitte später erneut versuchen."
            action={
              <Button onClick={() => void loadProducts()} variant="ghost">
                Reload
              </Button>
            }
          />
        )
      ) : null}

      {!isLoading && !error && filteredSorted.length > 0 ? (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {filteredSorted.map((p) => (
            <motion.div
              key={p.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.18 }}
            >
              <Link to={`/products/${p.id}`} className="block h-full">
                <Card className="h-full cursor-pointer transition hover:bg-white/3">
                  <CardHeader className="space-y-1">
                    <CardTitle className="flex items-start justify-between gap-3">
                      <span className="leading-tight">{p.name}</span>
                      <span className="rounded-2xl border border-white/10 bg-white/6 px-2 py-1 text-xs text-[rgb(var(--muted))]">
                        {p.sku}
                      </span>
                    </CardTitle>
                    <div className="text-sm text-[rgb(var(--muted))]">
                      {formatCents(p.priceCents, p.currency)}
                    </div>
                  </CardHeader>

                  <CardContent className="flex items-end justify-between gap-3">
                    <div className="text-xs text-[rgb(var(--muted))]">
                      ID: <span className="text-[rgb(var(--fg))]/70">{p.id}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        className="min-w-[90px]"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        Details
                      </Button>

                      {user ? (
                        <Button
                          className="min-w-[120px]"
                          disabled={Boolean(isAdding[p.id])}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void addToCart(p.id);
                          }}
                        >
                          {isAdding[p.id] ? 'Adding…' : 'Add to cart'}
                        </Button>
                      ) : (
                        <Button
                          className="min-w-[120px]"
                          variant="ghost"
                          disabled
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          Login required
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      ) : null}
    </div>
  );
}
